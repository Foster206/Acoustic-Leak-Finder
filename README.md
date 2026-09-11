# EPSION Acoustic Leak Finder

Version 1 is a dependency-free, mobile-first dashboard for an ESP32 acoustic leak detector. The existing EPSION instrument layout displays live RMS, dominant frequency, device classification, sensor/Wi-Fi state, sampling rate and API response time. Charts show recent measured RMS/frequency history, not fabricated waveform samples or FFT bins. RMS units are not specified by the API; values are not labelled as dB.

## Run locally

From `web/`, serve the files with a local static server, for example:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080` on the same computer. No build step, external assets or JavaScript dependencies are required. The API URL is fixed to the ESP32 address, not the static server's `/api/data` path.

## Live ESP32 Dashboard

1. Power the ESP32.
2. Connect the computer/phone to **EPSION-LEAK-FINDER**.
3. Enter password **EPSION123**.
4. Open the website using a compatible serving setup (see below).
5. The browser communicates with **http://192.168.4.1/api/data**, targeting one request every **500 ms**.

`192.168.4.1` is the local address provided by the physical ESP32 access point. Only the connected user's browser accesses it; GitLab/cloud infrastructure does not need access. Keep the device connected to this Wi-Fi even if it reports no internet access. For a phone, `localhost` means the phone itself, not your computer.

**Browser serving requirements:** The local static server and ESP32 are different origins. The API must already permit the website's origin through CORS for the browser to read its response. An HTTPS-hosted website may also be blocked from fetching this HTTP endpoint by mixed-content or local-network policies; localhost is not a universal exemption from local-network restrictions. Allow local-network access if your browser prompts. Use an HTTP serving setup with API CORS permission, or same-origin hosting at `http://192.168.4.1` only if the existing device already supports serving these website files. This repository does not deploy the website to the device. If neither setup is available, there is no frontend-only fix: JavaScript cannot grant CORS permission or bypass browser policy, and `no-cors` cannot provide readable JSON. Firmware is unchanged. A blocked request does not prove the physical API is broken.

## API contract

`GET http://192.168.4.1/api/data` should return:

```json
{"rms":5.9,"frequency":0.0,"status":"NORMAL","wifi":true,"sensor":true,"samplingRate":1000}
```

All six fields are required. RMS/frequency must be finite, non-negative numbers (zero is valid), sampling rate a positive integer, and Wi-Fi/sensor flags booleans. Classification comes from the ESP32: **NORMAL**, **WARNING**, **LEAK DETECTED** or **SENSOR FAULT**. A false sensor flag also produces SENSOR FAULT and hides untrustworthy measurements. No frontend RMS thresholds override firmware classification.

Requests never overlap and time out after 1.5 seconds, including response-body reading. Slow requests reduce the polling rate; background browsers may throttle timers. Failures, invalid JSON or malformed/missing fields show **ESP32 OFFLINE**, clear readings/history and retry automatically. Offline sensor/Wi-Fi states are **UNKNOWN**, not invented device diagnoses. A valid response automatically restores live monitoring. Returning to a backgrounded tab clears old values and refreshes the connection.
