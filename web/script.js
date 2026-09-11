// Prototype thresholds: change these values to tune the instrument classification.
const NORMAL_THRESHOLD = 10;
const WARNING_THRESHOLD = 30;
const POLL_INTERVAL_MS = 500;

let demoMode = true;
let phase = 0;
let currentData = null;
let requestInFlight = false;

const $ = (id) => document.getElementById(id);
const statusForRms = (rms) => rms < NORMAL_THRESHOLD ? "NORMAL" : rms < WARNING_THRESHOLD ? "WARNING" : "LEAK DETECTED";

function setIndicator(id, online) { $(id).className = `indicator ${online ? "online" : "offline"}`; }
function setText(id, value) { $(id).textContent = value; }

function updateDashboard(data, isDemo = false) {
  currentData = data;
  demoMode = isDemo;
  const status = data.status || statusForRms(data.rms);
  const statusClass = `status-${status.toLowerCase().replaceAll(" ", "-")}`;
  const signal = Math.min(100, Math.max(0, Math.round((data.rms / WARNING_THRESHOLD) * 100)));
  const live = !isDemo;
  setText("rms", Number(data.rms).toFixed(1)); setText("frequency", Number(data.frequency).toFixed(1)); setText("signal", signal);
  setText("samplingRate", `${data.samplingRate} Hz`); setText("leakStatus", status); setText("statusDetail", live ? "Live data received from ESP32" : "Simulated data — ESP32 API unavailable");
  $("leakStatus").className = statusClass;
  setText("demoMode", live ? "LIVE DATA" : "DEMO MODE"); $("demoMode").style.borderColor = live ? "var(--green)" : "var(--amber)"; $("demoMode").style.color = live ? "var(--green)" : "var(--amber)";
  setText("wifi", live && data.wifi ? "CONNECTED" : live ? "OFFLINE" : "SIMULATED"); setIndicator("wifiDot", live && data.wifi);
  setText("esp32", live ? "ONLINE" : "DEMO"); setIndicator("esp32Dot", live);
  setText("sensor", live && data.sensor ? "ACTIVE" : live ? "FAULT" : "SIMULATED"); setIndicator("sensorDot", live && data.sensor);
  setText("waveSource", live ? "DISPLAY ONLY*" : "DEMO SIGNAL"); setText("spectrumSource", live ? "DISPLAY ONLY*" : "DEMO SPECTRUM");
}

// The ESP32 API currently supplies scalar readings only. These visual traces are explicitly
// illustrative until a future endpoint provides waveform/FFT bins; they are never sensor data.
function drawCharts() {
  const accent = currentData && currentData.status === "LEAK DETECTED" ? "#ff6d6d" : currentData && currentData.status === "WARNING" ? "#ffc55c" : "#35d8df";
  [["waveform", true], ["spectrum", false]].forEach(([id, wave]) => {
    const canvas = $(id), ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h); ctx.strokeStyle="#1d3038"; ctx.lineWidth=1;
    for(let x=0;x<w;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();} for(let y=0;y<h;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    ctx.strokeStyle=accent; ctx.lineWidth=2; ctx.beginPath();
    if(wave) for(let x=0;x<w;x++){ const y=h/2 + Math.sin(x*.045+phase)*25 + Math.sin(x*.13+phase)*9; x?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    else for(let x=0;x<w;x+=8){ const peak=Math.exp(-Math.pow((x/w)-.35,2)/.012)*125; const y=h-14-(18+peak+Math.sin(x*.18+phase)*9); ctx.moveTo(x,h-12);ctx.lineTo(x,y); }
    ctx.stroke();
  });
  phase += .18; requestAnimationFrame(drawCharts);
}

function demoData() { const rms = 7 + Math.abs(Math.sin(Date.now()/2600))*18; return { rms, frequency: 92 + Math.sin(Date.now()/1900)*15, status: statusForRms(rms), wifi:false, sensor:false, samplingRate:1000 }; }

async function fetchSensorData() {
  // A slow or stalled ESP32 response must not cause timer-driven requests to overlap.
  if (requestInFlight) return;
  requestInFlight = true;
  try {
    const response = await fetch("/api/data", { cache:"no-store" });
    if (!response.ok) throw new Error("API unavailable");
    updateDashboard(await response.json(), false);
  } catch {
    updateDashboard(demoData(), true);
  } finally {
    requestInFlight = false;
  }
}

fetchSensorData(); setInterval(fetchSensorData, POLL_INTERVAL_MS); drawCharts();
