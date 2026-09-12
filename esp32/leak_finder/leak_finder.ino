/*
  Acoustic Leak Finder
  --------------------------------
  LM358L output -> GPIO34 (ADC)
  GPIO25 -> leak indicator LED

  LM386 headphone amplifier is intentionally
  separate from this ESP32 signal path.

  Standalone Web Dashboard:
    Wi-Fi AP : Acoustic-Leak-Finder
    Address  : http://192.168.4.1

  LittleFS files:
    /index.html
    /style.css
    /script.js

  By Pradatto Pal
*/

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>
#include <math.h>
#include <string.h>

// ==================================================
// INSTRUMENT SETTINGS
// ==================================================

const float NORMAL_THRESHOLD = 10.0f;
const float WARNING_THRESHOLD = 30.0f;

const uint16_t SAMPLE_RATE_HZ = 1000;
const uint16_t FFT_SIZE = 128;

const int ADC_PIN = 34;
const int LED_PIN = 25;

// ==================================================
// WIFI ACCESS POINT
// ==================================================

// Set your real password locally before flashing.
// Do not commit the real password to the repository.
const char *AP_SSID = "Acoustic-Leak-Finder";
const char *AP_PASSWORD = "YOUR_WIFI_PASSWORD";

// ==================================================
// SENSOR VALIDATION
// ==================================================

const int ADC_RAIL_MARGIN = 8;
const int MIN_VALID_PEAK_TO_PEAK = 2;

// ==================================================
// WEB SERVER
// ==================================================

WebServer server(80);

// ==================================================
// FFT / SIGNAL ARRAYS
// ==================================================

float samples[FFT_SIZE];
float fftReal[FFT_SIZE];
float fftImag[FFT_SIZE];

// Hann window, computed once in setup()
float hannWindow[FFT_SIZE];

// ==================================================
// LATEST MEASUREMENTS
// ==================================================

float latestRms = 0.0f;
float latestFrequency = 0.0f;

bool latestSensorOk = false;

const char *latestStatus = "SENSOR FAULT";

// ==================================================
// FFT
// ==================================================

void fft(float real[], float imag[], uint16_t size)
{
  // In-place radix-2 Cooley-Tukey FFT.
  // FFT_SIZE must be a power of two.

  for (uint16_t i = 1, j = 0; i < size; ++i)
  {
    uint16_t bit = size >> 1;

    for (; j & bit; bit >>= 1)
    {
      j ^= bit;
    }

    j ^= bit;

    if (i < j)
    {
      float temp = real[i];
      real[i] = real[j];
      real[j] = temp;

      temp = imag[i];
      imag[i] = imag[j];
      imag[j] = temp;
    }
  }

  for (uint16_t length = 2; length <= size; length <<= 1)
  {
    const float angle = -2.0f * (float)M_PI / length;

    const float wLengthReal = cosf(angle);
    const float wLengthImag = sinf(angle);

    for (uint16_t start = 0; start < size; start += length)
    {
      float wReal = 1.0f;
      float wImag = 0.0f;

      const uint16_t half = length >> 1;

      for (uint16_t offset = 0; offset < half; ++offset)
      {
        const uint16_t even = start + offset;
        const uint16_t odd = even + half;

        const float oddReal = real[odd] * wReal - imag[odd] * wImag;
        const float oddImag = real[odd] * wImag + imag[odd] * wReal;

        real[odd] = real[even] - oddReal;
        imag[odd] = imag[even] - oddImag;

        real[even] += oddReal;
        imag[even] += oddImag;

        const float nextWReal = wReal * wLengthReal - wImag * wLengthImag;
        wImag = wReal * wLengthImag + wImag * wLengthReal;
        wReal = nextWReal;
      }
    }
  }
}

// ==================================================
// CLASSIFICATION
// ==================================================

const char *classify(float rms, bool sensorOk)
{
  if (!sensorOk)
  {
    return "SENSOR FAULT";
  }

  if (rms < NORMAL_THRESHOLD)
  {
    return "NORMAL";
  }

  if (rms < WARNING_THRESHOLD)
  {
    return "WARNING";
  }

  return "LEAK DETECTED";
}

// ==================================================
// CAPTURE + SIGNAL ANALYSIS
// ==================================================

