Acoustic Leak Finder
Version 1 provides a dependency-free, mobile-first dashboard for the ESP32 acoustic leak detector. The EPSION instrument layout displays live root mean square (RMS), dominant frequency, device classification, sensor and Wi-Fi state, sampling rate, and API response time. Charts present recent measured RMS and frequency history, rather than simulated waveform samples or fast Fourier transform (FFT) bins. The API does not specify RMS units, and values are not labeled in decibels (dB).
Run locally
To serve the files from the web/ directory, use a local static server. For example:



python -m http.server 8080

Next, open http://localhost:8080 on the same computer. No build step, external assets, or JavaScript dependencies are required. The API URL is hard-coded to the ESP32 address (http://192.168.4.1/api/data), not the static server's /api/data path.
Live ESP32 Dashboard

Power the ESP32.
Connect the computer/phone to LEAK-FINDER.
Enter password LF1.
Access the website using a compatible serving setup as described below.
The browser communicates with http://192.168.4.1/api/data, targeting one request every 500 ms.

The address 192.168.4.1 is assigned by the physical ESP32 access point. Only the browser of the connected user can access this address; GitLab or cloud infrastructure does not require access. Maintain the device's connection to this Wi-Fi network even if it indicates no internet access. On a mobile device, localhost refers to the device itself, not to a separate computer.
Browser serving requirements: The local static server and the ESP32 operate on different origins. The API must permit the website's origin through Cross-Origin Resource Sharing (CORS) for the browser to access its response. An HTTPS-hosted website may be blocked from accessing this HTTP endpoint due to mixed-content or local-network policies; localhost does not universally bypass local-network restrictions. Grant local-network access if prompted by the browser.
Use one of these setups:

An HTTP serving setup with API CORS permission, or
Same-origin hosting at http://192.168.4.1 if the device supports serving these website files (the API URL is already same-origin in that case).

This repository does not deploy the website to the device. If neither setup is available, there is no frontend-only solution: JavaScript cannot grant CORS permission or circumvent browser policy, and no-cors mode does not provide readable JSON. The firmware remains unchanged. A blocked request does not necessarily indicate a malfunctioning physical API.
API contract
GET http://192.168.4.1/api/data should return:



{"rms":5.9,"frequency":0.0,"status":"NORMAL","wifi":true,"sensor":true,"samplingRate":1000}

All six fields are required. RMS and frequency values must be finite, non-negative numbers (zero is valid), the sampling rate must be a positive integer, and Wi-Fi and sensor flags must be boolean values. Classification is determined by the ESP32 and may be NORMAL, WARNING, LEAK DETECTED, or SENSOR FAULT. A false sensor flag also results in SENSOR FAULT and suppresses unreliable measurements. Frontend RMS thresholds do not override firmware classification.
Requests are non-overlapping and time out after 1.5 seconds, including the time required to read the response body. Slow requests decrease the polling rate, and browsers running in the background may throttle timers. Failures, invalid JSON, or malformed or missing fields result in the display of ESP32 OFFLINE, clearing of readings and history, and automatic retries. Offline sensor or Wi-Fi states are indicated as UNKNOWN and do not serve as device diagnostics. A valid response restores live monitoring automatically. Returning to a backgrounded tab clears previous values and refreshes the connection.

Changes made: fixed the python -m http.server 8080 command, clarified the fixed API URL wording, added consistent code formatting/headings, and tightened the same-origin note.
Want me to commit this? Share the project (path or URL) and the target file (e.g. web/README.md) and I'll create a commit and merge request.


Yes. If this is your personal project/repository, then remove the team/event branding entirely from the README. The project should present itself as EPSION Acoustic Leak Finder only if EPSION is actually part of the project name; otherwise, I'd remove that too.
For a clean public portfolio, use:

Copy to clipboard
Insert at cursor
# Acoustic Leak Finder

> An ESP32-based acoustic water leak detection system with real-time signal monitoring and a mobile-first web dashboard.

## 🚀 Overview

