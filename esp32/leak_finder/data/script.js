"use strict";

// Requests originate only in the user's browser on the physical ESP32 Wi-Fi.
const API_URL = "/api/data";
const POLL_INTERVAL_MS = 500;
const REQUEST_TIMEOUT_MS = 1500;
const HISTORY_LIMIT = 60;
const STATUS_DETAILS = Object.freeze({
  "NORMAL": "Acoustic input is normal.",
  "WARNING": "Elevated acoustic input. Inspect the monitored area.",
  "LEAK DETECTED": "Leak detected by ESP32. Inspect the monitored area promptly.",
  "SENSOR FAULT": "Sensor fault reported. Check the piezo sensor and wiring."
});

let requestInFlight = false;
let pollTimer = null;
let activeController = null;
let currentStatus = "ESP32 OFFLINE";
const history = [];
const $ = (id) => document.getElementById(id);

function setText(id, value) {
  const text = String(value);
  // Avoid repeated announcements from unchanged live-region text.
  if ($(id).textContent !== text) $(id).textContent = text;
}

function setIndicator(id, online) {
  $(id).className = `indicator ${online === null ? "unknown" : online ? "online" : "offline"}`;
}

function setStatus(status, detail) {
  currentStatus = status;
  const state = status === "ESP32 OFFLINE" ? "offline" : status.toLowerCase().replace(/ /g, "-");
  setText("leakStatus", status);
  $("leakStatus").className = `status-${state}`;
  $("statusPanel").dataset.state = state;
  setText("statusDetail", detail);
}

function validateData(data) {
  const nonNegativeNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      !nonNegativeNumber(data.rms) || !nonNegativeNumber(data.frequency) ||
      !Number.isInteger(data.samplingRate) || data.samplingRate <= 0 ||
      typeof data.sensor !== "boolean" || typeof data.wifi !== "boolean" ||
      typeof data.status !== "string" ||
      !Object.prototype.hasOwnProperty.call(STATUS_DETAILS, data.status)) {
    throw new Error("Invalid or incomplete API response.");
  }
  return data;
}

function showOffline(reason) {
  setStatus("ESP32 OFFLINE", reason);
  setText("demoMode", "● ESP32 OFFLINE");
  $("demoMode").className = "mode is-offline";
  setText("rms", "--");
  setText("frequency", "--");
  setText("signal", "--");
  setText("samplingRate", "-- Hz");
  setText("esp32", "OFFLINE");
  // Browser request failure does not reveal the device's Wi-Fi or sensor state.
  setText("wifi", "UNKNOWN");
  setText("sensor", "UNKNOWN");
  setIndicator("esp32Dot", false);
  setIndicator("wifiDot", null);
  setIndicator("sensorDot", null);
  history.length = 0;
  drawCharts();
}

function updateDashboard(data, latency) {
  const sensorOk = data.sensor && data.status !== "SENSOR FAULT";
  const status = sensorOk ? data.status : "SENSOR FAULT";
  setStatus(status, `${STATUS_DETAILS[status]} Updated ${new Date().toLocaleTimeString()}.`);
  setText("demoMode", "● ESP32 CONNECTED");
  $("demoMode").className = "mode is-online";
  setText("rms", sensorOk ? data.rms.toFixed(1) : "--");
  setText("frequency", sensorOk ? data.frequency.toFixed(1) : "--");
  setText("signal", Math.round(latency));
  setText("samplingRate", `${data.samplingRate} Hz`);
  setText("esp32", "CONNECTED");
  setText("wifi", data.wifi ? "CONNECTED" : "DISCONNECTED");
  setText("sensor", sensorOk ? "CONNECTED" : "FAULT");
  setIndicator("esp32Dot", true);
  setIndicator("wifiDot", data.wifi);
  setIndicator("sensorDot", sensorOk);
  if (sensorOk) {
    history.push({ rms:data.rms, frequency:data.frequency, time:performance.now() });
    if (history.length > HISTORY_LIMIT) history.shift();
  } else {
    history.length = 0;
  }
  drawCharts();
}

// Scalar measurement history replaces the prototype's fabricated waveform/FFT.
// Draw only on updates; no animation loop or simulated measurements.
function drawCharts() {
  const accent = currentStatus === "LEAK DETECTED" ? "#ff6d6d" : currentStatus === "WARNING" ? "#ffc55c" : "#35d8df";
  [["waveform", "rms", "waveSource", "RMS"], ["spectrum", "frequency", "spectrumSource", "Frequency (Hz)"]].forEach(([id, key, source, label]) => {
    const canvas = $(id);
    const count = history.length;
    setText(source, count ? `${count} REAL READINGS` : "NO LIVE DATA");
    canvas.setAttribute("aria-label", count ? `${label} history: ${count} readings; latest ${history[count - 1][key].toFixed(1)}` : `${label} history; no live data`);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#1d3038";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 42) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.font = "14px Consolas, monospace";
    ctx.fillStyle = "#8ca0a8";
    if (!count) {
      ctx.fillText("Waiting for valid sensor readings", 16, h / 2);
      return;
    }
    const max = Math.max(1, ...history.map((sample) => sample[key]));
    const duration = history[count - 1].time - history[0].time;
    ctx.fillText(`Scale: 0 – ${max.toFixed(1)}${key === "frequency" ? " Hz" : ""}`, 16, 22);
    ctx.fillText(`Last ${(duration / 1000).toFixed(1)} s`, 16, h - 8);
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((sample, index) => {
      const x = 16 + (duration ? (sample.time - history[0].time) / duration : 0) * (w - 32);
      const y = h - 30 - (sample[key] / max) * (h - 65);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      if (count === 1) ctx.fillRect(x - 2, y - 2, 4, 4);
    });
    ctx.stroke();
  });
}

async function fetchSensorData() {
  if (requestInFlight) return;
  requestInFlight = true;
  const startedAt = performance.now();
  const controller = new AbortController();
  activeController = controller;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      cache:"no-store",
      credentials:"omit",
      signal:controller.signal
    });
    if (!response.ok) throw new Error(`API returned HTTP ${response.status}.`);
    const data = validateData(await response.json());
    // Includes JSON download/parse time; never apply a late or cancelled response.
    if (controller.signal.aborted || performance.now() - startedAt >= REQUEST_TIMEOUT_MS) {
      timedOut = true;
      throw new Error("Request expired.");
    }
    updateDashboard(data, performance.now() - startedAt);
  } catch (error) {
    let reason;
    if (timedOut) reason = "API timeout. Retrying automatically.";
    else if (error instanceof SyntaxError) reason = "Invalid JSON from API. Retrying automatically.";
    else if (error instanceof TypeError) reason = "API unreachable or blocked by browser policy. Check ESP32 Wi-Fi and the README serving requirements. Retrying automatically.";
    else if (controller.signal.aborted) reason = "Refreshing connection. Retrying automatically.";
    else reason = `${error.message || "Invalid API response."} Retrying automatically.`;
    showOffline(reason);
  } finally {
    clearTimeout(timeout);
    activeController = null;
    requestInFlight = false;
    // Target 500 ms start-to-start for fast responses; serialize slower requests.
    pollTimer = setTimeout(fetchSensorData, Math.max(0, POLL_INTERVAL_MS - (performance.now() - startedAt)));
  }
}

// Background tabs may throttle timers. Discard old values immediately on return.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  showOffline("Refreshing connection after returning to this tab.");
  if (activeController) activeController.abort();
  else {
    clearTimeout(pollTimer);
    fetchSensorData();
  }
});

showOffline("Waiting for a valid ESP32 response.");
fetchSensorData();
