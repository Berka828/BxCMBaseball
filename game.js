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

// ---------- CODE-DRAWN BRONX BACKGROUND ----------
function drawCloud(x, y, s, alpha = 0.9) {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
  ctx.arc(x + 24 * s, y - 10 * s, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 50 * s, y, 26 * s, 0, Math.PI * 2);
  ctx.arc(x + 78 * s, y - 6 * s, 20 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBuilding(x, groundY, w, h, color, windowColor, roofType = 0) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x, groundY - h, w, h);

  if (roofType === 1) {
    ctx.beginPath();
    ctx.moveTo(x, groundY - h);
    ctx.lineTo(x + w * 0.5, groundY - h - 18);
    ctx.lineTo(x + w, groundY - h);
    ctx.closePath();
    ctx.fill();
  }

  if (roofType === 2) {
    ctx.fillRect(x + w * 0.4, groundY - h - 18, w * 0.18, 18);
  }

  ctx.fillStyle = windowColor;
  const cols = Math.max(2, Math.floor(w / 18));
  const rows = Math.max(3, Math.floor(h / 22));
  const padX = 6;
  const padY = 8;
  const ww = Math.max(3, (w - padX * 2) / cols - 4);
  const wh = Math.max(4, (h - padY * 2) / rows - 6);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 3 === 0) continue;
      const wx = x + padX + c * ((w - padX * 2) / cols);
      const wy = groundY - h + padY + r * ((h - padY * 2) / rows);
      ctx.fillRect(wx, wy, ww, wh);
    }
  }
  ctx.restore();
}

function drawBronxSkyline(horizonY) {
  const buildings = [
    [canvas.width * 0.06, 44, 120, "#b66a5a", "#ffd88d", 0],
    [canvas.width * 0.10, 54, 165, "#a55252", "#ffd88d", 2],
    [canvas.width * 0.15, 40, 132, "#d98b46", "#ffe49b", 0],
    [canvas.width * 0.22, 34, 108, "#7aa7d8", "#d9f2ff", 2],
    [canvas.width * 0.26, 26, 138, "#57a0d3", "#d9f2ff", 1],
    [canvas.width * 0.67, 34, 118, "#6e8bc8", "#dff1ff", 2],
    [canvas.width * 0.72, 30, 146, "#b07a5f", "#ffe09d", 1],
    [canvas.width * 0.77, 42, 124, "#d9924b", "#ffe09d", 0],
    [canvas.width * 0.83, 36, 110, "#8d92b8", "#eef6ff", 2],
    [canvas.width * 0.88, 30, 100, "#6f7ca0", "#eef6ff", 0]
  ];

  for (const [x, w, h, c, wc, roof] of buildings) {
    drawBuilding(x, horizonY, w, h, c, wc, roof);
  }
}

function drawTreesLine(y) {
  ctx.save();
  for (let i = 0; i < 11; i++) {
    const x = (canvas.width * 0.08) + i * (canvas.width * 0.08);
    const s = 0.8 + (i % 3) * 0.12;
    ctx.fillStyle = "#2f7d39";
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 18 * s, y - 6 * s, 18 * s, 0, Math.PI * 2);
    ctx.arc(x + 34 * s, y + 2 * s, 20 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#6b4b2a";
    ctx.fillRect(x + 12 * s, y + 14 * s, 6 * s, 18 * s);
  }
  ctx.restore();
}

function drawTrainLine(y) {
  const lineY = y;
  ctx.save();

  ctx.strokeStyle = "#2c6c47";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(canvas.width * 0.42, lineY);
  ctx.stroke();

  for (let x = 0; x < canvas.width * 0.42; x += 40) {
    ctx.strokeStyle = "#25563a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 10, lineY);
    ctx.lineTo(x + 26, lineY + 22);
    ctx.lineTo(x + 42, lineY);
    ctx.stroke();
  }

  const trainX = canvas.width * 0.08;
  const cars = 4;
  for (let i = 0; i < cars; i++) {
    const x = trainX + i * 60;
    ctx.fillStyle = "#d7f5ff";
    ctx.fillRect(x, lineY - 20, 54, 18);
    ctx.strokeStyle = "#2b81c5";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, lineY - 20, 54, 18);

    for (let w = 0; w < 3; w++) {
      ctx.fillStyle = "#97d8ff";
      ctx.fillRect(x + 6 + w * 14, lineY - 16, 9, 8);
    }
  }

  ctx.restore();
}