**Acoustic Leak Finder** is an IoT-based acoustic water leak detection system designed to identify and monitor potential water leaks through acoustic signals.

The system uses an **ESP32** to acquire acoustic sensor data, process the signal, determine device status, and provide measurements through a lightweight HTTP API.

A responsive web dashboard connects to the ESP32 and displays measurements in real time, allowing monitoring from a computer or mobile device.

---

## 🎯 Project Goals

- Detect acoustic patterns associated with water leakage.
- Acquire and process acoustic signals using an ESP32.
- Determine device classification from processed measurements.
- Provide real-time measurement data through an HTTP API.
- Display measurements through a responsive web dashboard.
- Operate locally without requiring cloud infrastructure.
- Provide a simple interface suitable for desktop and mobile devices.

---

## ✨ Features

### ESP32 System

- Acoustic signal acquisition
- RMS measurement
- Dominant frequency measurement
- Firmware-based device classification
- Sensor health monitoring
- Wi-Fi status monitoring
- Configurable sampling rate
- Local Wi-Fi access point
- HTTP API for real-time measurements

### Web Dashboard

- Mobile-first responsive interface
- Real-time RMS display
- Dominant frequency display
- Device status indicator
- Sensor status
- Wi-Fi status
- Sampling rate
- API response time
- Recent RMS history
- Recent frequency history
- Automatic connection recovery
- Offline/error indication

---

## 🧠 System Architecture

