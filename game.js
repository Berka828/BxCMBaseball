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
const controlsPanel = document.getElementById("controlsPanel");

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

// default reset between pitches = 3 seconds
pitchDelaySlider.value = 3;

pitchSpeedSlider.oninput = () => pitchSpeedVal.textContent = pitchSpeedSlider.value;
swingThresholdSlider.oninput = () => swingThresholdVal.textContent = swingThresholdSlider.value;
pitchDelaySlider.oninput = () => pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;

let detector = null;
let animationId = null;
let gameState = "start"; // start | countdown | playing | paused | end
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
let timingText = "";
let timingTextTimer = 0;
let flashTimer = 0;

let confetti = [];
let floatingStars = [];
let homerBursts = [];
let homerTrailParticles = [];
let batTrail = [];

let pitchTimer = null;
let countdownTimer = null;
let countdownValue = 5;
let countdownActive = false;

let screenShakeTimer = 0;
let screenShakeAmount = 0;
let bgTick = 0;

let endControlsRevealAt = 0;
let endControlsRevealed = false;
let endFeedback = "";
let gestureStartCooldownUntil = 0;

const BALL_RADIUS = 14;
const GRAVITY = 0.44;
const CONTACT_DISTANCE = 68;
const BAT_LENGTH = 132;

const SKELETON_SCALE = 0.68;
const SKELETON_OFFSET_Y = 100;
const SKELETON_OFFSET_X = 0;

// ---------- IMAGE ASSETS ----------
const yankeesLogoImg = new Image();
let yankeesLogoReady = false;
yankeesLogoImg.onload = () => {
  yankeesLogoReady = true;
};
yankeesLogoImg.onerror = () => {
  yankeesLogoReady = false;
};
yankeesLogoImg.src = "yankees-logo.png";

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

function playCountdownBeep(n) {
  tone(n > 1 ? 660 : 880, 0.10, "triangle", 0.11, 0);
}

function playGoSound() {
  tone(880, 0.08, "triangle", 0.12, 0);
  tone(1174.66, 0.12, "triangle", 0.12, 0.08);
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

function clearCountdownTimer() {
  if (countdownTimer) {
    clearTimeout(countdownTimer);
    countdownTimer = null;
  }
}

function showControlsPanel() {
  if (!controlsPanel) return;
  controlsPanel.style.transition = "opacity 0.7s ease";
  controlsPanel.style.opacity = "1";
  controlsPanel.style.pointerEvents = "auto";
}

function hideControlsPanel() {
  if (!controlsPanel) return;
  controlsPanel.style.transition = "opacity 0.7s ease";
  controlsPanel.style.opacity = "0.08";
  controlsPanel.style.pointerEvents = "none";
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
  clearCountdownTimer();

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
  timingText = "";
  timingTextTimer = 0;
  flashTimer = 0;

  confetti = [];
  floatingStars = [];
  homerBursts = [];
  homerTrailParticles = [];
  batTrail = [];

  screenShakeTimer = 0;
  screenShakeAmount = 0;

  countdownValue = 5;
  countdownActive = false;

  endControlsRevealAt = 0;
  endControlsRevealed = false;
  endFeedback = "";

  updateHud();
  instructionChip.textContent = "Raise both hands, practice swing, or press Start to begin.";
  showControlsPanel();
}

function buildEndFeedback() {
  if (hits >= 8 && bestExitVelo >= 220) {
    return "Excellent round. Strong contact, great timing, and big power.";
  }
  if (hits >= 6) {
    return "Nice work. You made solid contact and kept the bat moving well.";
  }
  if (bestExitVelo >= 220) {
    return "Great power. Try adding even better timing for more strong hits.";
  }
  if (misses > hits) {
    return "Keep your eyes on the ball and start your swing a little earlier.";
  }
  return "Good effort. Smooth swings and better timing will boost your score.";
}

function startEndSequence() {
  gameState = "end";
  endFeedback = buildEndFeedback();
  endControlsRevealAt = performance.now() + 10000;
  endControlsRevealed = false;
  hideControlsPanel();
  instructionChip.textContent = "Round over. Review your results on screen.";
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
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );
}

