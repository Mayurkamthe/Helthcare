/*
 * ╔══════════════════════════════════════════════════════╗
 * ║           MEDICO IoT Device — ESP32                  ║
 * ║   Sensors: MLX90614 (Temp) + MAX30102 (HR + SpO2)   ║
 * ║   Backend:  Node.js / Express + Socket.IO            ║
 * ║   Protocol: HTTP POST  →  /api/iot/vitals            ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Wiring (both sensors share I2C bus):
 * ─────────────────────────────────────
 *  MLX90614   ESP32
 *  VCC    →   3.3V
 *  GND    →   GND
 *  SDA    →   GPIO 21
 *  SCL    →   GPIO 22
 *
 *  MAX30102   ESP32
 *  VCC    →   3.3V
 *  GND    →   GND
 *  SDA    →   GPIO 21   (shared I2C bus)
 *  SCL    →   GPIO 22
 *  INT    →   (optional — not used here)
 *
 * LED indicators:
 *  GPIO 2  = Built-in LED  (WiFi status / heartbeat)
 *  GPIO 4  = Red LED       (alert / critical vitals)
 *
 * Required Libraries (install via Arduino Library Manager):
 *  ─ Adafruit MLX90614 Library   (by Adafruit)
 *  ─ SparkFun MAX3010x Sensor Library (by SparkFun) — supports MAX30102
 *  ─ ArduinoJson                 (by Benoit Blanchon, v6+)
 *  ─ WiFi, HTTPClient            (built-in ESP32 core)
 *
 * Board setup in Arduino IDE:
 *  Tools → Board → "ESP32 Dev Module"
 *  Tools → Upload Speed → 115200
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_MLX90614.h>
#include "MAX30105.h"         // SparkFun MAX3010x library
#include "heartRate.h"        // Part of SparkFun MAX3010x library
#include "spo2_algorithm.h"   // Part of SparkFun MAX3010x library

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURATION — edit these before flashing
// ─────────────────────────────────────────────────────────────────────────────

// WiFi
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Node.js backend  (use http:// for local, https:// for Render/production)
const char* SERVER_HOST   = "http://YOUR_SERVER_IP_OR_DOMAIN";
const int   SERVER_PORT   = 3000;   // Change to 443 for HTTPS on Render

// Device identity — must match device_id assigned in Medico dashboard
const char* DEVICE_ID     = "ESP32-001";

// API Key — must match IOT_API_KEY in your .env file
const char* API_KEY       = "medico-iot-key-2024";

// Intervals (milliseconds)
const unsigned long SEND_INTERVAL_MS        = 10000;  // POST vitals every 10 s
const unsigned long STATUS_CHECK_INTERVAL_MS = 15000; // Poll device-status every 15 s
const unsigned long WIFI_RETRY_INTERVAL_MS   = 30000; // Retry WiFi every 30 s

// MAX30102 SpO2 buffer length (must be 100 for the algorithm)
#define SPO2_BUFFER_LENGTH  100

// ─────────────────────────────────────────────────────────────────────────────
//  PINS
// ─────────────────────────────────────────────────────────────────────────────
const int PIN_LED_STATUS = 2;   // Built-in LED
const int PIN_LED_ALERT  = 4;   // External red LED (optional — tie to GND via 220Ω)

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL OBJECTS
// ─────────────────────────────────────────────────────────────────────────────
Adafruit_MLX90614 mlx;
MAX30105          particleSensor;

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL STATE
// ─────────────────────────────────────────────────────────────────────────────
bool     mlxReady       = false;
bool     maxReady       = false;
bool     isMonitoring   = false;   // Device is assigned to a patient
String   patientName    = "";

float    lastTemp       = 0.0;
int      lastHR         = 0;
int      lastSpO2       = 0;
bool     lastReadingOk  = false;

unsigned long lastSendTime        = 0;
unsigned long lastStatusCheckTime = 0;
unsigned long lastWifiRetry       = 0;

// MAX30102 SpO2 algorithm buffers
uint32_t irBuffer[SPO2_BUFFER_LENGTH];
uint32_t redBuffer[SPO2_BUFFER_LENGTH];
int32_t  spo2Value      = 0;
int8_t   spo2Valid      = 0;
int32_t  heartRateValue = 0;
int8_t   hrValid        = 0;

// ─────────────────────────────────────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(300);

  Serial.println("\n==============================");
  Serial.println("  Medico IoT Device v2.0");
  Serial.println("  Node.js Backend Edition");
  Serial.println("==============================");
  Serial.printf("  Device ID : %s\n", DEVICE_ID);
  Serial.printf("  Server    : %s:%d\n", SERVER_HOST, SERVER_PORT);
  Serial.println("==============================\n");

  // Pins
  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_LED_ALERT,  OUTPUT);
  digitalWrite(PIN_LED_STATUS, LOW);
  digitalWrite(PIN_LED_ALERT,  LOW);

  // I2C
  Wire.begin(21, 22);

  // WiFi
  connectWifi();

  // Sensors
  initMLX90614();
  initMAX30102();

  Serial.println("\n[READY] Polling backend for patient assignment...\n");
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // ── WiFi watchdog ────────────────────────────────────────────────────────
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiRetry > WIFI_RETRY_INTERVAL_MS) {
      lastWifiRetry = now;
      Serial.println("[WIFI] Disconnected — reconnecting...");
      connectWifi();
    }
    blinkLed(PIN_LED_STATUS, 3, 150);
    return;
  }

  // ── Poll backend: is this device assigned? ────────────────────────────────
  if (now - lastStatusCheckTime > STATUS_CHECK_INTERVAL_MS) {
    lastStatusCheckTime = now;
    checkDeviceStatus();
  }

  // ── Sample MAX30102 continuously (algorithm requires steady data) ─────────
  if (maxReady) {
    collectMAX30102Sample();
  }

  // ── Send vitals to server at interval ─────────────────────────────────────
  if (isMonitoring && (now - lastSendTime > SEND_INTERVAL_MS)) {
    lastSendTime = now;

    readTemperature();
    computeSpO2andHR();
    printReadings();
    postVitals();
  }

  // ── LED heartbeat (1 Hz when idle) ───────────────────────────────────────
  if (!isMonitoring) {
    digitalWrite(PIN_LED_STATUS, (now / 1000) % 2 == 0);
    digitalWrite(PIN_LED_ALERT,  LOW);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  WIFI
// ─────────────────────────────────────────────────────────────────────────────
void connectWifi() {
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" CONNECTED");
    Serial.printf("[WIFI] IP: %s\n", WiFi.localIP().toString().c_str());
    digitalWrite(PIN_LED_STATUS, HIGH);
  } else {
    Serial.println(" FAILED — will retry");
    digitalWrite(PIN_LED_STATUS, LOW);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SENSOR INIT
// ─────────────────────────────────────────────────────────────────────────────
void initMLX90614() {
  Serial.print("[SENSOR] MLX90614... ");
  if (mlx.begin()) {
    mlxReady = true;
    Serial.println("OK");
    Serial.printf("  Ambient: %.1f°C  Object: %.1f°C\n",
                  mlx.readAmbientTempC(), mlx.readObjectTempC());
  } else {
    Serial.println("NOT FOUND — check wiring!");
  }
}

void initMAX30102() {
  Serial.print("[SENSOR] MAX30102... ");
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("NOT FOUND — check wiring!");
    return;
  }

  // SparkFun recommended settings for SpO2 + HR
  byte ledBrightness = 60;    // 0=off to 255=50mA
  byte sampleAverage = 4;     // 1, 2, 4, 8, 16, 32
  byte ledMode       = 2;     // 1=Red only, 2=Red+IR, 3=Red+IR+Green
  byte sampleRate    = 100;   // 50, 100, 200, 400, 800, 1000, 1600, 3200
  int  pulseWidth    = 411;   // 69, 118, 215, 411
  int  adcRange      = 4096;  // 2048, 4096, 8192, 16384

  particleSensor.setup(ledBrightness, sampleAverage, ledMode,
                       sampleRate, pulseWidth, adcRange);
  particleSensor.setPulseAmplitudeRed(0x0A);   // Red LED at low power
  particleSensor.setPulseAmplitudeGreen(0);    // No green LED

  maxReady = true;
  Serial.println("OK");

  // Pre-fill buffers with initial samples
  Serial.println("[SENSOR] Warming up MAX30102 (4 seconds — keep finger on sensor)...");
  for (int i = 0; i < SPO2_BUFFER_LENGTH; i++) {
    while (!particleSensor.available()) particleSensor.check();
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i]  = particleSensor.getIR();
    particleSensor.nextSample();
  }
  maxReady = true;
  Serial.println("[SENSOR] MAX30102 warm-up complete");
}

// ─────────────────────────────────────────────────────────────────────────────
//  SENSOR READS
// ─────────────────────────────────────────────────────────────────────────────
void readTemperature() {
  if (!mlxReady) {
    lastTemp = 36.6;  // Fallback value for testing without sensor
    return;
  }

  float raw = mlx.readObjectTempC();

  // Plausibility check — human body 32–42°C range
  if (raw >= 32.0 && raw <= 42.0) {
    lastTemp = raw;
  } else {
    // Retry once
    delay(80);
    raw = mlx.readObjectTempC();
    lastTemp = (raw >= 32.0 && raw <= 42.0) ? raw : lastTemp;
  }
}

void collectMAX30102Sample() {
  // Shift old samples out
  for (int i = 25; i < SPO2_BUFFER_LENGTH; i++) {
    redBuffer[i - 25] = redBuffer[i];
    irBuffer[i - 25]  = irBuffer[i];
  }
  // Collect 25 new samples
  for (int i = 75; i < SPO2_BUFFER_LENGTH; i++) {
    while (!particleSensor.available()) particleSensor.check();
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i]  = particleSensor.getIR();
    particleSensor.nextSample();
  }
}

void computeSpO2andHR() {
  if (!maxReady) {
    // Simulate values for bench testing without sensor
    lastHR   = random(65, 95);
    lastSpO2 = random(96, 100);
    lastReadingOk = true;
    return;
  }

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, SPO2_BUFFER_LENGTH,
    redBuffer,
    &spo2Value, &spo2Valid,
    &heartRateValue, &hrValid
  );

  if (hrValid && spo2Valid) {
    // Apply plausibility filters
    if (heartRateValue >= 40 && heartRateValue <= 200) lastHR   = (int)heartRateValue;
    if (spo2Value      >= 70 && spo2Value      <= 100) lastSpO2 = (int)spo2Value;
    lastReadingOk = (lastHR > 0 && lastSpO2 > 0);
  } else {
    Serial.println("[SENSOR] MAX30102: place finger firmly on sensor");
    lastReadingOk = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  CHECK DEVICE STATUS  →  GET /api/iot/device-status/:deviceId
// ─────────────────────────────────────────────────────────────────────────────
void checkDeviceStatus() {
  String url = String(SERVER_HOST) + ":" + SERVER_PORT +
               "/api/iot/device-status/" + DEVICE_ID;

  HTTPClient http;
  http.begin(url);
  http.setTimeout(8000);

  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, body)) {
      bool active = doc["data"] | false;

      if (active && !isMonitoring) {
        isMonitoring = true;
        Serial.println("\n[STATUS] Device ASSIGNED to patient — monitoring active");
        Serial.println("[STATUS] Sending vitals every " +
                       String(SEND_INTERVAL_MS / 1000) + "s");
        digitalWrite(PIN_LED_STATUS, HIGH);
      } else if (!active && isMonitoring) {
        isMonitoring = false;
        patientName  = "";
        Serial.println("\n[STATUS] Device UNASSIGNED — monitoring stopped");
        digitalWrite(PIN_LED_STATUS, LOW);
        digitalWrite(PIN_LED_ALERT,  LOW);
      }
    }
  } else {
    Serial.printf("[STATUS] Status check failed: HTTP %d\n", code);
  }

  http.end();
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST VITALS  →  POST /api/iot/vitals
//  Node.js VitalController.receiveIoTVitals() processes this
// ─────────────────────────────────────────────────────────────────────────────
void postVitals() {
  if (!lastReadingOk && maxReady) {
    Serial.println("[POST] Skipped — waiting for valid sensor reading");
    return;
  }

  // ── Build JSON payload ────────────────────────────────────────────────────
  StaticJsonDocument<256> doc;
  doc["deviceId"]    = DEVICE_ID;
  doc["heartRate"]   = lastHR;
  doc["spo2"]        = lastSpO2;
  doc["temperature"] = round(lastTemp * 10.0) / 10.0;   // 1 decimal place

  String payload;
  serializeJson(doc, payload);

  // ── HTTP POST ─────────────────────────────────────────────────────────────
  String url = String(SERVER_HOST) + ":" + SERVER_PORT + "/api/iot/vitals";

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Api-Key",    API_KEY);      // Node.js requireApiKey middleware
  http.setTimeout(10000);

  Serial.println("\n[POST] Sending → " + url);
  Serial.println("[POST] Payload:  " + payload);

  int code = http.POST(payload);

  if (code == 200) {
    String response = http.getString();
    StaticJsonDocument<512> resp;

    if (!deserializeJson(resp, response)) {
      const char* name     = resp["data"]["patientName"]  | "Unknown";
      int alerts           = resp["data"]["alertsGenerated"] | 0;
      int matches          = resp["data"]["diseaseMatches"]  | 0;
      const char* severity = resp["data"]["severity"]        | "NORMAL";

      patientName = String(name);

      Serial.println("[POST] OK 200");
      Serial.printf("       Patient  : %s\n", name);
      Serial.printf("       HR       : %d bpm\n",   lastHR);
      Serial.printf("       SpO2     : %d %%\n",    lastSpO2);
      Serial.printf("       Temp     : %.1f °C\n",  lastTemp);
      Serial.printf("       Alerts   : %d\n",       alerts);
      Serial.printf("       Matches  : %d\n",       matches);
      Serial.printf("       Severity : %s\n",       severity);

      // LED feedback
      if (strcmp(severity, "CRITICAL") == 0) {
        blinkLed(PIN_LED_ALERT, 6, 100);
        digitalWrite(PIN_LED_ALERT, HIGH);
        Serial.println("       *** CRITICAL — immediate attention! ***");
      } else if (strcmp(severity, "WARNING") == 0) {
        blinkLed(PIN_LED_ALERT, 3, 200);
        Serial.println("       ** WARNING — monitor closely **");
      } else {
        digitalWrite(PIN_LED_ALERT, LOW);
      }
    }

  } else if (code == 404) {
    // Device unassigned on server side
    Serial.println("[POST] 404 — device not assigned to any patient");
    isMonitoring = false;
    digitalWrite(PIN_LED_STATUS, LOW);

  } else if (code == 401) {
    Serial.println("[POST] 401 — invalid API key! Check API_KEY constant.");

  } else {
    Serial.printf("[POST] HTTP Error: %d\n", code);
    Serial.println("[POST] Response: " + http.getString());
  }

  http.end();
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
void printReadings() {
  Serial.println("\n--- Readings ---");
  Serial.printf("  Temp  : %.1f °C\n", lastTemp);
  Serial.printf("  HR    : %d bpm\n",  lastHR);
  Serial.printf("  SpO2  : %d %%\n",   lastSpO2);
  if (!lastReadingOk) Serial.println("  (sensor still acquiring...)");
  Serial.println("----------------");
}

void blinkLed(int pin, int times, int ms) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH); delay(ms);
    digitalWrite(pin, LOW);  delay(ms);
  }
}
