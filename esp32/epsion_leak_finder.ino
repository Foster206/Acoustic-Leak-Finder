/*
  EPSION Acoustic Leak Finder
  LM358L output -> GPIO34 (ADC), GPIO25 -> leak indicator LED.
  The LM386L 9 V headphone amplifier is intentionally not part of this signal path.
*/

#include <WiFi.h>
#include <WebServer.h>

// ---- Editable instrument settings -------------------------------------------------
const float NORMAL_THRESHOLD = 10.0f;   // RMS ADC counts
const float WARNING_THRESHOLD = 30.0f;  // RMS ADC counts
const uint16_t SAMPLE_RATE_HZ = 1000;
const uint16_t FFT_SIZE = 128;

const int ADC_PIN = 34;
const int LED_PIN = 25;
const char *AP_SSID = "EPSION-LEAK-FINDER";
const char *AP_PASSWORD = "EPSION123";

// Treat a railed, disconnected, or flat ADC input as invalid rather than a leak.
// Adjust these only after observing a healthy sensor on the target hardware.
const int ADC_RAIL_MARGIN = 8;
const int MIN_VALID_PEAK_TO_PEAK = 2;

WebServer server(80);

float samples[FFT_SIZE];
float fftReal[FFT_SIZE];
float fftImag[FFT_SIZE];
float latestRms = 0.0f;
float latestFrequency = 0.0f;
bool latestSensorOk = false;
const char *latestStatus = "SENSOR FAULT";

void fft(float real[], float imag[], uint16_t size) {
  // In-place radix-2 Cooley-Tukey FFT. FFT_SIZE must be a power of two.
  for (uint16_t i = 1, j = 0; i < size; ++i) {
    uint16_t bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      float temp = real[i]; real[i] = real[j]; real[j] = temp;
      temp = imag[i]; imag[i] = imag[j]; imag[j] = temp;
    }
  }

  for (uint16_t length = 2; length <= size; length <<= 1) {
    const float angle = -2.0f * PI / length;
    const float wLengthReal = cosf(angle);
    const float wLengthImag = sinf(angle);
    for (uint16_t start = 0; start < size; start += length) {
      float wReal = 1.0f;
      float wImag = 0.0f;
      const uint16_t half = length >> 1;
      for (uint16_t offset = 0; offset < half; ++offset) {
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

const char *classify(float rms, bool sensorOk) {
  if (!sensorOk) return "SENSOR FAULT";
  if (rms < NORMAL_THRESHOLD) return "NORMAL";
  if (rms < WARNING_THRESHOLD) return "WARNING";
  return "LEAK DETECTED";
}

void captureAndAnalyse() {
  uint32_t sum = 0;
  int minimum = 4095;
  int maximum = 0;
  const uint32_t intervalUs = 1000000UL / SAMPLE_RATE_HZ;
  uint32_t nextSampleUs = micros();

  for (uint16_t i = 0; i < FFT_SIZE; ++i) {
    while ((int32_t)(micros() - nextSampleUs) < 0) delayMicroseconds(10);
    const int raw = analogRead(ADC_PIN);
    samples[i] = raw;
    sum += raw;
    if (raw < minimum) minimum = raw;
    if (raw > maximum) maximum = raw;
    nextSampleUs += intervalUs;
  }

  const float dcBias = (float)sum / FFT_SIZE;
  float sumSquares = 0.0f;
  for (uint16_t i = 0; i < FFT_SIZE; ++i) {
    const float centered = samples[i] - dcBias;  // Remove DC for both RMS and FFT.
    sumSquares += centered * centered;
    // Hann window limits spectral leakage; it does not affect RMS above.
    const float window = 0.5f * (1.0f - cosf(2.0f * PI * i / (FFT_SIZE - 1)));
    fftReal[i] = centered * window;
    fftImag[i] = 0.0f;
  }

  latestSensorOk = minimum > ADC_RAIL_MARGIN &&
                   maximum < (4095 - ADC_RAIL_MARGIN) &&
                   (maximum - minimum) >= MIN_VALID_PEAK_TO_PEAK;

  if (!latestSensorOk) {
    latestRms = 0.0f;
    latestFrequency = 0.0f;
    latestStatus = classify(latestRms, false);
  } else {
    latestRms = sqrtf(sumSquares / FFT_SIZE);
    fft(fftReal, fftImag, FFT_SIZE);
    float greatestMagnitude = 0.0f;
    uint16_t dominantBin = 0;
    for (uint16_t bin = 1; bin < FFT_SIZE / 2; ++bin) {  // Skip DC bin.
      const float magnitude = fftReal[bin] * fftReal[bin] + fftImag[bin] * fftImag[bin];
      if (magnitude > greatestMagnitude) {
        greatestMagnitude = magnitude;
        dominantBin = bin;
      }
    }
    latestFrequency = (float)dominantBin * SAMPLE_RATE_HZ / FFT_SIZE;
    latestStatus = classify(latestRms, true);
  }

  digitalWrite(LED_PIN, strcmp(latestStatus, "LEAK DETECTED") == 0 ? HIGH : LOW);
  Serial.printf("RMS: %.1f | Freq: %.1f Hz | %s\n", latestRms, latestFrequency, latestStatus);
}

void handleApiData() {
  char response[192];
  snprintf(response, sizeof(response),
           "{\"rms\":%.1f,\"frequency\":%.1f,\"status\":\"%s\","
           "\"wifi\":true,\"sensor\":%s,\"samplingRate\":%u}",
           latestRms, latestFrequency, latestStatus,
           latestSensorOk ? "true" : "false", SAMPLE_RATE_HZ);
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", response);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  analogReadResolution(12);
  analogSetPinAttenuation(ADC_PIN, ADC_11db);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  Serial.print("Access point IP: ");
  Serial.println(WiFi.softAPIP());

  server.on("/api/data", HTTP_GET, handleApiData);
  server.onNotFound([]() { server.send(404, "text/plain", "Not found"); });
  server.begin();
  Serial.println("EPSION Acoustic Leak Finder ready");
}

void loop() {
  server.handleClient();
  captureAndAnalyse();
}
