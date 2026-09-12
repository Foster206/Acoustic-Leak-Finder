"use strict";

/*
 * =========================================================
 * ACOUSTIC LEAK FINDER
 * ESP32 Dashboard Client
 * =========================================================
 *
 * Requests originate only in the user's browser while
 * connected to the physical ESP32 access point.
 *
 * No cloud service.
 * No external libraries.
 * No fabricated measurements.
 * 
 * By Pradatto Pal (Foster206)
 * =========================================================
 */

const API_URL = "/api/data";

const POLL_INTERVAL_MS = 500;
const REQUEST_TIMEOUT_MS = 1500;
const HISTORY_LIMIT = 60;

const STATUS_DETAILS = Object.freeze({
  "NORMAL":
    "Acoustic input is normal.",

  "WARNING":
    "Elevated acoustic input. Inspect the monitored area.",

  "LEAK DETECTED":
    "Leak detected by ESP32. Inspect the monitored area promptly.",

  "SENSOR FAULT":
    "Sensor fault reported. Check the piezo sensor and wiring."
});

/*
 * Maps the ESP32 status string to the data-state / CSS
 * class suffix used by index.html and style.css.
 */
const STATE_MAP = Object.freeze({
  "NORMAL": "normal",
  "WARNING": "warning",
  "LEAK DETECTED": "leak-detected",
  "SENSOR FAULT": "sensor-fault",
  "ESP32 OFFLINE": "offline"
});


/* =========================================================
   STATE
   ========================================================= */

let requestInFlight = false;
let pollTimer = null;
let activeController = null;

let currentStatus = "ESP32 OFFLINE";

const readings = [];


/* =========================================================
   DOM HELPER
   ========================================================= */

const $ = (id) => document.getElementById(id);


function setText(id, value) {
  const element = $(id);

  if (!element) return;

  const text = String(value);

  /*
   * Avoid unnecessary DOM updates and repeated
   * accessibility announcements.
   */
  if (element.textContent !== text) {
    element.textContent = text;
  }
}


/* =========================================================
   DEVICE URL
   ========================================================= */

function updateDeviceUrl() {
  const element = $("deviceUrl");

  if (!element) return;

  /*
   * When served directly from the ESP32, location.origin
   * becomes something like:
   *
   * http://192.168.4.1
   */
  if (window.location.origin &&
      window.location.origin !== "null" &&
      window.location.protocol !== "file:") {

    setText("deviceUrl", window.location.origin);
  }
}


/* =========================================================
   STATUS SCALE
   ========================================================= */

function updateStatusScale(status) {
  const scale = $("statusScale");

  if (!scale) return;

  const activeState =
    status === "ESP32 OFFLINE"
      ? null
      : STATE_MAP[status] || null;

  scale.querySelectorAll("span").forEach((item) => {
    const isActive =
      activeState !== null &&
      item.dataset.state === activeState;

    /*
     * The scale is visually decorative but aria-current
     * allows the CSS to highlight the active classification.
     */
    if (isActive) {
      item.setAttribute("aria-current", "true");
    } else {
      item.removeAttribute("aria-current");
    }
  });
}


/* =========================================================
   INDICATORS
   ========================================================= */

function setIndicator(id, online) {
  const element = $(id);

  if (!element) return;

  element.className =
    `indicator ${
      online === null
        ? "unknown"
        : online
          ? "online"
          : "offline"
    }`;
}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(status, detail) {

  currentStatus = status;

  const state = STATE_MAP[status] || "offline";

  setText("leakStatus", status);

  const leakStatus = $("leakStatus");

  if (leakStatus) {
    leakStatus.className = `status-${state}`;
  }

  const statusPanel = $("statusPanel");

  if (statusPanel) {
    statusPanel.dataset.state = state;
  }

  /*
   * #statusDetail lives inside a polite live region.
   * Keep this text static per state so it is only
   * announced when the classification actually changes.
   */
  setText("statusDetail", detail);

  updateStatusScale(status);
}


/* =========================================================
   API VALIDATION
   ========================================================= */

function validateData(data) {

  const nonNegativeNumber = (value) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0;

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||

    !nonNegativeNumber(data.rms) ||

    !nonNegativeNumber(data.frequency) ||

    !Number.isInteger(data.samplingRate) ||

    data.samplingRate <= 0 ||

    typeof data.sensor !== "boolean" ||

    typeof data.wifi !== "boolean" ||

    typeof data.status !== "string" ||

    !Object.prototype.hasOwnProperty.call(
      STATUS_DETAILS,
      data.status
    )
  ) {
    throw new Error("Invalid or incomplete API response.");
  }

  return data;
}


