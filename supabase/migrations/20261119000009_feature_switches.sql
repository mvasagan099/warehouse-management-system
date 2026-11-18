-- Feature switches the administrator can turn off for now (System health page). Off = hidden from menus and blocked.
insert into public.app_settings (key, value, description) values
  ('features', '{"sensors": false, "qr": false, "coldChain": false}', 'Switch parts of the app on or off: sensors, QR labels and scanning, live cold chain')
on conflict (key) do nothing;
