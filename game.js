const appShell = document.getElementById("appShell");
const splashStartBtn = document.getElementById("splashStartBtn");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const muteBtn = document.getElementById("muteBtn");
const rightHandBtn = document.getElementById("rightHandBtn");
const leftHandBtn = document.getElementById("leftHandBtn");
const instructionChip = document.getElementById("instructionChip");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const splashCameraSelect = document.getElementById("splashCameraSelect");
const cameraSelect = document.getElementById("cameraSelect");

const scoreEl = document.getElementById("scoreEl");
const pitchesEl = document.getElementById("pitchesEl");
const hitsEl = document.getElementById("hitsEl");
const missesEl = document.getElementById("missesEl");
const veloEl = document.getElementById("veloEl");

const pitchSpeedVal = document.getElementById("pitchSpeedVal");
const swingThresholdVal = document.getElementById("swingThresholdVal");
const pitchDelayVal = document.getElementById("pitchDelayVal");

const pitchSpeedSlider = document.getElementById("pitchSpeed");
const swingThresholdSlider = document.getElementById("swingThreshold");
const pitchDelaySlider = document.getElementById("pitchDelay");

let started = false;
let paused = false;
let soundOn = true;
let battingSide = "right";
let cameraStream = null;
let animationId = null;

let availableCameras = [];
let selectedCameraId = "";

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
window.addEventListener("resize", resizeCanvas);

function updateUI() {
  scoreEl.textContent = "0";
  pitchesEl.textContent = "10";
  hitsEl.textContent = "0";
  missesEl.textContent = "0";
  veloEl.textContent = "0";

  pitchSpeedVal.textContent = pitchSpeedSlider.value;
  swingThresholdVal.textContent = swingThresholdSlider.value;
  pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;

  rightHandBtn.classList.toggle("active", battingSide === "right");
  leftHandBtn.classList.toggle("active", battingSide === "left");
  muteBtn.textContent = soundOn ? "Sound: On" : "Sound: Off";
  pauseBtn.textContent = paused ? "Resume Game" : "Pause Game";
}

function populateCameraDropdowns() {
  const selects = [splashCameraSelect, cameraSelect];

  selects.forEach(select => {
    select.innerHTML = "";
  });

  if (!availableCameras.length) {
    selects.forEach(select => {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Default Camera";
      select.appendChild(opt);
      select.value = "";
    });
    return;
  }

  availableCameras.forEach((camera, index) => {
    const label = camera.label || `Camera ${index + 1}`;

    selects.forEach(select => {
      const opt = document.createElement("option");
      opt.value = camera.deviceId;
      opt.textContent = label;
      select.appendChild(opt);
    });
  });

  const finalValue =
    availableCameras.some(c => c.deviceId === selectedCameraId)
      ? selectedCameraId
      : availableCameras[0].deviceId;

  selectedCameraId = finalValue;
  splashCameraSelect.value = finalValue;
  cameraSelect.value = finalValue;
}

async function refreshCameraList() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableCameras = devices.filter(device => device.kind === "videoinput");
    populateCameraDropdowns();
  } catch (err) {
    console.error(err);
  }
}

function syncCameraSelects(value) {
  selectedCameraId = value;
  splashCameraSelect.value = value;
  cameraSelect.value = value;
}

async function restartCameraWithSelection() {
  if (!started) return;

  try {
    instructionChip.textContent = "Switching camera...";
    await stopCamera();
    await startCamera();
    instructionChip.textContent = "Camera switched.";
  } catch (err) {
    console.error(err);
    instructionChip.textContent = `Camera switch failed: ${err.message}`;
  }
}

async function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  video.srcObject = null;
}

function drawSplashBackground() {
  resizeCanvas();

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#0d2344");
  grad.addColorStop(1, "#17335e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(
      canvas.width * (0.1 + i * 0.12),
      canvas.height * 0.18,
      18,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(canvas.width * 0.18, canvas.height * 0.62, canvas.width * 0.64, canvas.height * 0.10);
}

async function startCamera() {
  if (cameraStream) return;

  const constraints = {
    video: selectedCameraId
      ? {
          deviceId: { exact: selectedCameraId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      : {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
    audio: false
  };

  cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = cameraStream;
  await video.play();

  await refreshCameraList();
}

function drawGamePlaceholder() {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 72px "Baloo 2", sans-serif';
  ctx.fillText(paused ? "PAUSED" : "GAME READY", canvas.width / 2, canvas.height * 0.35);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 26px "Nunito", sans-serif';
  ctx.fillText(
    paused ? "Press Pause again to resume." : "Camera initialized. Camera selection is now enabled.",
    canvas.width / 2,
    canvas.height * 0.45
  );
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!started) {
    drawSplashBackground();
  } else {
    drawGamePlaceholder();
  }

  animationId = requestAnimationFrame(render);
}

async function beginGame() {
  try {
    instructionChip.textContent = "Starting camera...";
    await startCamera();
    started = true;
    paused = false;
    appShell.classList.remove("preGame");
    instructionChip.textContent = "Camera started. Branded layout restored.";
  } catch (err) {
    console.error(err);
    instructionChip.textContent = `Camera failed: ${err.message}`;
  }

  updateUI();
}

splashStartBtn.onclick = beginGame;
startBtn.onclick = beginGame;

pauseBtn.onclick = () => {
  if (!started) return;
  paused = !paused;
  instructionChip.textContent = paused ? "Game paused." : "Game resumed.";
  updateUI();
};

resetBtn.onclick = async () => {
  started = false;
  paused = false;
  appShell.classList.add("preGame");
  instructionChip.textContent = "Press Start to begin.";
  await stopCamera();
  updateUI();
};

muteBtn.onclick = () => {
  soundOn = !soundOn;
  updateUI();
};

rightHandBtn.onclick = () => {
  battingSide = "right";
  instructionChip.textContent = "Right-handed mode selected.";
  updateUI();
};

leftHandBtn.onclick = () => {
  battingSide = "left";
  instructionChip.textContent = "Left-handed mode selected.";
  updateUI();
};

splashCameraSelect.onchange = async (e) => {
  syncCameraSelects(e.target.value);
  if (started) await restartCameraWithSelection();
};

cameraSelect.onchange = async (e) => {
  syncCameraSelects(e.target.value);
  if (started) await restartCameraWithSelection();
};

pitchSpeedSlider.oninput = updateUI;
swingThresholdSlider.oninput = updateUI;
pitchDelaySlider.oninput = updateUI;

resizeCanvas();
updateUI();
instructionChip.textContent = "Press Start to begin.";
appShell.classList.add("preGame");
refreshCameraList();
render();
