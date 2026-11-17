-- Trigger functions are never meant to be called through the API (/rest/v1/rpc/...).
-- Postgres refuses to run them outside a trigger anyway; this removes the exposure
-- flagged by the Supabase security advisor. Triggers keep firing: EXECUTE is only
-- checked when a trigger is created, not when it fires.
do $$
declare f text;
begin
  foreach f in array array[
    'set_updated_at()', 'slot_sync_warehouse()', 'applicant_sync_warehouse()', 'zone_default_code()',
    'handle_new_user()', 'handle_user_app_metadata()', 'profiles_guard()', 'audit_row_change()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