```text
                 ┌──────────────────────┐
                 │    Acoustic Source   │
                 │   / Possible Leak    │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   Acoustic Sensor    │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │        ESP32         │
                 │                      │
                 │ Signal Acquisition   │
                 │ RMS Calculation      │
                 │ Frequency Analysis   │
                 │ Classification       │
                 └──────────┬───────────┘
                            │
                       HTTP / Wi-Fi
                            │
                            ▼
                 ┌──────────────────────┐
                 │    Web Dashboard     │
                 │                      │
                 │ RMS                  │
                 │ Frequency            │
                 │ Status               │
                 │ Sensor/Wi-Fi State   │
                 │ Historical Charts    │
                 └──────────────────────┘


🔧 Hardware



Component
Purpose



ESP32
Main microcontroller and wireless interface


Acoustic Sensor
Captures acoustic/vibration signals


Power Supply
Provides power to the system


Supporting Components
Signal conditioning and interfacing



Hardware configuration may change between prototype revisions.


💻 Software Stack
Firmware

ESP32
Arduino/C++
Wi-Fi Access Point
HTTP API
Acoustic signal processing

Frontend

HTML
CSS
JavaScript
HTML5 Canvas / browser-based visualization

The dashboard is lightweight and does not require a frontend framework or external JavaScript dependencies.

📊 Dashboard Measurements
RMS
The RMS value represents the measured signal magnitude from the acoustic sensing system.
The API does not currently define a physical RMS unit, so RMS values should not be interpreted as decibels (dB).
Dominant Frequency
The dominant frequency represents the primary frequency detected from the measured acoustic signal.
Device Classification
The ESP32 firmware determines the device classification.
Possible states include:

Copy to clipboard
Insert at cursor
NORMAL
WARNING
LEAK DETECTED
SENSOR FAULT

The frontend displays the classification reported by the firmware and does not override it.

🌐 ESP32 API
The ESP32 exposes:

Copy to clipboard
Insert at cursor
GET http://192.168.4.1/api/data

Example Response

Copy to clipboard
Insert at cursor
{
  "rms": 5.9,
  "frequency": 0.0,
  "status": "NORMAL",
  "wifi": true,
  "sensor": true,
  "samplingRate": 1000
}

API Fields



Field
Type
Description



rms
Number
Current RMS measurement


frequency
Number
Dominant frequency


status
String
Firmware classification


wifi
Boolean
Wi-Fi state


sensor
Boolean
Sensor state


samplingRate
Integer
Current sampling rate


Validation

RMS must be a finite, non-negative number.
Frequency must be a finite, non-negative number.
Sampling rate must be a positive integer.
wifi must be a boolean.
sensor must be a boolean.
status must contain a valid firmware classification.

If the sensor is unavailable, the firmware reports:

Copy to clipboard
Insert at cursor
SENSOR FAULT

and unreliable measurements are suppressed.

📱 Running the Web Dashboard
The dashboard is contained inside the web/ directory.
1. Power the ESP32
Power on the ESP32 and allow it to create its local Wi-Fi access point.
2. Connect to the ESP32
Connect your computer or phone to the Wi-Fi network configured by the ESP32.

Wi-Fi credentials are configured in the firmware and are intentionally not published in this repository.

3. Start a Local Web Server
From the directory containing the website files:

Copy to clipboard
Insert at cursor
python -m http.server 8080

Then open:

Copy to clipboard
Insert at cursor
http://localhost:8080

4. ESP32 API
The dashboard communicates with:

Copy to clipboard
Insert at cursor
http://192.168.4.1/api/data


⚠️ Browser Networking
When the dashboard is served from localhost and the ESP32 API is hosted at 192.168.4.1, they operate on different origins.
The ESP32 API therefore needs appropriate CORS permission for the dashboard origin.
Depending on the browser and hosting environment, HTTPS pages may also be prevented from accessing the HTTP ESP32 endpoint because of browser security policies.
For local operation, use an HTTP static server and configure the ESP32 API appropriately.
A browser-blocked request does not necessarily indicate a hardware or ESP32 API failure.

🔄 Data Polling
The dashboard requests new measurements approximately every:

Copy to clipboard
Insert at cursor
500 ms

Requests are non-overlapping and have a timeout of:

Copy to clipboard
Insert at cursor
1.5 seconds

If the ESP32 becomes unavailable, the dashboard displays:

Copy to clipboard
Insert at cursor
ESP32 OFFLINE

and clears previous readings and history.
The dashboard automatically retries the connection and resumes monitoring when a valid response becomes available.

📁 Project Structure

Copy to clipboard
Insert at cursor
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


🛠️ Development Workflow
The project is developed locally and synchronized with both GitHub and GitLab.

Copy to clipboard
Insert at cursor
              Local Repository
                     │
                     ▼
               Commit Changes
                     │
                     ▼
                 Push Origin
                  /       \
                 /         \
                ▼           ▼
            GitHub        GitLab

The local PC repository is the primary development workspace.

👨‍💻 Project Development
This project covers the complete development of an ESP32-based acoustic leak detection system, including:

ESP32 firmware development
Acoustic signal acquisition
Signal processing and measurement
Leak detection and classification logic
HTTP API implementation
Web dashboard development
ESP32-to-dashboard communication
System integration and testing


🔮 Future Improvements

Improved acoustic leak classification
Noise filtering and environmental compensation
More robust frequency analysis
Sensor calibration
Leak-location estimation
Long-term data logging
Cloud connectivity
Historical data storage
Multiple sensor support
Battery-powered operation
Improved enclosure and field deployment
Machine-learning-based leak classification


📌 Current Status



Property
Status



Version
1.0


Platform
ESP32


Application
Acoustic Water Leak Detection


Interface
Web Dashboard


Connectivity
Local Wi-Fi


API
HTTP


The current version is a prototype focused on real-time acoustic measurement, device classification, and local dashboard monitoring.

📜 License
This project is licensed under the MIT License. See the LICENSE file for details.

⭐ Acoustic Leak Finder
Built with ESP32, acoustic sensing, signal processing, and web technologies.

Copy to clipboard
Insert at cursor

**This is the version I'd use for your public GitHub.** It removes the team/event sections and presents the project as your own work without making the README look amateurish.

One thing I would **not** remove is the technical architecture and API documentation. Those are exactly the parts that make this useful as a portfolio project rather than just a repository full of code.



I need the project details before I can commit this. Could you share:

The project (either the GitLab project URL, or its path/ID, e.g. your-namespace/acoustic-leak-finder)
The target file path (I'll assume README.md at the repo root unless you say otherwise)

One quick heads-up before committing: your README references files that should exist for consistency:

A LICENSE file (the README links to it and states MIT). Want me to add an MIT LICENSE file in the same commit? If so, tell me the copyright holder name/year to put in it.
The esp32/ and web/ structure in the "Project Structure" section — this is just documentation, so no action needed unless those paths differ.

Also note: the README mentions syncing to both GitHub and GitLab. I can only commit to the GitLab repository from here. Once shared, I'll create a branch, commit the new README.md (plus LICENSE if you want it), and open a merge request.
Send me the project URL/path and I'll proceed.


i will change it my self like edit it my self


Sounds good. The version above is ready to paste in as-is.
Two quick reminders when you edit it yourself:

Add a LICENSE file at the repo root since the README links to it and states MIT.
The opening code fence in the block I gave you uses `````markdown` — make sure your final file doesn't accidentally include that wrapper fence.

Ping me if you want anything else.


you make it perfect


Here's the clean, ready-to-paste README.md (no wrapper fences, corrected throughout):



# Acoustic Leak Finder

> An ESP32-based acoustic water leak detection system with real-time signal monitoring and a mobile-first web dashboard.

## 🚀 Overview

**Acoustic Leak Finder** is an IoT-based acoustic water leak detection system designed to identify and monitor potential water leaks through acoustic signals.

The system uses an **ESP32** to acquire acoustic sensor data, process the signal, determine device status, and provide measurements through a lightweight HTTP API.

A responsive web dashboard connects to the ESP32 and displays measurements in real time, allowing monitoring from a computer or mobile device.

---

## 🎯 Project Goals

- Detect acoustic patterns associated with water leakage.
- Acquire and process acoustic signals using an ESP32.
- Determine device classification from processed measurements.
- Provide real-time measurement data through an HTTP API.
- Display measurements through a responsive web dashboard.
- Operate locally without requiring cloud infrastructure.
- Provide a simple interface suitable for desktop and mobile devices.

---

## ✨ Features

### ESP32 System

- Acoustic signal acquisition
- RMS measurement
- Dominant frequency measurement
- Firmware-based device classification
- Sensor health monitoring
- Wi-Fi status monitoring
- Configurable sampling rate
- Local Wi-Fi access point
- HTTP API for real-time measurements

### Web Dashboard

- Mobile-first responsive interface
- Real-time RMS display
- Dominant frequency display
- Device status indicator
- Sensor status
- Wi-Fi status
- Sampling rate
- API response time
- Recent RMS history
- Recent frequency history
- Automatic connection recovery
- Offline/error indication

---

## 🧠 System Architecture

```text
                 ┌──────────────────────┐
                 │    Acoustic Source   │
                 │   / Possible Leak    │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   Acoustic Sensor    │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │        ESP32         │
                 │                      │
                 │ Signal Acquisition   │
                 │ RMS Calculation      │
                 │ Frequency Analysis   │
                 │ Classification       │
                 └──────────┬───────────┘
                            │
                       HTTP / Wi-Fi
                            │
                            ▼
                 ┌──────────────────────┐
                 │    Web Dashboard     │
                 │                      │
                 │ RMS                  │
                 │ Frequency            │
                 │ Status               │
                 │ Sensor/Wi-Fi State   │
                 │ Historical Charts    │
                 └──────────────────────┘


