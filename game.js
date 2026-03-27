const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const muteBtn = document.getElementById("muteBtn");
const rightHandBtn = document.getElementById("rightHandBtn");
const leftHandBtn = document.getElementById("leftHandBtn");
const instructionChip = document.getElementById("instructionChip");
const controlsPanel = document.getElementById("controlsPanel");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

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

function drawSplash() {
  resizeCanvas();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

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

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 64px "Baloo 2", sans-serif';
  ctx.fillText("BxCM Jr. Sluggers Academy", canvas.width / 2, canvas.height * 0.30);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 26px "Nunito", sans-serif';
  ctx.fillText("Choose your batting side and press Start Game.", canvas.width / 2, canvas.height * 0.40);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(canvas.width * 0.18, canvas.height * 0.58, canvas.width * 0.64, canvas.height * 0.12);

  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 72px "Baloo 2", sans-serif';
  ctx.fillText("READY?", canvas.width / 2, canvas.height * 0.66);
}

async function startCamera() {
  if (cameraStream) return;

  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });

  video.srcObject = cameraStream;
  await video.play();
}

function drawCameraPlaceholder() {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 72px "Baloo 2", sans-serif';
  ctx.fillText(paused ? "PAUSED" : "CAMERA ON", canvas.width / 2, canvas.height * 0.35);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 26px "Nunito", sans-serif';
  ctx.fillText(
    paused ? "Press Pause again to resume." : "Camera initialized. Next step is restoring the full game loop.",
    canvas.width / 2,
    canvas.height * 0.45
  );
}

function render() {
  if (!started) {
    drawSplash();
  } else {
    drawCameraPlaceholder();
  }
  animationId = requestAnimationFrame(render);
}

startBtn.onclick = async () => {
  try {
    instructionChip.textContent = "Starting camera...";
    await startCamera();
    started = true;
    paused = false;
    instructionChip.textContent = "Camera started. Base layout is working again.";
    controlsPanel.style.opacity = "1";
  } catch (err) {
    console.error(err);
    instructionChip.textContent = `Camera failed: ${err.message}`;
  }
  updateUI();
};

pauseBtn.onclick = () => {
  if (!started) return;
  paused = !paused;
  instructionChip.textContent = paused ? "Game paused." : "Game resumed.";
  updateUI();
};

resetBtn.onclick = () => {
  started = false;
  paused = false;
  instructionChip.textContent = "Press Start to begin.";
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

pitchSpeedSlider.oninput = updateUI;
swingThresholdSlider.oninput = updateUI;
pitchDelaySlider.oninput = updateUI;

resizeCanvas();
updateUI();
instructionChip.textContent = "Press Start to begin.";
render();