/* =========================================================
   OFFLINE STATE
   ========================================================= */

function showOffline(reason) {

  setStatus(
    "ESP32 OFFLINE",
    reason
  );

  setText(
    "demoMode",
    "● ESP32 OFFLINE"
  );

  const demoMode = $("demoMode");

  if (demoMode) {
    demoMode.className = "mode is-offline";
  }


  setText("rms", "--");
  setText("frequency", "--");
  setText("signal", "--");
  setText("samplingRate", "-- Hz");

  setText("esp32", "OFFLINE");

  /*
   * Browser request failure does not reveal the actual
   * Wi-Fi or sensor state inside the ESP32.
   */
  setText("wifi", "UNKNOWN");
  setText("sensor", "UNKNOWN");


  setIndicator("esp32Dot", false);
  setIndicator("wifiDot", null);
  setIndicator("sensorDot", null);


  readings.length = 0;

  drawCharts();
}


/* =========================================================
   LIVE DASHBOARD UPDATE
   ========================================================= */

function updateDashboard(data, latency) {

  /*
   * A sensor fault takes priority over the classification
   * reported by the ESP32.
   */
  const sensorOk =
    data.sensor &&
    data.status !== "SENSOR FAULT";

  const status =
    sensorOk
      ? data.status
      : "SENSOR FAULT";


  setStatus(
    status,
    STATUS_DETAILS[status]
  );


  /*
   * Connection badge.
   * It is aria-hidden, so it is safe to refresh the
   * timestamp here on every poll.
   */
  setText(
    "demoMode",
    `● ESP32 CONNECTED · ${new Date().toLocaleTimeString()}`
  );

  const demoMode = $("demoMode");

  if (demoMode) {
    demoMode.className = "mode is-online";
  }


  /* Measurements */

  setText(
    "rms",
    sensorOk
      ? data.rms.toFixed(1)
      : "--"
  );

  setText(
    "frequency",
    sensorOk
      ? data.frequency.toFixed(1)
      : "--"
  );

  setText(
    "signal",
    Math.round(latency)
  );

  setText(
    "samplingRate",
    `${data.samplingRate} Hz`
  );


  /* System state */

  setText(
    "esp32",
    "CONNECTED"
  );

  setText(
    "wifi",
    data.wifi
      ? "CONNECTED"
      : "DISCONNECTED"
  );

  setText(
    "sensor",
    sensorOk
      ? "CONNECTED"
      : "FAULT"
  );


  /* Indicators */

  setIndicator(
    "esp32Dot",
    true
  );

  setIndicator(
    "wifiDot",
    data.wifi
  );

  setIndicator(
    "sensorDot",
    sensorOk
  );


  /* History */

  if (sensorOk) {

    readings.push({
      rms: data.rms,
      frequency: data.frequency,
      time: performance.now()
    });

    if (readings.length > HISTORY_LIMIT) {
      readings.shift();
    }

  } else {

    readings.length = 0;

  }


  drawCharts();
}


/* =========================================================
   HISTORY CHARTS
   =========================================================
 *
 * These are scalar measurement histories.
 *
 * They do NOT fabricate an audio waveform or FFT spectrum.
 * They display the actual RMS and dominant-frequency values
 * received from the ESP32 API.
 * ========================================================= */