void captureAndAnalyse()
{
  uint32_t sum = 0;

  int minimum = 4095;
  int maximum = 0;

  const uint32_t intervalUs = 1000000UL / SAMPLE_RATE_HZ;

  uint32_t nextSampleUs = micros();

  // -----------------------------------------------
  // SAMPLE SIGNAL  (blocks for FFT_SIZE / SAMPLE_RATE_HZ
  //                 = 128 ms per frame)
  // -----------------------------------------------

  for (uint16_t i = 0; i < FFT_SIZE; ++i)
  {
    while ((int32_t)(micros() - nextSampleUs) < 0)
    {
      delayMicroseconds(10);
    }

    const int raw = analogRead(ADC_PIN);

    samples[i] = raw;
    sum += raw;

    if (raw < minimum) minimum = raw;
    if (raw > maximum) maximum = raw;

    nextSampleUs += intervalUs;
  }

  // -----------------------------------------------
  // REMOVE DC / BIAS
  // -----------------------------------------------

  const float dcBias = (float)sum / FFT_SIZE;

  float sumSquares = 0.0f;

  for (uint16_t i = 0; i < FFT_SIZE; ++i)
  {
    const float centered = samples[i] - dcBias;

    // RMS accumulation
    sumSquares += centered * centered;

    // Windowed input for FFT
    fftReal[i] = centered * hannWindow[i];
    fftImag[i] = 0.0f;
  }

  // -----------------------------------------------
  // SENSOR VALIDATION
  // -----------------------------------------------

  latestSensorOk =
    minimum > ADC_RAIL_MARGIN &&
    maximum < (4095 - ADC_RAIL_MARGIN) &&
    (maximum - minimum) >= MIN_VALID_PEAK_TO_PEAK;

  // -----------------------------------------------
  // SENSOR FAULT
  // -----------------------------------------------

  if (!latestSensorOk)
  {
    latestRms = 0.0f;
    latestFrequency = 0.0f;
    latestStatus = classify(0.0f, false);

    digitalWrite(LED_PIN, LOW);
  }

  // -----------------------------------------------
  // NORMAL SIGNAL ANALYSIS
  // -----------------------------------------------

  else
  {
    latestRms = sqrtf(sumSquares / FFT_SIZE);

    // ---------------------------------------------
    // FREQUENCY ANALYSIS
    // ---------------------------------------------

    if (latestRms < NORMAL_THRESHOLD)
    {
      latestFrequency = 0.0f;
    }
    else
    {
      fft(fftReal, fftImag, FFT_SIZE);

      // Find dominant bin (skip DC, stop at Nyquist)
      float greatestMagnitude = 0.0f;
      uint16_t dominantBin = 0;

      for (uint16_t bin = 1; bin < FFT_SIZE / 2; ++bin)
      {
        const float magnitude =
          fftReal[bin] * fftReal[bin] +
          fftImag[bin] * fftImag[bin];

        if (magnitude > greatestMagnitude)
        {
          greatestMagnitude = magnitude;
          dominantBin = bin;
        }
      }

      // Frequency resolution: 1000 / 128 = 7.8125 Hz per bin
      latestFrequency = (float)dominantBin * SAMPLE_RATE_HZ / FFT_SIZE;
    }

    // ---------------------------------------------
    // CLASSIFY + LEAK LED
    // ---------------------------------------------

    latestStatus = classify(latestRms, true);

    digitalWrite(
      LED_PIN,
      strcmp(latestStatus, "LEAK DETECTED") == 0 ? HIGH : LOW
    );
  }

  // -----------------------------------------------
  // SERIAL MONITOR
  // -----------------------------------------------

  Serial.printf(
    "RMS: %.1f | Freq: %.1f Hz | %s\n",
    latestRms,
    latestFrequency,
    latestStatus
  );
}

// ==================================================
// API: /api/data
// ==================================================

void handleApiData()
{
  char response[192];

  // True when at least one device is connected
  // to the ESP32 access point.
  const bool wifiConnected = WiFi.softAPgetStationNum() > 0;

  snprintf(
    response,
    sizeof(response),
    "{\"rms\":%.1f,"
    "\"frequency\":%.1f,"
    "\"status\":\"%s\","
    "\"wifi\":%s,"
    "\"sensor\":%s,"
    "\"samplingRate\":%u}",
    latestRms,
    latestFrequency,
    latestStatus,
    wifiConnected ? "true" : "false",
    latestSensorOk ? "true" : "false",
    SAMPLE_RATE_HZ
  );

  // Never cache live data
  server.sendHeader("Cache-Control", "no-store");

  // Allow the dashboard to be opened from a local file
  // or another host during development
  server.sendHeader("Access-Control-Allow-Origin", "*");

  server.send(200, "application/json", response);
}

// ==================================================
// STATIC FILE SERVER
// ==================================================

