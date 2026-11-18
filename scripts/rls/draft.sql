begin;
\i scripts/rls/fixtures.sql
create temp table probe (tbl text, role text, op text, res text, total bigint);
grant all on probe to authenticated;
do $p$
declare
  t text; r record; total bigint; got bigint; res text; col text; roles text[][] := array[
    ['A','f5000000-0000-0000-0000-000000000001'], ['M','f5000000-0000-0000-0000-000000000002'], ['S','f5000000-0000-0000-0000-000000000003'],
    ['C','f5000000-0000-0000-0000-000000000004'], ['X','f5000000-0000-0000-0000-000000000005']];
  i integer; ok boolean;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relispartition order by 1 loop
    execute format('select count(*) from public.%I', t) into total;
    if total > 0 then
      execute format('create temp table %I as select * from public.%I order by ctid limit 1', 'tpl_' || t, t);
      execute format('grant select on pg_temp.%I to authenticated', 'tpl_' || t);
    end if;
    for i in 1..5 loop
      perform set_config('request.jwt.claims', json_build_object('sub', roles[i][2], 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      -- read
      begin
        execute format('select count(*) from public.%I', t) into got;
        res := case when total = 0 then (case when got = 0 then '?' else 'a' end) when got = 0 then '-' when got = total then 'a' else 'p' end;
      exception when others then res := '-'; end;
      execute 'reset role';
      insert into probe values (t, roles[i][1], 'R', res, total);
      -- insert: copy a tenant-1 row (a real row passes NOT NULL and CHECK constraints, so only privileges and RLS can refuse it)
      perform set_config('request.jwt.claims', json_build_object('sub', roles[i][2], 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      if total = 0 or to_regclass('pg_temp.tpl_' || t) is null then res := '?';
      else
        begin
          select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into col from pg_attribute a
           where a.attrelid = ('public.' || quote_ident(t))::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = '' and a.attidentity <> 'a';
          begin execute format('insert into public.%I (%s) select %s from pg_temp.%I', t, col, col, 'tpl_' || t); res := 'a'; raise exception 'rollback' using errcode = 'WMS98';
          exception when sqlstate 'WMS98' then null;
                    when sqlstate '23505' then res := 'a';
                    when sqlstate '23503' then res := 'a';
                    when others then res := '-'; end;
        end;
      end if;
      execute 'reset role';
      insert into probe values (t, roles[i][1], 'I', res, total);
      -- update first updatable column to itself
      select a.attname into col from pg_attribute a where a.attrelid = ('public.' || quote_ident(t))::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
         and has_column_privilege('authenticated', ('public.' || quote_ident(t))::regclass, a.attnum, 'update') order by a.attnum limit 1;
      perform set_config('request.jwt.claims', json_build_object('sub', roles[i][2], 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      if col is null then res := '-';
      else
        begin
          begin execute format('update public.%I set %I = %I', t, col, col); get diagnostics got = row_count; raise exception 'rollback' using errcode = 'WMS98';
          exception when sqlstate 'WMS98' then null; end;
          res := case when total = 0 then '?' when got = 0 then '-' when got = total then 'a' else 'p' end;
        exception when sqlstate '42501' then res := '-'; when others then res := 'x'; end;
      end if;
      execute 'reset role';
      insert into probe values (t, roles[i][1], 'U', res, total);
      -- delete
      perform set_config('request.jwt.claims', json_build_object('sub', roles[i][2], 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      begin
        begin execute format('delete from public.%I', t); get diagnostics got = row_count; raise exception 'rollback' using errcode = 'WMS98';
        exception when sqlstate 'WMS98' then null; end;
        res := case when total = 0 then '?' when got = 0 then '-' when got = total then 'a' else 'p' end;
      exception when sqlstate '42501' then res := '-'; when others then res := 'x'; end;
      execute 'reset role';
      insert into probe values (t, roles[i][1], 'D', res, total);
    end loop;
  end loop;
end $p$;
select tbl, max(total) as n,
  string_agg(case when op = 'R' then res end, '' order by role) filter (where op = 'R') as R,
  string_agg(res, '' order by role) filter (where op = 'I') as I,
  string_agg(res, '' order by role) filter (where op = 'U') as U,
  string_agg(res, '' order by role) filter (where op = 'D') as D
from probe group by tbl order by tbl;
rollback;