function drawOutfieldWall(yTop) {
  const wallHeight = canvas.height * 0.18;
  const wallBottom = yTop + wallHeight;

  ctx.save();

  // wall body
  const wallGrad = ctx.createLinearGradient(0, yTop, 0, wallBottom);
  wallGrad.addColorStop(0, "#0d4fb5");
  wallGrad.addColorStop(1, "#0a3478");
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, yTop, canvas.width, wallHeight);

  // top rail
  ctx.fillStyle = "#ffb300";
  ctx.fillRect(0, yTop, canvas.width, 8);

  // center dark scoreboard block
  ctx.fillStyle = "#14233a";
  ctx.fillRect(canvas.width * 0.54, yTop + wallHeight * 0.18, canvas.width * 0.16, wallHeight * 0.48);

  // subtle vertical panels
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  for (let x = 0; x < canvas.width; x += canvas.width / 12) {
    ctx.beginPath();
    ctx.moveTo(x, yTop + 12);
    ctx.lineTo(x, wallBottom);
    ctx.stroke();
  }

  // minimal brand marks baked into wall
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `900 ${Math.max(22, canvas.width * 0.03)}px "Baloo 2", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("BX", canvas.width * 0.88, yTop + wallHeight * 0.64);

  ctx.font = `900 ${Math.max(28, canvas.width * 0.045)}px serif`;
  ctx.fillText("NY", canvas.width * 0.12, yTop + wallHeight * 0.64);

  ctx.restore();
}

function drawGrassAndDirt() {
  const horizon = canvas.height * 0.46;
  const groundTop = horizon + canvas.height * 0.10;

  // grass
  const grassGrad = ctx.createLinearGradient(0, groundTop, 0, canvas.height);
  grassGrad.addColorStop(0, "#63d64f");
  grassGrad.addColorStop(1, "#2da14d");
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, groundTop, canvas.width, canvas.height - groundTop);

  // stripes
  const stripeH = (canvas.height - groundTop) / 8;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(0, groundTop + i * stripeH, canvas.width, stripeH);
  }

  // dirt batting area - profile layout
  ctx.fillStyle = "#cf6d2d";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.77);
  ctx.lineTo(canvas.width * 0.18, canvas.height * 0.77);
  ctx.lineTo(canvas.width * 0.24, canvas.height * 0.90);
  ctx.lineTo(0, canvas.height * 0.90);
  ctx.closePath();
  ctx.fill();

  // plate
  const px = canvas.width * 0.20;
  const py = canvas.height * 0.86;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(px - 24, py);
  ctx.lineTo(px + 8, py);
  ctx.lineTo(px + 20, py + 10);
  ctx.lineTo(px - 5, py + 24);
  ctx.lineTo(px - 30, py + 12);
  ctx.closePath();
  ctx.fill();

  // foul line perspective for profile feeling
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(px + 10, py + 8);
  ctx.lineTo(canvas.width * 0.92, canvas.height * 0.70);
  ctx.stroke();
}

function drawBackground() {
  // sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, "#72d2ff");
  skyGrad.addColorStop(0.48, "#a8ecff");
  skyGrad.addColorStop(0.49, "#c9f7ff");
  skyGrad.addColorStop(1, "#53b94c");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawCloud(canvas.width * 0.08, canvas.height * 0.11, 1.0, 0.92);
  drawCloud(canvas.width * 0.34, canvas.height * 0.14, 0.8, 0.85);
  drawCloud(canvas.width * 0.70, canvas.height * 0.10, 1.1, 0.9);
  drawCloud(canvas.width * 0.86, canvas.height * 0.16, 0.85, 0.82);

  const skylineGround = canvas.height * 0.37;
  drawBronxSkyline(skylineGround);
  drawTreesLine(canvas.height * 0.40);
  drawTrainLine(canvas.height * 0.35);
  drawOutfieldWall(canvas.height * 0.43);
  drawGrassAndDirt();

  // subtle vignette
  const vignette = ctx.createRadialGradient(
    canvas.width * 0.5, canvas.height * 0.45, canvas.width * 0.18,
    canvas.width * 0.5, canvas.height * 0.45, canvas.width * 0.72
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ---------- STAND GUIDE ----------
function drawStandGuide() {
  const x = canvas.width * 0.22;
  const y = canvas.height * 0.82;
  const rx = canvas.width * 0.07;
  const ry = canvas.height * 0.038;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 213, 79, 0.95)";
  ctx.fillStyle = "rgba(255, 213, 79, 0.15)";
  ctx.lineWidth = 5;
  ctx.setLineDash([14, 10]);

  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 24px "Baloo 2", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("STAND HERE", x, y + 8);
  ctx.restore();
}

// ---------- STICK FIGURE ----------
function drawStickBone(a, b, color, width = 6, glow = 8) {
  if (!a || !b) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.shadowBlur = glow;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawStickJoint(p, radius = 5, color = "#ffffff", glow = 6) {
  if (!p) return;

  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowBlur = glow;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStickFigure(pose) {
  const ls = getKeypoint(pose, "left_shoulder");
  const rs = getKeypoint(pose, "right_shoulder");
  const le = getKeypoint(pose, "left_elbow");
  const re = getKeypoint(pose, "right_elbow");
  const lw = getKeypoint(pose, "left_wrist");
  const rw = getKeypoint(pose, "right_wrist");
  const lh = getKeypoint(pose, "left_hip");
  const rh = getKeypoint(pose, "right_hip");
  const lk = getKeypoint(pose, "left_knee");
  const rk = getKeypoint(pose, "right_knee");
  const la = getKeypoint(pose, "left_ankle");
  const ra = getKeypoint(pose, "right_ankle");
  const nose = getKeypoint(pose, "nose");
  const leye = getKeypoint(pose, "left_eye", 0.2);
  const reye = getKeypoint(pose, "right_eye", 0.2);

  const armColor = "#58e1ff";
  const legColor = "#8df55f";
  const coreColor = "#ffd54f";
  const headColor = "#ffb86c";

  drawStickBone(ls, rs, coreColor, 7);
  drawStickBone(ls, lh, coreColor, 6);
  drawStickBone(rs, rh, coreColor, 6);
  drawStickBone(lh, rh, coreColor, 7);

  drawStickBone(ls, le, armColor, 6);
  drawStickBone(le, lw, armColor, 6);
  drawStickBone(rs, re, armColor, 6);
  drawStickBone(re, rw, armColor, 6);

  drawStickBone(lh, lk, legColor, 6);
  drawStickBone(lk, la, legColor, 6);
  drawStickBone(rh, rk, legColor, 6);
  drawStickBone(rk, ra, legColor, 6);

  if (nose && ls && rs) {
    const neck = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    drawStickBone(neck, nose, headColor, 5);
  }

  if (nose && leye && reye) {
    const headR = Math.max(14, Math.abs(leye.x - reye.x) * 1.1);
    ctx.save();
    ctx.strokeStyle = headColor;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 8;
    ctx.shadowColor = headColor;
    ctx.beginPath();
    ctx.arc(nose.x, nose.y + 5, headR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  [ls, rs, le, re, lw, rw, lh, rh, lk, rk, la, ra].forEach(p => drawStickJoint(p, 4, "#ffffff", 5));

  return { rw, re, lw, le };
}

function getBattingArm(points) {
  if (battingSide === "right") {
    return (points.rw && points.re) ? { wrist: points.rw, elbow: points.re } : null;
  }
  return (points.lw && points.le) ? { wrist: points.lw, elbow: points.le } : null;
}

function drawBatFromSide(wrist, elbow) {
  if (!wrist || !elbow) return null;

  const dx = wrist.x - elbow.x;
  const dy = wrist.y - elbow.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;

  const batTip = {
    x: wrist.x + nx * BAT_LENGTH,
    y: wrist.y + ny * BAT_LENGTH
  };

  const handleEnd = {
    x: wrist.x - nx * 26,
    y: wrist.y - ny * 26
  };

  ctx.save();
  ctx.lineCap = "round";

  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(handleEnd.x, handleEnd.y);
  ctx.lineTo(batTip.x, batTip.y);
  ctx.stroke();

  ctx.strokeStyle = "#ffca28";
  ctx.lineWidth = 8;
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#ffca28";
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(batTip.x, batTip.y);
  ctx.stroke();

  ctx.restore();

  return batTip;
}

function updateBatVelocity(point) {
  const now = performance.now();

  if (!prevBatPoint) {
    prevBatPoint = { ...point, t: now };
    batVelocity = { x: 0, y: 0, speed: 0 };
    return;
  }

  const dt = Math.max((now - prevBatPoint.t) / 1000, 0.001);
  const vx = (point.x - prevBatPoint.x) / dt;
  const vy = (point.y - prevBatPoint.y) / dt;

  batVelocity = {
    x: vx,
    y: vy,
    speed: Math.hypot(vx, vy)
  };

  prevBatPoint = { ...point, t: now };
}

// ---------- BALL / HITS ----------
function createPitch() {
  if (pitchesLeft <= 0) return;
  if (gameState !== "playing") return;
  if (ball) return;

  ball = {
    x: canvas.width + 30,
    y: canvas.height * (0.44 + Math.random() * 0.12),
    vx: -parseFloat(pitchSpeedSlider.value) - Math.random() * 1.2,
    vy: (Math.random() - 0.5) * 0.25,
    hit: false,
    active: true,
    trail: [],
    result: ""
  };

  playPitchSound();
}

function classifyHit(power, upwardSwing) {
  if (power > 1.9 && upwardSwing > 0.6) {
    return { label: "HOME RUN!", points: 80, confettiCount: 42, launchBoost: 1.28 };
  }
  if (power > 1.5 && upwardSwing > 0.25) {
    return { label: "TRIPLE!", points: 45, confettiCount: 24, launchBoost: 1.02 };
  }
  if (power > 1.08) {
    return { label: "DOUBLE!", points: 28, confettiCount: 16, launchBoost: 0.88 };
  }
  if (power > 0.66) {
    return { label: "SINGLE!", points: 16, confettiCount: 10, launchBoost: 0.72 };
  }
  return { label: "FOUL TIP!", points: 8, confettiCount: 6, launchBoost: 0.54 };
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

function tryHit(batTip) {
  if (!ball || !ball.active || ball.hit) return;

  const d = Math.hypot(ball.x - batTip.x, ball.y - batTip.y);
  if (d > CONTACT_DISTANCE) return;
  if (batVelocity.speed < parseFloat(swingThresholdSlider.value)) return;

  ball.hit = true;

  const power = clamp(batVelocity.speed / 700, 0.35, 2.1);
  const upwardSwing = clamp((-batVelocity.y) / 700, -0.4, 1.0);

  let lateral;
  if (battingSide === "right") {
    lateral = batVelocity.x >= 0 ? 1 : -1;
  } else {
    lateral = batVelocity.x <= 0 ? -1 : 1;
  }

  const result = classifyHit(power, upwardSwing);

  const baseVX = 9 + power * 8;
  const baseVY = -(4 + Math.max(0, upwardSwing) * 7 + power * 2.2);

  ball.vx = lateral * baseVX * result.launchBoost + (Math.random() - 0.5) * 1.4;
  ball.vy = baseVY * result.launchBoost + (Math.random() - 0.5) * 1.0;
  ball.result = result.label;

  score += result.points;
  hits++;
  bestExitVelo = Math.max(bestExitVelo, power * 100);
  pitchesLeft--;

  showHitText(result.label);
  spawnConfetti(ball.x, ball.y, result.confettiCount);
  spawnStars(ball.x, ball.y, result.label);
  updateHud();

  if (result.label === "HOME RUN!") {
    playHomeRunSound();
    triggerHomeRunCelebration(ball.x, ball.y);
    instructionChip.textContent = "HOME RUN! BIG celebration!";
  } else if (result.label === "TRIPLE!" || result.label === "DOUBLE!") {
    playBigHitSound();
    instructionChip.textContent = result.label;
  } else {
    playHitSound();
    instructionChip.textContent = result.label;
  }
}

function resolveMiss() {
  misses++;
  pitchesLeft--;
  ball = null;
  updateHud();
  playMissSound();
  instructionChip.textContent = "Miss! Reset and get ready.";
  scheduleNextPitch();
}

function resolveFinishedHit() {
  ball = null;
  instructionChip.textContent = "Nice! Get ready for the next pitch.";
  scheduleNextPitch();
}

function updateBall() {
  if (!ball || !ball.active) return;
  if (gameState !== "playing") return;

  if (!ball.hit) {
    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.trail.push({ x: ball.x, y: ball.y, a: 0.16 });
    if (ball.trail.length > 7) ball.trail.shift();

    if (ball.x < -40) {
      resolveMiss();
    }
  } else {
    ball.vy += GRAVITY;
    ball.vx *= 0.992;
    ball.vy *= 0.996;

    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.trail.push({ x: ball.x, y: ball.y, a: 0.24 });
    if (ball.trail.length > 16) ball.trail.shift();

    if (ball.y > canvas.height + 60 || ball.x < -90 || ball.x > canvas.width + 90) {
      resolveFinishedHit();
    }
  }
}

function drawBall() {
  if (!ball || !ball.active) return;

  for (let i = 0; i < ball.trail.length; i++) {
    const p = ball.trail[i];
    const alpha = ((i + 1) / ball.trail.length) * p.a;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, BALL_RADIUS * 0.58, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#cfd8dc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS - 2, 0.4, 2.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS - 2, 3.6, 5.7);
  ctx.stroke();
  ctx.restore();
}

// ---------- MINIMAP ----------
function drawMiniMap() {
  miniCtx.clearRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);

  miniCtx.fillStyle = "#0b2343";
  miniCtx.fillRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);

  miniCtx.strokeStyle = "rgba(255,255,255,0.18)";
  miniCtx.lineWidth = 2;
  miniCtx.strokeRect(1, 1, miniMapCanvas.width - 2, miniMapCanvas.height - 2);

  miniCtx.fillStyle = "rgba(255,255,255,0.06)";
  miniCtx.fillRect(18, 55, miniMapCanvas.width - 36, 40);

  miniCtx.strokeStyle = "rgba(255,255,255,0.30)";
  miniCtx.lineWidth = 4;
  miniCtx.beginPath();
  miniCtx.moveTo(miniMapCanvas.width - 24, 75);
  miniCtx.lineTo(34, 75);
  miniCtx.stroke();

  miniCtx.fillStyle = "#ffffff";
  miniCtx.beginPath();
  miniCtx.moveTo(20, 75);
  miniCtx.lineTo(28, 66);
  miniCtx.lineTo(38, 75);
  miniCtx.lineTo(34, 86);
  miniCtx.lineTo(24, 86);
  miniCtx.closePath();
  miniCtx.fill();

  miniCtx.fillStyle = "#ffd54f";
  miniCtx.beginPath();
  miniCtx.arc(miniMapCanvas.width - 24, 75, 7, 0, Math.PI * 2);
  miniCtx.fill();

  if (ball) {
    const bx = clamp((ball.x / canvas.width) * miniMapCanvas.width, 10, miniMapCanvas.width - 10);
    const by = clamp((ball.y / canvas.height) * miniMapCanvas.height, 18, miniMapCanvas.height - 18);

    miniCtx.fillStyle = "#ffffff";
    miniCtx.beginPath();
    miniCtx.arc(bx, by, 7, 0, Math.PI * 2);
    miniCtx.fill();
  }

  miniCtx.fillStyle = "#dbeaff";
  miniCtx.font = '900 12px "Nunito", sans-serif';
  miniCtx.textAlign = "left";
  miniCtx.fillText(battingSide === "right" ? "Right-handed" : "Left-handed", 12, 18);
}

// ---------- FX ----------
function showHitText(text) {
  hitText = text;
  hitTextTimer = 34;
  flashTimer = text === "HOME RUN!" ? 9 : 4;
}

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

function drawHitOverlay() {
  if (hitTextTimer > 0) {
    const scale = 1 + Math.sin((34 - hitTextTimer) * 0.3) * 0.08;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height * 0.23);
    ctx.scale(scale, scale);

    ctx.textAlign = "center";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#14304b";
    ctx.fillStyle = hitText === "HOME RUN!" ? "#ffd54f" : "#ffffff";
    ctx.font = hitText.length > 8
      ? '900 56px "Baloo 2", sans-serif'
      : '900 66px "Baloo 2", sans-serif';

    ctx.strokeText(hitText, 0, 0);
    ctx.fillText(hitText, 0, 0);
    ctx.restore();

    hitTextTimer--;
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
  ctx.fillText("Press Pause Game again to resume.", canvas.width / 2, canvas.height * 0.43);
}

function drawStartOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 60px "Baloo 2", sans-serif';
  ctx.fillText("PRESS START", canvas.width / 2, canvas.height * 0.33);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 28px "Nunito", sans-serif';
  ctx.fillText("Choose left or right handed play.", canvas.width / 2, canvas.height * 0.41);
  ctx.fillText("The bat stays on that side until you change it.", canvas.width / 2, canvas.height * 0.47);
}

function drawEndOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 56px "Baloo 2", sans-serif';
  ctx.fillText("ROUND OVER!", canvas.width / 2, canvas.height * 0.34);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 28px "Nunito", sans-serif';
  ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height * 0.43);
  ctx.fillText(`Hits: ${hits}   |   Best EV: ${Math.round(bestExitVelo)}`, canvas.width / 2, canvas.height * 0.50);
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
  drawStandGuide();
  drawMiniMap();

  let pose = null;

  if (detector && gameState === "playing") {
    const poses = await detector.estimatePoses(video, { flipHorizontal: true });
    pose = poses[0] || null;
  }

  if (gameState === "playing") {
    if (pose) {
      const points = drawStickFigure(pose);
      const battingArm = getBattingArm(points);

      if (battingArm) {
        const batTip = drawBatFromSide(battingArm.wrist, battingArm.elbow);
        if (batTip) {
          updateBatVelocity(batTip);
          tryHit(batTip);
        }
      }
    }

    updateBall();
    drawBall();
    updateAndDrawConfetti();
    updateAndDrawStars();
    updateAndDrawHomerBursts();
    drawHitOverlay();

    if (pitchesLeft <= 0 && !ball) {
      gameState = "end";
      instructionChip.textContent = "Round over. Press Start Game to play again.";
    }
  } else {
    updateAndDrawConfetti();
    updateAndDrawStars();
    updateAndDrawHomerBursts();
    drawHitOverlay();
  }

  if (gameState === "start") {
    drawStartOverlay();
  }

  if (gameState === "paused") {
    drawPauseOverlay();
  }

  if (gameState === "end") {
    drawEndOverlay();
  }

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
    if (!ball) scheduleNextPitch();
    playStartSound();
    if (!animationId) loop();
    return;
  }

  resetRound();
  gameState = "playing";
  pauseBtn.textContent = "Pause Game";
  instructionChip.textContent = "Get ready...";
  scheduleNextPitch();
  playStartSound();

  if (!animationId) {
    loop();
  }
}

function togglePause() {
  if (gameState === "playing") {
    gameState = "paused";
    pauseBtn.textContent = "Resume Game";
    clearPitchTimer();
    instructionChip.textContent = "Game paused.";
    return;
  }

  if (gameState === "paused") {
    gameState = "playing";
    pauseBtn.textContent = "Pause Game";
    instructionChip.textContent = "Game resumed.";
    if (!ball) scheduleNextPitch();
    playStartSound();
  }
}

function resetGame() {
  clearPitchTimer();
  resetRound();
  gameState = "start";
  pauseBtn.textContent = "Pause Game";
  instructionChip.textContent = "Big upward swings can turn doubles into triples. Home runs trigger a giant celebration.";
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

updateSideButtons();
updateHud();
resizeCanvas();
pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;
