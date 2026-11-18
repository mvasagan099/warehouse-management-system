-- Advised consignments due today also show in the manager's "expected today" list.
do $$
declare def text := pg_get_functiondef('public.manager_dashboard(uuid)'::regprocedure);
begin
  if position('inward_advices' in def) = 0 then
    def := replace(def, 'union all select jsonb_build_object(''kind'', ''OUTWARD''',
      'union all select jsonb_build_object(''kind'', ''INWARD'', ''when'', a.expected_date, ''client'', c2.company_name, ''ref'', a.advice_no) from public.inward_advices a join public.clients c2 on c2.id = a.client_id where a.warehouse_id = p_warehouse_id and a.status = ''ADVISED'' and a.expected_date = today union all select jsonb_build_object(''kind'', ''OUTWARD''');
    execute def;
  end if;
end $$;