🔧 Hardware



Component
Purpose



ESP32
Main microcontroller and wireless interface


Acoustic Sensor
Captures acoustic/vibration signals


Power Supply
Provides power to the system


Supporting Components
Signal conditioning and interfacing



Hardware configuration may change between prototype revisions.


💻 Software Stack
Firmware

ESP32
Arduino/C++
Wi-Fi Access Point
HTTP API
Acoustic signal processing

Frontend

HTML
CSS
JavaScript
HTML5 Canvas / browser-based visualization

The dashboard is lightweight and does not require a frontend framework or external JavaScript dependencies.

📊 Dashboard Measurements
RMS
The RMS value represents the measured signal magnitude from the acoustic sensing system.
The API does not currently define a physical RMS unit, so RMS values should not be interpreted as decibels (dB).
Dominant Frequency
The dominant frequency represents the primary frequency detected from the measured acoustic signal.
Device Classification
The ESP32 firmware determines the device classification.
Possible states include:



NORMAL
WARNING
LEAK DETECTED
SENSOR FAULT

The frontend displays the classification reported by the firmware and does not override it.

🌐 ESP32 API
The ESP32 exposes:



GET http://192.168.4.1/api/data

Example Response



{
  "rms": 5.9,
  "frequency": 0.0,
  "status": "NORMAL",
  "wifi": true,
  "sensor": true,
  "samplingRate": 1000
}