const char *contentTypeFor(const String &path)
{
  // charset is declared explicitly because script.js and
  // style.css contain non-ASCII characters (●, –, —).
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css"))  return "text/css; charset=utf-8";
  if (path.endsWith(".js"))   return "text/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg"))  return "image/svg+xml";
  if (path.endsWith(".png"))  return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".ico"))  return "image/x-icon";

  return "text/plain; charset=utf-8";
}

void handleFile(String path)
{
  // If browser requests "/", serve index.html
  if (path == "/")
  {
    path = "/index.html";
  }

  // Security: reject paths trying to escape the filesystem
  if (path.indexOf("..") >= 0)
  {
    server.send(400, "text/plain", "Bad request");
    return;
  }

  if (!LittleFS.exists(path))
  {
    server.send(404, "text/plain", "File not found");
    return;
  }

  File file = LittleFS.open(path, "r");

  if (!file)
  {
    server.send(500, "text/plain", "Failed to open file");
    return;
  }

  // Force the browser to re-fetch after the LittleFS image
  // is re-uploaded, so updated HTML/CSS/JS is never stale.
  server.sendHeader("Cache-Control", "no-cache");

  server.streamFile(file, contentTypeFor(path));

  file.close();
}

// ==================================================
// ROOT WEBSITE
// ==================================================

void handleRoot()
{
  handleFile("/");
}

// ==================================================
// NOT FOUND
// ==================================================

void handleNotFound()
{
  // API requests get a JSON 404
  if (server.uri().startsWith("/api/"))
  {
    server.send(404, "application/json", "{\"error\":\"Not found\"}");
    return;
  }

  // Try serving a static file
  handleFile(server.uri());
}

// ==================================================
// SETUP
// ==================================================

void setup()
{
  Serial.begin(115200);

  // -----------------------------------------------
  // LED
  // -----------------------------------------------

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // -----------------------------------------------
  // ADC
  // -----------------------------------------------

  analogReadResolution(12);
  analogSetPinAttenuation(ADC_PIN, ADC_11db);

  // -----------------------------------------------
  // HANN WINDOW (precomputed)
  // -----------------------------------------------

  for (uint16_t i = 0; i < FFT_SIZE; ++i)
  {
    hannWindow[i] =
      0.5f * (1.0f - cosf(2.0f * (float)M_PI * i / (FFT_SIZE - 1)));
  }

  // -----------------------------------------------
  // LITTLEFS
  // -----------------------------------------------

  Serial.println();
  Serial.println("Mounting LittleFS...");

  if (!LittleFS.begin(true))
  {
    Serial.println("ERROR: LittleFS mount failed!");
  }
  else
  {
    Serial.println("LittleFS mounted successfully.");

    // Report which dashboard files are actually present
    const char *files[] = { "/index.html", "/style.css", "/script.js" };

    for (const char *f : files)
    {
      Serial.printf(
        "  %-12s %s\n",
        f,
        LittleFS.exists(f) ? "OK" : "MISSING"
      );
    }
  }

  // -----------------------------------------------
  // WIFI ACCESS POINT
  // -----------------------------------------------

  WiFi.mode(WIFI_AP);

  const bool apStarted = WiFi.softAP(AP_SSID, AP_PASSWORD);

  Serial.println();
  Serial.println("================================");
  Serial.println("   ACOUSTIC LEAK FINDER");
  Serial.println("================================");
  Serial.printf("ADC  : GPIO%d\n", ADC_PIN);
  Serial.printf("LED  : GPIO%d\n", LED_PIN);
  Serial.printf("FS   : %u Hz\n", SAMPLE_RATE_HZ);
  Serial.printf("N    : %u\n", FFT_SIZE);

  if (!apStarted)
  {
    Serial.println("Wi-Fi AP FAILED");
  }
  else
  {
    Serial.println();
    Serial.println("Wi-Fi AP started");
    Serial.printf("SSID : %s\n", AP_SSID);
    Serial.printf("IP   : %s\n", WiFi.softAPIP().toString().c_str());
  }

  // -----------------------------------------------
  // WEB SERVER ROUTES
  // -----------------------------------------------

  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/data", HTTP_GET, handleApiData);
  server.onNotFound(handleNotFound);

  server.begin();

  // Report the real AP address rather than a hard-coded one
  const String base = "http://" + WiFi.softAPIP().toString();

  Serial.println();
  Serial.println("HTTP server started");
  Serial.printf("Dashboard: %s\n", base.c_str());
  Serial.printf("API      : %s/api/data\n", base.c_str());
  Serial.println();
  Serial.println("Acoustic Leak Finder ready");
  Serial.println();
}

// ==================================================
// MAIN LOOP
// ==================================================

void loop()
{
  // Handle browser requests
  server.handleClient();

  // Capture and analyse one 128 ms frame
  captureAndAnalyse();
}