function drawCharts() {

  const accent =
    currentStatus === "LEAK DETECTED"
      ? "#ff6d6d"
      : currentStatus === "WARNING"
        ? "#ffc55c"
        : currentStatus === "SENSOR FAULT"
          ? "#d6b5ff"
          : "#35d8df";


  const charts = [
    [
      "waveform",
      "rms",
      "waveSource",
      "RMS"
    ],
    [
      "spectrum",
      "frequency",
      "spectrumSource",
      "Frequency (Hz)"
    ]
  ];


  charts.forEach(
    ([id, key, source, label]) => {

      const canvas = $(id);

      if (!canvas) return;

      const count = readings.length;


      setText(
        source,
        count
          ? `${count} REAL READINGS`
          : "NO LIVE DATA"
      );


      canvas.setAttribute(
        "aria-label",
        count
          ? `${label} history: ${count} readings; latest ${readings[count - 1][key].toFixed(1)}`
          : `${label} history; no live data`
      );


      const ctx = canvas.getContext("2d");

      if (!ctx) return;


      const w = canvas.width;
      const h = canvas.height;


      /* Clear previous drawing */

      ctx.clearRect(
        0,
        0,
        w,
        h
      );


      /* Grid */

      ctx.strokeStyle = "#1d3038";
      ctx.lineWidth = 1;


      for (let x = 0; x < w; x += 60) {

        ctx.beginPath();

        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);

        ctx.stroke();
      }


      for (let y = 0; y < h; y += 42) {

        ctx.beginPath();

        ctx.moveTo(0, y);
        ctx.lineTo(w, y);

        ctx.stroke();
      }


      /* Chart text */

      ctx.font =
        '14px ui-monospace, "SF Mono", Menlo, Consolas, monospace';

      ctx.fillStyle = "#8ca0a8";


      if (!count) {

        ctx.fillText(
          "Waiting for valid sensor readings",
          16,
          h / 2
        );

        return;
      }


      /* Scale */

      const max = Math.max(
        1,
        ...readings.map(
          (sample) => sample[key]
        )
      );


      const duration =
        readings[count - 1].time -
        readings[0].time;


      ctx.fillText(
        `Scale: 0 – ${max.toFixed(1)}${key === "frequency" ? " Hz" : ""}`,
        16,
        22
      );


      ctx.fillText(
        `Last ${(duration / 1000).toFixed(1)} s`,
        16,
        h - 8
      );


      /* Measurement line */

      ctx.strokeStyle = accent;
      ctx.fillStyle = accent;
      ctx.lineWidth = 2;


      ctx.beginPath();


      readings.forEach(
        (sample, index) => {

          const x =
            16 +
            (
              duration
                ? (sample.time - readings[0].time) / duration
                : 0
            ) *
            (w - 32);


          const y =
            h -
            30 -
            (
              sample[key] / max
            ) *
            (h - 65);


          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }


          /*
           * A single measurement is easier to see as a
           * small point rather than an invisible line.
           */
          if (count === 1) {
            ctx.fillRect(
              x - 2,
              y - 2,
              4,
              4
            );
          }

        }
      );


      ctx.stroke();

    }
  );
}


/* =========================================================
   FETCH SENSOR DATA
   ========================================================= */

async function fetchSensorData() {

  if (requestInFlight) return;

  requestInFlight = true;


  const startedAt =
    performance.now();


  const controller =
    new AbortController();


  activeController =
    controller;


  let timedOut = false;


  const timeout =
    setTimeout(
      () => {

        timedOut = true;

        controller.abort();

      },
      REQUEST_TIMEOUT_MS
    );


  try {

    const response =
      await fetch(
        API_URL,
        {
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal
        }
      );


    if (!response.ok) {

      throw new Error(
        `API returned HTTP ${response.status}.`
      );

    }


    const data =
      validateData(
        await response.json()
      );


    /*
     * Includes JSON download and parse time.
     *
     * Never apply a late or cancelled response.
     */
    if (
      controller.signal.aborted ||
      performance.now() - startedAt >= REQUEST_TIMEOUT_MS
    ) {

      timedOut = true;

      throw new Error(
        "Request expired."
      );

    }


    updateDashboard(
      data,
      performance.now() - startedAt
    );


  } catch (error) {

    let reason;


    if (timedOut) {

      reason =
        "API timeout. Retrying automatically.";

    } else if (error instanceof SyntaxError) {

      reason =
        "Invalid JSON from API. Retrying automatically.";

    } else if (error instanceof TypeError) {

      reason =
        "API unreachable or blocked by browser policy. Check ESP32 Wi-Fi and the README serving requirements. Retrying automatically.";

    } else if (controller.signal.aborted) {

      reason =
        "Refreshing connection. Retrying automatically.";

    } else {

      reason =
        `${error.message || "Invalid API response."} Retrying automatically.`;

    }


    showOffline(reason);


  } finally {

    clearTimeout(timeout);

    activeController = null;

    requestInFlight = false;


    /*
     * Target approximately 500 ms start-to-start for fast
     * requests while serializing slower requests.
     */
    pollTimer =
      setTimeout(
        fetchSensorData,
        Math.max(
          0,
          POLL_INTERVAL_MS -
          (performance.now() - startedAt)
        )
      );
  }
}


/* =========================================================
   VISIBILITY HANDLING
   =========================================================
 *
 * Background tabs can throttle timers.
 * Discard old values immediately when the user returns.
 * ========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {

    if (document.hidden) return;


    showOffline(
      "Refreshing connection after returning to this tab."
    );


    if (activeController) {

      activeController.abort();

    } else {

      clearTimeout(pollTimer);

      fetchSensorData();

    }

  }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

updateDeviceUrl();

showOffline(
  "Waiting for a valid ESP32 response."
);

fetchSensorData();
