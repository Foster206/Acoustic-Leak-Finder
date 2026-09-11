/*
  EPSION Acoustic Leak Finder — initial ESP32 firmware scaffold.
  The ESP32 will own microphone sampling, RMS calculation, FFT analysis, and the API.
*/

const unsigned long SAMPLE_RATE_HZ = 1000;

void setup() {
  Serial.begin(115200);
  // TODO: configure the acoustic sensor / ADC input.
  Serial.println("EPSION Acoustic Leak Finder starting");
}

void loop() {
  // TODO: sample microphone data, calculate RMS and dominant frequency using FFT.
  // Keep this loop non-blocking when the web server is added.
}

/*
  ===== FUTURE WI-FI / API INTEGRATION =====
  1. Connect the ESP32 to Wi-Fi.
  2. Start an HTTP server.
  3. Implement GET /api/data with JSON in this shape:
     {"rms":52.4,"frequency":101.6,"status":"WARNING",
      "wifi":true,"sensor":true,"samplingRate":1000}
  4. Optionally add endpoints that provide real waveform samples and FFT bins.
     The browser dashboard deliberately labels its traces as display-only until then.
*/
