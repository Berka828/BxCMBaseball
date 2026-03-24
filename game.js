const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const miniMapCanvas = document.getElementById("miniMapCanvas");
const miniCtx = miniMapCanvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const muteBtn = document.getElementById("muteBtn");
const rightHandBtn = document.getElementById("rightHandBtn");
const leftHandBtn = document.getElementById("leftHandBtn");

const scoreEl = document.getElementById("scoreEl");
const pitchesEl = document.getElementById("pitchesEl");
const hitsEl = document.getElementById("hitsEl");
const missesEl = document.getElementById("missesEl");
const veloEl = document.getElementById("veloEl");
const instructionChip = document.getElementById("instructionChip");

const pitchSpeedSlider = document.getElementById("pitchSpeed");
const swingThresholdSlider = document.getElementById("swingThreshold");
const pitchDelaySlider = document.getElementById("pitchDelay");

const pitchSpeedVal = document.getElementById("pitchSpeedVal");
const swingThresholdVal = document.getElementById("swingThresholdVal");
const pitchDelayVal = document.getElementById("pitchDelayVal");

pitchSpeedSlider.oninput = () => pitchSpeedVal.textContent = pitchSpeedSlider.value;
swingThresholdSlider.oninput = () => swingThresholdVal.textContent = swingThresholdSlider.value;
pitchDelaySlider.oninput = () => pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;

let detector = null;
let animationId = null;
let gameState = "start";
let battingSide = "right";

let score = 0;
let hits = 0;
let misses = 0;
let bestExitVelo = 0;
let pitchesLeft = 10;
const roundPitches = 10;

let prevBatPoint = null;
let batVelocity = { x: 0, y: 0, speed: 0 };

let ball = null;
let hitText = "";
let hitTextTimer = 0;
let flashTimer = 0;
let confetti = [];
let floatingStars = [];
let homerBursts = [];
let pitchTimer = null;
let screenShakeTimer = 0;
let screenShakeAmount = 0;

const BALL_RADIUS = 14;
const GRAVITY = 0.44;
const CONTACT_DISTANCE = 68;
const BAT_LENGTH = 132;

// smaller overall figure on screen
const SKELETON_SCALE = 0.68;
const SKELETON_OFFSET_Y = 100;
const SKELETON_OFFSET_X = 0;

// ---------- AUDIO ----------
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioCtx = new AudioCtx();
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

function tone(freq, duration, type = "sine", gainValue = 0.12, startTime = 0) {
  if (!soundEnabled || !audioCtx) return;

  const now = audioCtx.currentTime + startTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function playStartSound() {
  tone(523.25, 0.10, "triangle", 0.14, 0);
  tone(659.25, 0.12, "triangle", 0.14, 0.08);
  tone(783.99, 0.16, "triangle", 0.14, 0.16);
}

function playPitchSound() {
  tone(240, 0.08, "sawtooth", 0.09, 0);
  tone(180, 0.08, "sawtooth", 0.07, 0.05);
}

function playMissSound() {
  tone(220, 0.08, "square", 0.08, 0);
  tone(170, 0.10, "square", 0.06, 0.06);
}

function playHitSound() {
  tone(180, 0.03, "square", 0.14, 0);
  tone(320, 0.08, "triangle", 0.10, 0.015);
}

function playBigHitSound() {
  tone(220, 0.04, "square", 0.15, 0);
  tone(440, 0.08, "triangle", 0.12, 0.03);
  tone(660, 0.12, "triangle", 0.10, 0.08);
}

function playHomeRunSound() {
  tone(392, 0.10, "triangle", 0.14, 0);
  tone(523.25, 0.10, "triangle", 0.14, 0.08);
  tone(659.25, 0.12, "triangle", 0.14, 0.16);
  tone(783.99, 0.18, "triangle", 0.14, 0.26);
  tone(1046.5, 0.20, "triangle", 0.12, 0.42);
}

// ---------- HELPERS ----------
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getKeypoint(pose, name, minScore = 0.28) {
  return pose?.keypoints?.find(k => k.name === name && (k.score ?? 0) > minScore) || null;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

window.addEventListener("resize", resizeCanvas);

function updateHud() {
  scoreEl.textContent = score;
  pitchesEl.textContent = pitchesLeft;
  hitsEl.textContent = hits;
  missesEl.textContent = misses;
  veloEl.textContent = Math.round(bestExitVelo);
}

function clearPitchTimer() {
  if (pitchTimer) {
    clearTimeout(pitchTimer);
    pitchTimer = null;
  }
}

function scheduleNextPitch() {
  clearPitchTimer();

  if (pitchesLeft <= 0) return;
  if (gameState !== "playing") return;

  const delayMs = Math.round(parseFloat(pitchDelaySlider.value) * 1000);

  instructionChip.textContent = "Get ready for the next pitch...";
  pitchTimer = setTimeout(() => {
    if (gameState === "playing" && !ball) {
      createPitch();
      instructionChip.textContent = "Swing across your body to meet the ball.";
    }
  }, delayMs);
}

function resetRound() {
  clearPitchTimer();
  score = 0;
  hits = 0;
  misses = 0;
  bestExitVelo = 0;
  pitchesLeft = roundPitches;
  prevBatPoint = null;
  batVelocity = { x: 0, y: 0, speed: 0 };
  ball = null;
  hitText = "";
  hitTextTimer = 0;
  flashTimer = 0;
  confetti = [];
  floatingStars = [];
  homerBursts = [];
  screenShakeTimer = 0;
  screenShakeAmount = 0;
  updateHud();
  instructionChip.textContent = "Big upward swings can turn doubles into triples. Home runs trigger a giant celebration.";
}

// ---------- CAMERA / MODEL ----------
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });

  video.srcObject = stream;

  await new Promise(resolve => {
    video.onloadedmetadata = () => resolve();
  });

  await video.play();
  resizeCanvas();
}

