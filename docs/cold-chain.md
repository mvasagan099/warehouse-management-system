# Cold-chain monitoring (Phase 4)

Sensors send readings over HTTPS to the `ingest-reading` Edge Function. There is no MQTT broker and no always-on server:
Postgres (pg_cron) evaluates alerts every minute, rolls old readings up daily, and `notify-alert` sends the queued messages.

## 1. Register a sensor and get its key

1. **Sensors -> Add sensor**: zone, name, type, and the **serial number** the device will send (print it on the device).
2. **Keys -> New key for this sensor** (or *New gateway key* for one box that reports for several sensors of a warehouse).
   The key (`wms_` + 48 hex characters) is shown **once**; only its SHA-256 hash is stored. **Rotate** replaces it, **Revoke** disables it.
3. Optional: **Calibrate** with a reference thermometer. The offset is added to every new reading; the raw value is stored too.

## 2. Send a reading (curl)

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/ingest-reading' \
  -H 'X-Device-Key: wms_0123456789abcdef...' \
  -H 'Content-Type: application/json' \
  -d '{"sensor":"FRZ-01","value":-19.4,"unit":"C","timestamp":"2026-11-18T09:30:00+05:30"}'
```

Local stack: `http://127.0.0.1:54321/functions/v1/ingest-reading` (start it with `npx supabase functions serve`).

A batch (up to 100 readings, e.g. when the device was offline) is `{"readings":[{...},{...}]}` or a JSON array. Fields:

| Field | Required | Notes |
|---|---|---|
| `sensor` | yes | the serial number registered for the sensor |
| `value` | yes | a number. Temperature -60..80 C, humidity 0..100, door / power / compressor 0 or 1 |
| `timestamp` | no | ISO 8601 with time zone; default = now. At most **10 minutes in the future**; data up to **7 days old** is accepted (offline buffering) |
| `unit` | no | must match the sensor's unit when given |
| `battery` | no | whole number 0-100; below the rule's limit raises a BATTERY_LOW alert |

The key may also be sent as `Authorization: Bearer wms_...` or as `"key"` in the body.

Answers: `200 {"accepted":n,"duplicates":n,"rejected":[{"index":i,"sensor":"..","reason":".."}]}`;
`401` bad / revoked key; `400` malformed request or more than 100 readings; `422` every reading was rejected.
Reasons: `unknown_sensor`, `sensor_not_allowed`, `sensor_retired`, `bad_value`, `unit_mismatch`, `value_out_of_range`, `future_timestamp`, `too_old`, `bad_timestamp`.
Posting the same (sensor, timestamp) again is safe: it is counted as a duplicate.

State sensors: **door** 1 = open, **power** 1 = mains on (0 = failure), **compressor** 1 = running (0 = fault).

## 3. ESP32 sketch

`docs/esp32-ingest/esp32_ingest.ino` reads a DS18B20 probe once a minute, keeps up to 60 unsent readings in memory while Wi-Fi or the
network is down, and posts them in one batch with their original timestamps (NTP time, India offset not needed: it sends UTC).
Edit the Wi-Fi name, the project URL, the sensor serial and the device key at the top.

## 4. What the database does by itself

| Job (pg_cron, UTC) | India time | What |
|---|---|---|
| `wms-evaluate-alerts` `* * * * *` | every minute | opens, escalates and auto-closes alerts from the readings and rules |
| `wms-notify-dispatch` `* * * * *` | every minute | wakes `notify-alert` when messages are queued |
| `wms-readings-rollup` `30 20 * * *` | 02:00 | raw readings older than 30 days -> hourly min / max / avg / count; evidence copied first; old partitions dropped |
| `wms-maintenance-reminders` `30 2 * * *` | 08:00 | reminders 7 and 1 day before a maintenance task is due |

All thresholds are data: `app_settings` key `coldchain` (retention, future / late limits, evidence minutes, default rule values) and per zone in
**Alert Rules** (tolerance, delay, CRITICAL levels, offline minutes, door minutes, humidity range, battery, calibration warning, acknowledge minutes,
defrost windows). A zone's limits default to its own `temp_min` / `temp_max`.

### Notifications

* In-app: the bell in the header. Email: `notify-alert` with the `RESEND_API_KEY` secret and a From address in Billing settings.
* WhatsApp and SMS: feature flags in `app_settings` key `notifications` (`"whatsapp": true`); the provider interface `Notifier` in
  `supabase/functions/_shared/coldchain-rules.ts` has a **stub** only: messages are marked SKIPPED until a real provider is written.
* Let the database call the function (once per environment, as an administrator in the SQL editor):

```sql
select public.set_internal_secret('functions_url', 'https://<project-ref>.supabase.co/functions/v1');
select public.set_internal_secret('cron_secret', '<a long random string>');   -- same value as the CRON_SECRET Edge Function secret
```

### Client notices

When an alert affects a client's stock, a **draft** notice is created per client and managers are told. Nothing reaches the client until a
manager (or administrator) opens the alert, edits the wording if needed and presses **Approve and send**.

## 5. Extension point: MQTT

Do not run a broker inside Supabase. A small bridge (Node, Python, a Raspberry Pi) that subscribes to the broker can forward each message to
`POST /functions/v1/ingest-reading` with the device key, exactly as the curl above. Everything else (validation, idempotency, alerts, roll-up) stays the same.

## 6. Database space

About **150 bytes per reading** (row + primary-key index), measured on 432,000 rows:

| | per sensor |
|---|---|
| one reading per minute, 30 days kept raw | 43,200 rows ≈ **6.5 MB** |
| hourly roll-up, one month | 720 rows ≈ **0.1 MB**; two years ≈ 2.3 MB |

10 sensors at one reading per minute use about 65 MB of raw data at steady state (the free tier has 500 MB). Reading every 5 minutes cuts it by 5.
