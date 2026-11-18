// ESP32 cold-chain reading sender (Arduino core for ESP32). Libraries: OneWire, DallasTemperature (DS18B20 probe on GPIO 4 with a 4.7k pull-up).
// Posts to the ingest-reading Edge Function every minute, keeps unsent readings while offline and sends them later with their original times.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>

// ---- edit these ----
const char* WIFI_SSID = "your-wifi";
const char* WIFI_PASS = "your-password";
const char* INGEST_URL = "https://YOUR-PROJECT-REF.supabase.co/functions/v1/ingest-reading";
const char* DEVICE_KEY = "wms_paste_the_key_shown_once";     // Sensors -> Keys in the app
const char* SENSOR_SERIAL = "FRZ-01";                         // the serial number registered in the app
const unsigned long INTERVAL_MS = 60UL * 1000UL;              // one reading per minute
// ---------------------

const int ONE_WIRE_PIN = 4;
OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature probe(&oneWire);

struct Reading { time_t t; float v; };
const int MAX_BUFFER = 60;                                     // up to an hour of readings kept in RAM while offline (max 100 per post)
Reading buffer[MAX_BUFFER];
int count = 0;
unsigned long lastRead = 0;

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 20 && WiFi.status() != WL_CONNECTED; i++) delay(500);
}

bool clockReady() { return time(nullptr) > 1700000000; }       // NTP has set the clock

void addReading(float v) {
  if (count == MAX_BUFFER) { memmove(buffer, buffer + 1, sizeof(Reading) * (MAX_BUFFER - 1)); count--; }   // drop the oldest
  buffer[count++] = { time(nullptr), v };
}

String iso(time_t t) {
  struct tm tmv; gmtime_r(&t, &tmv);
  char s[25]; strftime(s, sizeof(s), "%Y-%m-%dT%H:%M:%SZ", &tmv);
  return String(s);
}

bool postBuffer() {
  if (count == 0) return true;
  String body = "{\"readings\":[";
  for (int i = 0; i < count; i++) {
    if (i) body += ",";
    body += "{\"sensor\":\"" + String(SENSOR_SERIAL) + "\",\"value\":" + String(buffer[i].v, 2) + ",\"unit\":\"C\",\"timestamp\":\"" + iso(buffer[i].t) + "\"}";
  }
  body += "]}";
  WiFiClientSecure client;
  client.setInsecure();   // for production pin the certificate with client.setCACert(...)
  HTTPClient http;
  http.begin(client, INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST(body);
  http.end();
  // 200 = stored (or duplicates). 422 = every reading was rejected: do not retry forever, drop them. Anything else: keep and retry.
  if (code == 200 || code == 422) { count = 0; return true; }
  return false;
}

void setup() {
  Serial.begin(115200);
  probe.begin();
  connectWifi();
  configTime(0, 0, "pool.ntp.org", "time.google.com");
}

void loop() {
  if (millis() - lastRead >= INTERVAL_MS || lastRead == 0) {
    lastRead = millis();
    probe.requestTemperatures();
    float c = probe.getTempCByIndex(0);
    if (c > -100 && clockReady()) addReading(c);                // -127 means the probe is not connected
    connectWifi();
    if (WiFi.status() == WL_CONNECTED) {
      bool ok = postBuffer();
      Serial.printf("temp %.2f C, %s, buffered %d\n", c, ok ? "sent" : "will retry", count);
    }
  }
  delay(200);
}