async function loadModel() {
  await tf.ready();
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
    }
  );
}

// ---------- CODE-DRAWN INDOOR STADIUM BACKGROUND ----------
function drawRoundedRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawInteriorWindows(yTop, yBottom) {
  const cols = 11;
  const pad = canvas.width * 0.008;
  const usableW = canvas.width - pad * 2;
  const colW = usableW / cols;

  for (let i = 0; i < cols; i++) {
    const x = pad + i * colW;

    ctx.fillStyle = "#51637a";
    ctx.fillRect(x, yTop, colW - 6, yBottom - yTop);

    const innerPad = 6;
    const ix = x + innerPad;
    const iy = yTop + innerPad;
    const iw = colW - 6 - innerPad * 2;
    const ih = yBottom - yTop - innerPad * 2;

    const winGrad = ctx.createLinearGradient(0, iy, 0, iy + ih);
    winGrad.addColorStop(0, "#eef7ff");
    winGrad.addColorStop(1, "#d8e7f0");
    ctx.fillStyle = winGrad;
    ctx.fillRect(ix, iy, iw, ih);

    ctx.strokeStyle = "rgba(90,110,130,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.5, iy);
    ctx.lineTo(ix + iw * 0.5, iy + ih);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ix, iy + ih * 0.52);
    ctx.lineTo(ix + iw, iy + ih * 0.52);
    ctx.stroke();

    ctx.fillStyle = "rgba(90,102,120,0.28)";
    const baseY = iy + ih;
    for (let b = 0; b < 4; b++) {
      const bx = ix + b * (iw / 4) + 2;
      const bw = iw / 6;
      const bh = ih * (0.25 + ((b + i) % 3) * 0.12);
      ctx.fillRect(bx, baseY - bh, bw, bh);
    }
  }
}

function drawRoofAndLights() {
  const roofGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.18);
  roofGrad.addColorStop(0, "#22324a");
  roofGrad.addColorStop(1, "#36475f");
  ctx.fillStyle = roofGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.16);

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.07);
  ctx.quadraticCurveTo(canvas.width * 0.5, canvas.height * 0.02, canvas.width, canvas.height * 0.07);
  ctx.stroke();

  const lightW = canvas.width * 0.12;
  const lightH = canvas.height * 0.06;

  function drawLightBank(x, y) {
    ctx.save();
    ctx.fillStyle = "#4d5a6d";
    drawRoundedRectPath(x, y, lightW, lightH, 8);
    ctx.fill();
    ctx.strokeStyle = "#2a3442";
    ctx.lineWidth = 3;
    ctx.stroke();

    const cols = 7;
    const rows = 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = x + 14 + c * ((lightW - 28) / (cols - 1));
        const cy = y + 14 + r * ((lightH - 28) / (rows - 1));
        ctx.fillStyle = "#fff8d2";
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawLightBank(canvas.width * 0.18, canvas.height * 0.02);
  drawLightBank(canvas.width * 0.70, canvas.height * 0.02);
}

function drawScoreboardCenter() {
  const cx = canvas.width * 0.51;
  const top = canvas.height * 0.08;
  const boardW = canvas.width * 0.20;
  const boardH = canvas.height * 0.18;

  ctx.save();
  ctx.fillStyle = "#243b73";
  drawRoundedRectPath(cx - boardW * 0.16, top - 10, boardW * 0.32, boardH * 0.25, 18);
  ctx.fill();
  ctx.strokeStyle = "#1a2947";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.max(28, canvas.width * 0.03)}px serif`;
  ctx.textAlign = "center";
  ctx.fillText("NY", cx, top + boardH * 0.13);

  const bodyY = top + boardH * 0.18;
  ctx.fillStyle = "#223a73";
  drawRoundedRectPath(cx - boardW / 2, bodyY, boardW, boardH, 18);
  ctx.fill();
  ctx.strokeStyle = "#142544";
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = "#102446";
  drawRoundedRectPath(cx - boardW * 0.42, bodyY + boardH * 0.10, boardW * 0.84, boardH * 0.34, 12);
  ctx.fill();

  ctx.fillStyle = "#e53a37";
  drawRoundedRectPath(cx - boardW * 0.36, bodyY + boardH * 0.58, boardW * 0.72, boardH * 0.18, 10);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.max(18, canvas.width * 0.016)}px "Nunito", sans-serif`;
  ctx.fillText("BRONX CHILDREN'S", cx, bodyY + boardH * 0.23);

  ctx.fillStyle = "#ffcc33";
  ctx.font = `900 ${Math.max(24, canvas.width * 0.022)}px "Baloo 2",