API Fields



Field
Type
Description



rms
Number
Current RMS measurement


frequency
Number
Dominant frequency


status
String
Firmware classification


wifi
Boolean
Wi-Fi state


sensor
Boolean
Sensor state


samplingRate
Integer
Current sampling rate


Validation

RMS must be a finite, non-negative number.
Frequency must be a finite, non-negative number.
Sampling rate must be a positive integer.
wifi must be a boolean.
sensor must be a boolean.
status must contain a valid firmware classification.

If the sensor is unavailable, the firmware reports:



SENSOR FAULT

and unreliable measurements are suppressed.

📱 Running the Web Dashboard
The dashboard is contained inside the web/ directory.
1. Power the ESP32
Power on the ESP32 and allow it to create its local Wi-Fi access point.
2. Connect to the ESP32
Connect your computer or phone to the Wi-Fi network configured by the ESP32.

Wi-Fi credentials are configured in the firmware and are intentionally not published in this repository.

3. Start a Local Web Server
From the web/ directory:



python -m http.server 8080

Then open:



http://localhost:8080

4. ESP32 API
The dashboard communicates with:



http://192.168.4.1/api/data


⚠️ Browser Networking
When the dashboard is served from localhost and the ESP32 API is hosted at 192.168.4.1, they operate on different origins.
The ESP32 API therefore needs appropriate CORS permission for the dashboard origin.
Depending on the browser and hosting environment, HTTPS pages may also be prevented from accessing the HTTP ESP32 endpoint because of browser security policies.
For local operation, use an HTTP static server and configure the ESP32 API appropriately.
A browser-blocked request does not necessarily indicate a hardware or ESP32 API failure.

🔄 Data Polling
The dashboard requests new measurements approximately every 500 ms.
Requests are non-overlapping and time out after 1.5 seconds.
If the ESP32 becomes unavailable, the dashboard displays:



ESP32 OFFLINE

and clears previous readings and history.
The dashboard automatically retries the connection and resumes monitoring when a valid response becomes available.

📁 Project Structure



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


🛠️ Development Workflow
The project is developed locally and synchronized with both GitHub and GitLab.



              Local Repository
                     │
                     ▼
               Commit Changes
                     │
                     ▼
                 Push Origin
                  /       \
                 /         \
                ▼           ▼
            GitHub        GitLab

The local repository is the primary development workspace.

👨‍💻 Project Development
This project covers the complete development of an ESP32-based acoustic leak detection system, including:

ESP32 firmware development
Acoustic signal acquisition
Signal processing and measurement
Leak detection and classification logic
HTTP API implementation
Web dashboard development
ESP32-to-dashboard communication
System integration and testing


🔮 Future Improvements

Improved acoustic leak classification
Noise filtering and environmental compensation
More robust frequency analysis
Sensor calibration
Leak-location estimation
Long-term data logging
Cloud connectivity
Historical data storage
Multiple sensor support
Battery-powered operation
Improved enclosure and field deployment
Machine-learning-based leak classification


📌 Current Status



Property
Status



Version
1.0


Platform
ESP32


Application
Acoustic Water Leak Detection


Interface
Web Dashboard


Connectivity
Local Wi-Fi


API
HTTP


The current version is a prototype focused on real-time acoustic measurement, device classification, and local dashboard monitoring.

📜 License
This project is licensed under the MIT License. See the LICENSE file for details.