// ---------- BACKGROUND ----------
function drawRoundedRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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

function drawColorfulBronxBranding(yTop, sceneH) {
  const letters = [
    { ch: "B", color: "rgba(255,210,50,0.56)", x: 0.12 },
    { ch: "R", color: "rgba(245,140,50,0.56)", x: 0.30 },
    { ch: "O", color: "rgba(50,180,240,0.56)", x: 0.50 },
    { ch: "N", color: "rgba(210,80,200,0.56)", x: 0.70 },
    { ch: "X", color: "rgba(90,200,90,0.56)", x: 0.88 }
  ];

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const l of letters) {
    const drift = Math.sin(bgTick * 0.01 + l.x * 4) * 5;
    const x = canvas.width * l.x + drift;
    const y = yTop + sceneH * 0.42;

    // widen letters horizontally so they read clearly
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.45, 1);
    ctx.font = `900 ${Math.max(130, canvas.width * 0.17)}px "Baloo 2", sans-serif`;
    ctx.fillStyle = l.color;
    ctx.fillText(l.ch, 0, 0);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(74, 43, 143, 0.52)";
  ctx.font = `900 ${Math.max(26, canvas.width * 0.026)}px "Nunito", sans-serif`;
  ctx.fillText("CHILDREN'S MUSEUM", canvas.width * 0.5, yTop + sceneH * 0.76);
  ctx.restore();
}

function drawWindowScene(yTop, yBottom) {
  const cols = 11;
  const pad = canvas.width * 0.008;
  const usableW = canvas.width - pad * 2;
  const colW = usableW / cols;
  const sceneH = yBottom - yTop;

  drawColorfulBronxBranding(yTop, sceneH);

  for (let i = 0; i < cols; i++) {
    const x = pad + i * colW;

    ctx.fillStyle = "#51637a";
    ctx.fillRect(x, yTop, colW - 6, sceneH);

    const innerPad = 6;
    const ix = x + innerPad;
    const iy = yTop + innerPad;
    const iw = colW - 6 - innerPad * 2;
    const ih = sceneH - innerPad * 2;

    const winGrad = ctx.createLinearGradient(0, iy, 0, iy + ih);
    winGrad.addColorStop(0, "rgba(238,247,255,0.34)");
    winGrad.addColorStop(1, "rgba(216,231,240,0.24)");
    ctx.fillStyle = winGrad;
    ctx.fillRect(ix, iy, iw, ih);

    ctx.fillStyle = "rgba(90,102,120,0.14)";
    const baseY = iy + ih;
    const drift = (bgTick * 0.12) % (iw * 0.4);
    for (let b = -1; b < 5; b++) {
      const bx = ix + b * (iw / 4) - drift;
      const bw = iw / 6;
      const bh = ih * (0.22 + ((b + i + 6) % 3) * 0.12);
      ctx.fillRect(bx, baseY - bh, bw, bh);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.18, iy);
    ctx.lineTo(ix + iw * 0.46, iy + ih);
    ctx.stroke();

    ctx.strokeStyle = "rgba(90,110,130,0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.5, iy);
    ctx.lineTo(ix + iw * 0.5, iy + ih);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ix, iy + ih * 0.52);
    ctx.lineTo(ix + iw, iy + ih * 0.52);
    ctx.stroke();
  }
}

