# EPSION Acoustic Leak Finder

Version 1 is a dependency-free, mobile-first dashboard for an ESP32 acoustic leak detector.

## Run locally

From `web/`, serve the files with a local static server, for example:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`. Until an ESP32 serves `GET /api/data`, the dashboard shows clearly labelled simulated **DEMO MODE** values. The plotted waveform and spectrum are illustrative display traces, not real sensor readings, until the device exposes sample/bin data.

## API contract

`GET /api/data` is polled every 500 ms and should return:

```json
{"rms":52.4,"frequency":101.6,"status":"WARNING","wifi":true,"sensor":true,"samplingRate":1000}
```

Prototype constants in `web/script.js`:

- `NORMAL_THRESHOLD = 10`
- `WARNING_THRESHOLD = 30`

RMS below 10 is NORMAL; 10 through below 30 is WARNING; 30 and above is LEAK DETECTED.
