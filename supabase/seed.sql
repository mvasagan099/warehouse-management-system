-- =====================================================================
-- LOCAL DEVELOPMENT SEED ONLY. Never run against the hosted project.
-- Creates one SUPER_ADMIN:  admin@warehouse.local / Admin@12345
-- (the profile row is created by the on_auth_user_created trigger with the
--  role taken from raw_app_meta_data)
-- =====================================================================
do $$
declare
  v_id    uuid := '00000000-0000-0000-0000-00000000a001';
  v_email text := 'admin@warehouse.local';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt('Admin@12345', extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'SUPER_ADMIN'),
    jsonb_build_object('full_name', 'Super Admin'),
    now(), now(), '', '', '', '', '', '', '', ''
  ) on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  ) on conflict do nothing;
end $$;