function drawYankeesLogo(x, y, w, h) {
  if (yankeesLogoReady) {
    ctx.drawImage(yankeesLogoImg, x, y, w, h);
    return;
  }

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `900 ${Math.max(18, w * 0.55)}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NY", x + w / 2, y + h / 2);
}

function drawFenceWall(yTop) {
  const fenceY = yTop;
  const wallY = yTop + canvas.height * 0.07;
  const wallH = canvas.height * 0.11;

  ctx.strokeStyle = "#5f6c7d";
  ctx.lineWidth = 2;
  const fenceDrift = (bgTick * 0.08) % 18;
  for (let x = -20; x < canvas.width + 20; x += 18) {
    const xx = x - fenceDrift;

    ctx.beginPath();
    ctx.moveTo(xx, fenceY);
    ctx.lineTo(xx + 20, wallY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(xx + 20, fenceY);
    ctx.lineTo(xx, wallY);
    ctx.stroke();
  }

  for (let x = 0; x < canvas.width; x += canvas.width / 10) {
    ctx.strokeStyle = "#445365";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, fenceY - 6);
    ctx.lineTo(x, wallY);
    ctx.stroke();
  }

  const wallGrad = ctx.createLinearGradient(0, wallY, 0, wallY + wallH);
  wallGrad.addColorStop(0, "#304d8a");
  wallGrad.addColorStop(1, "#223b71");
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, wallY, canvas.width, wallH);

  const sections = 10;
  const sectionW = canvas.width / sections;

  for (let i = 0; i < sections; i++) {
    const x = i * sectionW;
    const cx = x + sectionW / 2;
    const cy = wallY + wallH * 0.56;

    if (i % 2 === 0) {
      const logoW = Math.min(sectionW * 0.48, 56);
      const logoH = logoW;
      drawYankeesLogo(cx - logoW / 2, cy - logoH / 2, logoW, logoH);
    } else {
      const barW = Math.max(18, canvas.width * 0.010);
      const barH = 4;

      ctx.fillStyle = "#f4c542";
      ctx.fillRect(cx - 42, cy - 13, barW, barH);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx - 42, cy - 5, barW, barH);

      ctx.fillStyle = "#111111";
      ctx.fillRect(cx - 42, cy + 3, barW, barH);

      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${Math.max(10, canvas.width * 0.010)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("PLAYERS", cx - 18, cy - 4);
      ctx.fillText("ALLIANCE", cx - 18, cy + 10);
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  for (let i = 1; i < sections; i++) {
    const x = i * sectionW;
    ctx.beginPath();
    ctx.moveTo(x, wallY);
    ctx.lineTo(x, wallY + wallH);
    ctx.stroke();
  }
}

function drawIndoorField() {
  const fieldTop = canvas.height * 0.68;

  const turfGrad = ctx.createLinearGradient(0, fieldTop, 0, canvas.height);
  turfGrad.addColorStop(0, "#65b84f");
  turfGrad.addColorStop(1, "#4d9c3e");
  ctx.fillStyle = turfGrad;
  ctx.fillRect(0, fieldTop, canvas.width, canvas.height - fieldTop);

  const stripeH = (canvas.height - fieldTop) / 6;
  const stripeShift = Math.sin(bgTick * 0.01) * 4;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(stripeShift, fieldTop + i * stripeH, canvas.width, stripeH);
  }

  ctx.fillStyle = "#c97342";
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.00, canvas.height * 0.80);
  ctx.lineTo(canvas.width * 0.18, canvas.height * 0.78);
  ctx.lineTo(canvas.width * 0.28, canvas.height * 0.93);
  ctx.lineTo(canvas.width * 0.00, canvas.height * 0.98);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.05, canvas.height * 0.87);
  ctx.lineTo(canvas.width * 0.17, canvas.height * 0.87);
  ctx.lineTo(canvas.width * 0.26, canvas.height * 0.98);
  ctx.lineTo(canvas.width * 0.14, canvas.height * 0.98);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.07, canvas.height * 0.83);
  ctx.lineTo(canvas.width * 0.19, canvas.height * 0.83);
  ctx.lineTo(canvas.width * 0.28, canvas.height * 0.94);
  ctx.lineTo(canvas.width * 0.16, canvas.height * 0.94);
  ctx.closePath();
  ctx.stroke();

  const px = canvas.width * 0.12;
  const py = canvas.height * 0.89;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(px - 18, py);
  ctx.lineTo(px + 6, py);
  ctx.lineTo(px + 16, py + 8);
  ctx.lineTo(px - 2, py + 18);
  ctx.lineTo(px - 22, py + 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#c26b3d";
  ctx.beginPath();
  ctx.ellipse(
    canvas.width * 0.78,
    canvas.height * 0.88,
    canvas.width * 0.12,
    canvas.height * 0.08,
    -0.08,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "#f1e9d8";
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.83, canvas.height * 0.81);
  ctx.lineTo(canvas.width * 0.85, canvas.height * 0.805);
  ctx.lineTo(canvas.width * 0.86, canvas.height * 0.82);
  ctx.lineTo(canvas.width * 0.84, canvas.height * 0.835);
  ctx.lineTo(canvas.width * 0.825, canvas.height * 0.825);
  ctx.closePath();
  ctx.fill();
}

function drawBackground() {
  bgTick += 1;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.55);
  skyGrad.addColorStop(0, "#2c3d57");
  skyGrad.addColorStop(1, "#b8c8d6");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawRoofAndLights();
  drawWindowScene(canvas.height * 0.16, canvas.height * 0.55);
  drawFenceWall(canvas.height * 0.50);
  drawIndoorField();

  const haze = ctx.createLinearGradient(0, 0, 0, canvas.height);
  haze.addColorStop(0, "rgba(255,255,255,0.06)");
  haze.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ---------- GESTURE START ----------
function wristsAboveShoulders(pose) {
  const lw = getKeypoint(pose, "left_wrist", 0.25);
  const rw = getKeypoint(pose, "right_wrist", 0.25);
  const ls = getKeypoint(pose, "left_shoulder", 0.25);
  const rs = getKeypoint(pose, "right_shoulder", 0.25);

  if (!lw || !rw || !ls || !rs) return false;
  return lw.y < ls.y && rw.y < rs.y;
}

function tryGestureStart(pose) {
  if (gameState !== "start") return;
  if (countdownActive) return;
  if (performance.now() < gestureStartCooldownUntil) return;

  const handsUp = wristsAboveShoulders(pose);
  const practiceSwing = batVelocity.speed > Math.max(parseFloat(swingThresholdSlider.value) * 0.85, 260);

  if (handsUp || practiceSwing) {
    gestureStartCooldownUntil = performance.now() + 2500;
    startCountdown();
  }
}

// ---------- FX ----------
function spawnConfetti(x, y, count) {
  for (let i = 0; i < count; i++) {
    confetti.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 8 - 1.5,
      size: 4 + Math.random() * 7,
      life: 22 + Math.random() * 24,
      color: ["#ff5252", "#ffd54f", "#66bb6a", "#42a5f5", "#ab47bc", "#ff7043"][i % 6]
    });
  }
}

function spawnStars(x, y, label) {
  const count = label === "HOME RUN!" ? 8 : 4;
  for (let i = 0; i < count; i++) {
    floatingStars.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vy: -1 - Math.random() * 1.2,
      life: 24 + Math.random() * 10,
      size: 10 + Math.random() * 10
    });
  }
}

function triggerHomeRunCelebration(x, y) {
  screenShakeTimer = 28;
  screenShakeAmount = 14;
  flashTimer = 14;

  for (let i = 0; i < 4; i++) {
    homerBursts.push({
      x: x + (Math.random() - 0.5) * 120,
      y: y + (Math.random() - 0.5) * 80,
      radius: 10,
      life: 26 + i * 4,
      color: ["#ffd54f", "#42a5f5", "#ff7043", "#66bb6a"][i % 4]
    });
  }

  spawnConfetti(x, y, 100);
  spawnStars(x, y, "HOME RUN!");
  spawnStars(x + 80, y - 40, "HOME RUN!");
  spawnStars(x - 80, y - 20, "HOME RUN!");
}

function updateAndDrawConfetti() {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.20;
    p.life--;

    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size * 0.7);

    if (p.life <= 0) confetti.splice(i, 1);
  }
}

function drawStar(x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const sx = Math.cos(a) * r;
    const sy = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
    const a2 = a + Math.PI / 5;
    ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function updateAndDrawStars() {
  for (let i = floatingStars.length - 1; i >= 0; i--) {
    const s = floatingStars[i];
    s.y += s.vy;
    s.life--;
    drawStar(s.x, s.y, s.size * 0.5, "rgba(255, 213, 79, 0.9)");
    if (s.life <= 0) floatingStars.splice(i, 1);
  }
}

function updateAndDrawHomerBursts() {
  for (let i = homerBursts.length - 1; i >= 0; i--) {
    const b = homerBursts[i];
    b.radius += 10;
    b.life--;

    ctx.save();
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 6;
    ctx.globalAlpha = Math.max(b.life / 30, 0);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (b.life <= 0) homerBursts.splice(i, 1);
  }
}

function updateAndDrawHomerTrailParticles() {
  for (let i = homerTrailParticles.length - 1; i >= 0; i--) {
    const p = homerTrailParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;

    ctx.save();
    ctx.globalAlpha = Math.max(p.life / 24, 0);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (p.life <= 0) homerTrailParticles.splice(i, 1);
  }
}

function drawHitOverlay() {
  if (hitTextTimer > 0) {
    const scale = 1 + Math.sin((34 - hitTextTimer) * 0.3) * 0.08;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height * 0.22);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#14304b";
    ctx.fillStyle = hitText.includes("HOME RUN!") ? "#ffd54f" : "#ffffff";
    ctx.font = '900 64px "Baloo 2", sans-serif';
    ctx.strokeText(hitText, 0, 0);
    ctx.fillText(hitText, 0, 0);
    ctx.restore();
    hitTextTimer--;
  }

  if (timingTextTimer > 0) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#14304b";

    let fill = "#ffffff";
    if (timingText === "PERFECT!") fill = "#66e07a";
    if (timingText === "TOO EARLY" || timingText === "TOO LATE") fill = "#ffcc66";

    ctx.fillStyle = fill;
    ctx.font = '900 40px "Baloo 2", sans-serif';
    ctx.strokeText(timingText, canvas.width / 2, canvas.height * 0.30);
    ctx.fillText(timingText, canvas.width / 2, canvas.height * 0.30);
    ctx.restore();
    timingTextTimer--;
  }

  if (flashTimer > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashTimer * 0.022})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashTimer--;
  }
}

function getShakeOffset() {
  if (screenShakeTimer <= 0) return { x: 0, y: 0 };
  screenShakeTimer--;
  return {
    x: (Math.random() - 0.5) * screenShakeAmount,
    y: (Math.random() - 0.5) * screenShakeAmount
  };
}

function drawPauseOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 64px "Baloo 2", sans-serif';
  ctx.fillText("PAUSED", canvas.width / 2, canvas.height * 0.35);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 28px "Nunito", sans-serif';
  ctx.fillText("Press Pause, Space, or Esc to resume.", canvas.width / 2, canvas.height * 0.43);
}

function drawStartOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 60px "Baloo 2", sans-serif';
  ctx.fillText("PRESS START", canvas.width / 2, canvas.height * 0.31);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 26px "Nunito", sans-serif';
  ctx.fillText("Choose left or right handed play.", canvas.width / 2, canvas.height * 0.39);
  ctx.fillText("Raise both hands or do a practice swing to start too.", canvas.width / 2, canvas.height * 0.45);
  ctx.fillText("Press Space or Esc anytime to pause.", canvas.width / 2, canvas.height * 0.51);
}

function drawEndOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 56px "Baloo 2", sans-serif';
  ctx.fillText("ROUND OVER!", canvas.width / 2, canvas.height * 0.31);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 28px "Nunito", sans-serif';
  ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height * 0.40);
  ctx.fillText(`Hits: ${hits}   |   Misses: ${misses}   |   Best EV: ${Math.round(bestExitVelo)}`, canvas.width / 2, canvas.height * 0.47);

  ctx.fillStyle = "#dfeaff";
  ctx.font = '900 24px "Nunito", sans-serif';
  wrapCenteredText(endFeedback, canvas.width / 2, canvas.height * 0.58, canvas.width * 0.62, 32);

  const secondsLeft = Math.max(0, Math.ceil((endControlsRevealAt - performance.now()) / 1000));
  if (!endControlsRevealed && secondsLeft > 0) {
    ctx.fillStyle = "#ffffff";
    ctx.font = '900 20px "Nunito", sans-serif';
    ctx.fillText(`Controls return in ${secondsLeft}...`, canvas.width / 2, canvas.height * 0.71);
  }
}

function wrapCenteredText(text, centerX, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  const lines = [];

  ctx.save();
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  ctx.restore();

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], centerX, y + i * lineHeight);
  }
}

function drawCountdownOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#14304b";

  if (countdownValue > 0) {
    ctx.font = '900 120px "Baloo 2", sans-serif';
    ctx.strokeText(String(countdownValue), canvas.width / 2, canvas.height * 0.45);
    ctx.fillText(String(countdownValue), canvas.width / 2, canvas.height * 0.45);

    ctx.fillStyle = "#ffffff";
    ctx.font = '900 28px "Nunito", sans-serif';
    ctx.fillText("Get set...", canvas.width / 2, canvas.height * 0.55);
  } else {
    ctx.font = '900 90px "Baloo 2", sans-serif';
    ctx.strokeText("SWING!", canvas.width / 2, canvas.height * 0.45);
    ctx.fillText("SWING!", canvas.width / 2, canvas.height * 0.45);
  }
}

// ---------- COUNTDOWN ----------
function startCountdown() {
  clearCountdownTimer();
  countdownActive = true;
  countdownValue = 5;
  gameState = "countdown";
  instructionChip.textContent = "Get set...";
  hideControlsPanel();

  const tick = () => {
    if (!countdownActive) return;

    if (countdownValue > 0) {
      playCountdownBeep(countdownValue);
      instructionChip.textContent = `Starting in ${countdownValue}...`;
      countdownValue--;
      countdownTimer = setTimeout(tick, 1000);
    } else {
      playGoSound();
      instructionChip.textContent = "Swing!";
      countdownActive = false;
      gameState = "playing";
      createPitch();
    }
  };

  tick();
}

// ---------- SIDE SELECT ----------
function updateSideButtons() {
  if (battingSide === "right") {
    rightHandBtn.classList.add("active");
    leftHandBtn.classList.remove("active");
  } else {
    leftHandBtn.classList.add("active");
    rightHandBtn.classList.remove("active");
  }
}

rightHandBtn.onclick = () => {
  battingSide = "right";
  prevBatPoint = null;
  updateSideButtons();
};

leftHandBtn.onclick = () => {
  battingSide = "left";
  prevBatPoint = null;
  updateSideButtons();
};

// ---------- MAIN LOOP ----------
async function loop() {
  const shake = getShakeOffset();

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(shake.x, shake.y);

  drawBackground();
  drawMiniMap();

  let pose = null;

  if (detector && ["start", "countdown", "playing"].includes(gameState)) {
    const poses = await detector.estimatePoses(video, { flipHorizontal: true });
    pose = poses[0] || null;
  }

  if (pose) {
    const points = drawStickFigure(pose);
    const battingArm = getBattingArm(points);

    if (battingArm) {
      const batTip = drawBatFromSide(battingArm.wrist, battingArm.elbow);
      if (batTip) {
        updateBatVelocity(batTip);
        updateBatTrail(batTip);

        if (gameState === "playing") {
          tryHit(batTip);
        }

        if (gameState === "start") {
          tryGestureStart(pose);
        }
      }
    } else if (gameState === "start") {
      tryGestureStart(pose);
    }
  }

  drawBatTrail();

  if (gameState === "playing") {
    updateBall();
    drawBall();
    updateAndDrawConfetti();
    updateAndDrawStars();
    updateAndDrawHomerBursts();
    updateAndDrawHomerTrailParticles();
    drawHitOverlay();

    if (pitchesLeft <= 0 && !ball) {
      startEndSequence();
    }
  } else {
    updateAndDrawConfetti();
    updateAndDrawStars();
    updateAndDrawHomerBursts();
    updateAndDrawHomerTrailParticles();
    drawHitOverlay();
  }

  if (gameState === "end" && !endControlsRevealed && performance.now() >= endControlsRevealAt) {
    endControlsRevealed = true;
    showControlsPanel();
    instructionChip.textContent = "Round complete. Start a new game when ready.";
  }

  tickBatTrail();

  if (gameState === "start") drawStartOverlay();
  if (gameState === "countdown") drawCountdownOverlay();
  if (gameState === "paused") drawPauseOverlay();
  if (gameState === "end") drawEndOverlay();

  ctx.restore();
  animationId = requestAnimationFrame(loop);
}

// ---------- BUTTONS ----------
async function startOrResumeGame() {
  initAudio();

  if (!detector) {
    await setupCamera();
    await loadModel();
  }

  if (gameState === "paused") {
    gameState = "playing";
    pauseBtn.textContent = "Pause Game";
    instructionChip.textContent = "Game resumed.";
    hideControlsPanel();
    if (!ball) scheduleNextPitch();
    playStartSound();
    if (!animationId) loop();
    return;
  }

  if (gameState === "start" || gameState === "end") {
    resetRound();
    pauseBtn.textContent = "Pause Game";
    playStartSound();
    startCountdown();

    if (!animationId) loop();
  }
}

function togglePause() {
  if (gameState === "playing") {
    gameState = "paused";
    pauseBtn.textContent = "Resume Game";
    clearPitchTimer();
    clearCountdownTimer();
    showControlsPanel();
    instructionChip.textContent = "Game paused.";
    return;
  }

  if (gameState === "countdown") {
    gameState = "paused";
    countdownActive = false;
    clearCountdownTimer();
    pauseBtn.textContent = "Resume Game";
    showControlsPanel();
    instructionChip.textContent = "Game paused.";
    return;
  }

  if (gameState === "paused") {
    pauseBtn.textContent = "Pause Game";

    if (!ball && hits === 0 && misses === 0 && pitchesLeft === roundPitches) {
      startCountdown();
    } else {
      gameState = "playing";
      hideControlsPanel();
      instructionChip.textContent = "Game resumed.";
      if (!ball) scheduleNextPitch();
      playStartSound();
    }
  }
}

function resetGame() {
  clearPitchTimer();
  clearCountdownTimer();
  resetRound();
  gameState = "start";
  pauseBtn.textContent = "Pause Game";
  showControlsPanel();
  instructionChip.textContent = "Raise both hands, practice swing, or press Start to begin.";
}

startBtn.onclick = startOrResumeGame;
pauseBtn.onclick = togglePause;
resetBtn.onclick = resetGame;

muteBtn.onclick = async () => {
  soundEnabled = !soundEnabled;

  if (soundEnabled) {
    initAudio();
    muteBtn.textContent = "Sound: On";
    playStartSound();
  } else {
    muteBtn.textContent = "Sound: Off";
  }
};

// keyboard pause / resume
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.key === "Escape" || e.key === "Esc") {
    e.preventDefault();
    if (["playing", "paused", "countdown"].includes(gameState)) {
      togglePause();
    }
  }
});

updateSideButtons();
updateHud();
resizeCanvas();
pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;
instructionChip.textContent = "Raise both hands, practice swing, or press Start to begin.";
showControlsPanel();
