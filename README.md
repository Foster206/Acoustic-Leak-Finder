# Acoustic Leak Finder

An ESP32-based acoustic leak detection system with a lightweight web dashboard for real-time monitoring of acoustic measurements.

## Overview

Acoustic Leak Finder uses an ESP32 to acquire acoustic sensor data and process the signal to obtain RMS and dominant-frequency measurements.

The ESP32 provides the processed measurements through a local HTTP API. A browser-based dashboard connects to the ESP32 and displays the current measurements, device classification, sensor state, Wi-Fi state, sampling rate, API response time, and recent measurement history.

The system is designed to operate locally without requiring cloud infrastructure.

## Features

### ESP32

- Acoustic signal acquisition
- RMS measurement
- Dominant frequency measurement
- Firmware-based device classification
- Sensor status monitoring
- Wi-Fi status monitoring
- Configurable sampling rate
- Local Wi-Fi access point
- HTTP API for real-time measurements

### Web Dashboard

- Responsive, mobile-first interface
- Real-time RMS display
- Dominant frequency display
- Device classification
- Sensor and Wi-Fi status
- Sampling rate
- API response time
- Recent RMS history
- Recent frequency history
- Automatic connection recovery
- Offline indication

## System Architecture

```text
Acoustic Source / Possible Leak
            │
            ▼
     Acoustic Sensor
            │
            ▼
          ESP32
     ┌──────┼──────────┐
     │      │          │
 Signal    RMS     Frequency
Acquisition       Analysis
     │      │          │
     └──────┼──────────┘
            │
     Classification
            │
            ▼
       HTTP / Wi-Fi
            │
            ▼
      Web Dashboard
Hardware
Component	Purpose
ESP32	Main microcontroller and wireless interface
Acoustic Sensor	Captures acoustic/vibration signals
Power Supply	Provides power to the system
Supporting Components	Signal conditioning and interfacing

Hardware configuration may change between prototype revisions.

Software
Firmware
ESP32
Arduino/C++
Wi-Fi Access Point
HTTP API
Acoustic signal processing
Web Interface
HTML
CSS
JavaScript
HTML5 Canvas

The web interface has no external JavaScript dependencies or build step.

Measurements
RMS

RMS represents the measured magnitude of the acoustic signal.

The API does not currently define a physical RMS unit. Therefore, the displayed RMS values are not represented as decibels (dB).

Dominant Frequency

The dominant frequency represents the primary frequency detected from the measured acoustic signal.

Device Classification

Classification is determined by the ESP32 firmware.

Possible states are:

NORMAL
WARNING
LEAK DETECTED
SENSOR FAULT

The frontend displays the classification provided by the firmware and does not override it.

API

The ESP32 provides the following endpoint:

GET http://192.168.4.1/api/data

Example response:

{
  "rms": 5.9,
  "frequency": 0.0,
  "status": "NORMAL",
  "wifi": true,
  "sensor": true,
  "samplingRate": 1000
}
API Fields
Field	Type	Description
rms	Number	Current RMS measurement
frequency	Number	Dominant frequency
status	String	Firmware classification
wifi	Boolean	Wi-Fi state
sensor	Boolean	Sensor state
samplingRate	Integer	Current sampling rate

RMS and frequency values must be finite, non-negative numbers.

The sampling rate must be a positive integer.

Wi-Fi and sensor states are represented as boolean values.

If the sensor is unavailable, the firmware reports:

SENSOR FAULT

and unreliable measurements are suppressed.

Running the Dashboard

The dashboard files are located in the web/ directory.

1. Start the ESP32

Power on the ESP32 and allow it to create its local Wi-Fi access point.

2. Connect to the ESP32

Connect the computer or phone to the Wi-Fi network configured by the ESP32.

The Wi-Fi credentials are configured in the firmware and are not included in this repository.

3. Start a Local Server

Open a terminal in the web/ directory and run:

python -m http.server 8080

Then open:

http://localhost:8080

in a browser.

4. ESP32 API

The dashboard communicates with:

http://192.168.4.1/api/data

The 192.168.4.1 address is the local address assigned to the ESP32 access point.

Browser Networking

When the dashboard is served from localhost and the API is running on the ESP32 at 192.168.4.1, they operate on different origins.

The ESP32 API therefore needs to permit the dashboard origin through CORS.

Depending on the browser and hosting environment, HTTPS pages may also be prevented from accessing the HTTP ESP32 endpoint because of browser security policies.

If the browser blocks the request, this does not necessarily indicate a hardware or API failure.

Data Polling and Error Handling

The dashboard requests new measurements approximately every 500 ms.

Requests are non-overlapping and have a timeout of 1.5 seconds, including the time required to read the response body.

If a request fails, the JSON is invalid, or required fields are missing or malformed, the dashboard displays:

ESP32 OFFLINE

and clears the current readings and history.

The dashboard automatically retries the connection.

A valid response restores live monitoring.

Browsers may throttle timers when the page is running in the background.

Project Structure
Acoustic-Leak-Finder/
│
├── esp32/
│   └── ...
│
├── web/
│   ├── index.html
│   ├── script.js
│   └── style.css
│
└── README.md
Development

The project is developed locally and the repository is synchronized with GitHub and GitLab.

                 Local Repository
                       │
                    Commit
                       │
                  Push origin
                   /        \
                  /          \
                 ▼            ▼
              GitHub        GitLab

The local repository is the primary development workspace.

Current Status

Version: 1.0
Platform: ESP32
Application: Acoustic Leak Detection
Interface: Web Dashboard
Connectivity: Local Wi-Fi
API: HTTP

The current version is a prototype focused on real-time acoustic measurement, device classification, and local dashboard monitoring.

Future Work

Possible improvements include:

Improved acoustic leak classification
Noise filtering
Sensor calibration
More robust frequency analysis
Leak-location estimation
Long-term data logging
Multiple sensor support
Battery-powered operation
Improved enclosure for field deployment
Machine-learning-based classification
License

This project is licensed under the MIT License. See the LICENSE file for details.