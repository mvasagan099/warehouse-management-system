-- Reference data needed in every environment (local and hosted).
-- Dimensions are data, not code: admins can edit them from the Brigade Types page.
insert into public.brigade_types (name, description, length_m, width_m, height_m, max_weight_kg, is_default)
values ('Standard Brigade', 'Default storage unit, 1.2 m cube', 1.2, 1.2, 1.2, 1000, true)
on conflict (name) do nothing;
