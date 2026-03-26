const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const miniMapCanvas = document.getElementById("miniMapCanvas");
const miniCtx = miniMapCanvas ? miniMapCanvas.getContext("2d") : null;

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const muteBtn = document.getElementById("muteBtn");
const rightHandBtn = document.getElementById("rightHandBtn");
const leftHandBtn = document.getElementById("leftHandBtn");

const splashScreen = document.getElementById("splashScreen");
const splashStartBtn = document.getElementById("splashStartBtn");

const scoreEl = document.getElementById("scoreEl");
const pitchesEl = document.getElementById("pitchesEl");
const hitsEl = document.getElementById("hitsEl");
const missesEl = document.getElementById("missesEl");
const veloEl = document.getElementById("veloEl");
const instructionChip = document.getElementById("instructionChip");

const homeRunsEl = document.getElementById("homeRunsEl");
const bestHitEl = document.getElementById("bestHitEl");

const pitchSpeedSlider = document.getElementById("pitchSpeed");
const swingThresholdSlider = document.getElementById("swingThreshold");
const pitchDelaySlider = document.getElementById("pitchDelay");

const pitchSpeedVal = document.getElementById("pitchSpeedVal");
const swingThresholdVal = document.getElementById("swingThresholdVal");
const pitchDelayVal = document.getElementById("pitchDelayVal");

const rightPanel = document.querySelector(".rightPanel");
const controlDock = document.querySelector(".controlDock");

// ---------- SAFE SLIDER WIRING ----------
if (pitchSpeedSlider && pitchSpeedVal) {
  pitchSpeedSlider.oninput = () => {
    pitchSpeedVal.textContent = pitchSpeedSlider.value;
  };
}

if (swingThresholdSlider && swingThresholdVal) {
  swingThresholdSlider.oninput = () => {
    swingThresholdVal.textContent = swingThresholdSlider.value;
  };
}

if (pitchDelaySlider && pitchDelayVal) {
  pitchDelaySlider.oninput = () => {
    pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;
  };
}

// ---------- GAME STATE ----------
let detector = null;
let animationId = null;
let gameState = "start"; // start | countdown | playing | paused | end
let battingSide = "right";

let score = 0;
let hits = 0;
let misses = 0;
let homeRuns = 0;
let pitchesLeft = 10;
const roundPitches = 10;

let bestDistanceFt = 0;
let currentDistanceFt = 0;

let prevBatPoint = null;
let batVelocity = { x: 0, y: 0, speed: 0 };

let ball = null;
let hitText = "";
let hitTextTimer = 0;
let flashTimer = 0;
let timingText = "";
let timingTextTimer = 0;
let distanceText = "";
let distanceTextTimer = 0;

let confetti = [];
let floatingStars = [];
let homerBursts = [];
let homerTrailParticles = [];
let batTrail = [];

let pitchTimer = null;
let countdownTimer = null;
let countdownActive = false;
let countdownValue = 3;

let screenShakeTimer = 0;
let screenShakeAmount = 0;

const BALL_RADIUS = 14;
const GRAVITY = 0.44;
const CONTACT_DISTANCE = 68;
const BAT_LENGTH = 132;

const SKELETON_SCALE = 0.68;
const SKELETON_OFFSET_Y = 360;
const SKELETON_OFFSET_X = -300;

const TIPS = [
  "Strong swings can send the ball farther.",
  "A bat is a lever. Timing helps power.",
  "A ball can travel farther when your swing is smooth and strong.",
  "Big upward swings can create longer hits.",
  "Speed plus timing can make a rocket hit.",
  "Different angles can change how far the ball flies."
];

let tipIndex = 0;

// ---------- BACKGROUND ----------
const stadiumBg = new Image();
let stadiumBgLoaded = false;

stadiumBg.onload = () => {
  stadiumBgLoaded = true;
};

stadiumBg.onerror = () => {
  console.error("Background image failed to load.");
};

stadiumBg.src = "./stadium-bg.png";

// ---------- AUDIO ----------
var audioCtx = null;
var soundEnabled = true;

var introMusic = null;
var introMusicStarted = false;
var introFadeTimer = null;

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

function playCountdownBeep(num) {
  const f = num > 1 ? 660 : 880;
  tone(f, 0.10, "triangle", 0.11, 0);
}

function playGoSound() {
  tone(880, 0.08, "triangle", 0.12, 0);
  tone(1174.66, 0.12, "triangle", 0.12, 0.08);
}

function setupIntroMusic() {
  if (introMusic) return;

  introMusic = new Audio("./intro-theme.MP3");
  introMusic.loop = false;
  introMusic.volume = 0.45;
  introMusic.preload = "auto";
}

async function playIntroMusic() {
  try {
    setupIntroMusic();
    if (!introMusic || !soundEnabled) return;

    if (introFadeTimer) {
      clearInterval(introFadeTimer);
      introFadeTimer = null;
    }

    introMusic.pause();
    introMusic.currentTime = 0;
    introMusic.volume = 0.45;
    await introMusic.play();
    introMusicStarted = true;
  } catch (err) {
    console.warn("Intro music could not play:", err);
  }
}

function fadeOutIntroMusic(duration = 1800) {
  if (!introMusic || introMusic.paused) return;

  if (introFadeTimer) {
    clearInterval(introFadeTimer);
    introFadeTimer = null;
  }

  const startVolume = introMusic.volume;
  const steps = 24;
  const stepTime = duration / steps;
  let currentStep = 0;

  introFadeTimer = setInterval(() => {
    currentStep++;
    const t = currentStep / steps;
    introMusic.volume = Math.max(0, startVolume * (1 - t));

    if (currentStep >= steps) {
      clearInterval(introFadeTimer);
      introFadeTimer = null;
      introMusic.pause();
      introMusic.currentTime = 0;
      introMusic.volume = 0.45;
      introMusicStarted = false;
    }
  }, stepTime);
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
  if (scoreEl) scoreEl.textContent = score;
  if (pitchesEl) pitchesEl.textContent = pitchesLeft;
  if (hitsEl) hitsEl.textContent = hits;
  if (missesEl) missesEl.textContent = misses;
  if (veloEl) veloEl.textContent = Math.round(bestDistanceFt);

  if (homeRunsEl) homeRunsEl.textContent = homeRuns;
  if (bestHitEl) bestHitEl.textContent = `${Math.round(bestDistanceFt)} FT`;
}

function hideSplashScreen() {
  if (!splashScreen) return;
  splashScreen.classList.add("hidden");
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

function getControlContainer() {
  return controlDock || rightPanel || null;
}

function showControlsPanel() {
  const el = getControlContainer();
  if (!el) return;
  el.style.transition = "opacity 500ms ease";
  el.style.opacity = "1";
  el.style.pointerEvents = "auto";
}

function hideControlsPanel() {
  const el = getControlContainer();
  if (!el) return;
  el.style.transition = "opacity 700ms ease";
  el.style.opacity = "0.08";
  el.style.pointerEvents = "none";
}

function rotateTip() {
  tipIndex = (tipIndex + 1) % TIPS.length;
  if (instructionChip) {
    instructionChip.textContent = TIPS[tipIndex];
  }
}

function scheduleNextPitch() {
  clearPitchTimer();

  if (pitchesLeft <= 0) return;
  if (gameState !== "playing") return;

  const delayMs = Math.round((parseFloat(pitchDelaySlider?.value || "1.5")) * 1000);

  rotateTip();

  pitchTimer = setTimeout(() => {
    if (gameState === "playing" && !ball) {
      createPitch();
      if (instructionChip) {
        instructionChip.textContent = "Swing across your body to meet the ball.";
      }
    }
  }, delayMs);
}

function resetRound() {
  clearPitchTimer();
  clearCountdownTimer();

  score = 0;
  hits = 0;
  misses = 0;
  homeRuns = 0;
  bestDistanceFt = 0;
  currentDistanceFt = 0;
  pitchesLeft = roundPitches;

  prevBatPoint = null;
  batVelocity = { x: 0, y: 0, speed: 0 };
  ball = null;

  hitText = "";
  hitTextTimer = 0;
  timingText = "";
  timingTextTimer = 0;
  distanceText = "";
  distanceTextTimer = 0;
  flashTimer = 0;

  confetti = [];
  floatingStars = [];
  homerBursts = [];
  homerTrailParticles = [];
  batTrail = [];

  screenShakeTimer = 0;
  screenShakeAmount = 0;

  countdownActive = false;
  countdownValue = 3;

  updateHud();

  if (instructionChip) {
    instructionChip.textContent = "Strong swings can send the ball farther. Timing matters too.";
  }

  showControlsPanel();
}

function estimateDistanceFt(power, resultLabel) {
  let base = 20 + power * 55;

  if (resultLabel === "DOUBLE!") base += 18;
  if (resultLabel === "TRIPLE!") base += 34;
  if (resultLabel === "HOME RUN!") base += 55;

  return Math.round(clamp(base, 12, 220));
}

function getFunHitText(resultLabel, distanceFt) {
  if (resultLabel === "HOME RUN!") return `HOME RUN! ${distanceFt} FT`;
  if (distanceFt >= 130) return `ROCKET BALL! ${distanceFt} FT`;
  if (distanceFt >= 95) return `BIG SMASH! ${distanceFt} FT`;
  if (distanceFt >= 70) return `NICE HIT! ${distanceFt} FT`;
  return `${resultLabel} ${distanceFt} FT`;
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
function drawBackground() {
  if (!stadiumBgLoaded) {
    ctx.fillStyle = "#1e2f4d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const imgRatio = stadiumBg.width / stadiumBg.height;
  const canvasRatio = canvas.width / canvas.height;

  let drawWidth;
  let drawHeight;

  if (canvasRatio > imgRatio) {
    drawWidth = canvas.width;
    drawHeight = canvas.width / imgRatio;
  } else {
    drawHeight = canvas.height;
    drawWidth = canvas.height * imgRatio;
  }

  const offsetX = (canvas.width - drawWidth) / 2;
  const offsetY = (canvas.height - drawHeight) / 2;

  ctx.drawImage(stadiumBg, offsetX, offsetY, drawWidth, drawHeight);
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ---------- SKELETON ----------
function scalePoint(p, center, scale) {
  if (!p) return null;
  return {
    x: center.x + (p.x - center.x) * scale + SKELETON_OFFSET_X,
    y: center.y + (p.y - center.y) * scale + SKELETON_OFFSET_Y
  };
}

function getPoseCenter(points) {
  const valid = points.filter(Boolean);
  if (!valid.length) return null;
  return {
    x: valid.reduce((s, p) => s + p.x, 0) / valid.length,
    y: valid.reduce((s, p) => s + p.y, 0) / valid.length
  };
}

function getScaledPosePoints(pose) {
  const rawPoints = {
    nose: getKeypoint(pose, "nose"),
    leftShoulder: getKeypoint(pose, "left_shoulder"),
    rightShoulder: getKeypoint(pose, "right_shoulder"),
    leftElbow: getKeypoint(pose, "left_elbow"),
    rightElbow: getKeypoint(pose, "right_elbow"),
    leftWrist: getKeypoint(pose, "left_wrist"),
    rightWrist: getKeypoint(pose, "right_wrist"),
    leftHip: getKeypoint(pose, "left_hip"),
    rightHip: getKeypoint(pose, "right_hip"),
    leftKnee: getKeypoint(pose, "left_knee"),
    rightKnee: getKeypoint(pose, "right_knee"),
    leftAnkle: getKeypoint(pose, "left_ankle"),
    rightAnkle: getKeypoint(pose, "right_ankle")
  };

  const present = Object.values(rawPoints).filter(Boolean);
  const center = getPoseCenter(present);
  if (!center) return rawPoints;

  const scaled = {};
  for (const [key, value] of Object.entries(rawPoints)) {
    scaled[key] = scalePoint(value, center, SKELETON_SCALE);
  }

  return scaled;
}

function drawStickFigure(pose) {
  const p = getScaledPosePoints(pose);

  const nose = p.nose;
  const ls = p.leftShoulder;
  const rs = p.rightShoulder;
  const le = p.leftElbow;
  const re = p.rightElbow;
  const lw = p.leftWrist;
  const rw = p.rightWrist;
  const lh = p.leftHip;
  const rh = p.rightHip;
  const lk = p.leftKnee;
  const rk = p.rightKnee;
  const la = p.leftAnkle;
  const ra = p.rightAnkle;

  const joints = [nose, ls, rs, le, re, lw, rw, lh, rh, lk, rk, la, ra].filter(Boolean);
  if (joints.length < 4) return null;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  function line(a, b, width = 10, color = "#8fe3ff") {
    if (!a || !b) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowBlur = 16;
    ctx.shadowColor = "rgba(143,227,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function joint(a, r = 8, color = "#ffffff") {
    if (!a) return;
    ctx.fillStyle = color;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const neck = ls && rs ? { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 } : null;
  const pelvis = lh && rh ? { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 } : null;

  if (nose && neck) {
    const headRadius = Math.max(14, Math.min(26, Math.hypot(nose.x - neck.x, nose.y - neck.y) * 0.75));
    ctx.strokeStyle = "#8fe3ff";
    ctx.lineWidth = 8;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(143,227,255,0.55)";
    ctx.beginPath();
    ctx.arc(nose.x, nose.y - headRadius * 0.15, headRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  line(ls, rs, 12);
  line(ls, le, 10);
  line(le, lw, 9);
  line(rs, re, 10);
  line(re, rw, 9);

  line(ls, lh, 10);
  line(rs, rh, 10);
  line(lh, rh, 12);

  line(lh, lk, 10);
  line(lk, la, 9);
  line(rh, rk, 10);
  line(rk, ra, 9);

  if (neck && pelvis) line(neck, pelvis, 12);

  joint(ls); joint(rs); joint(le, 7); joint(re, 7);
  joint(lw, 7); joint(rw, 7);
  joint(lh, 7); joint(rh, 7);
  joint(lk, 7); joint(rk, 7);
  joint(la, 7); joint(ra, 7);

  ctx.restore();
  return p;
}

function getBattingArm(points) {
  if (!points) return null;

  if (battingSide === "right") {
    if (points.rightWrist && points.rightElbow) {
      return { wrist: points.rightWrist, elbow: points.rightElbow };
    }
  } else {
    if (points.leftWrist && points.leftElbow) {
      return { wrist: points.leftWrist, elbow: points.leftElbow };
    }
  }

  return null;
}

function drawBatFromSide(wrist, elbow) {
  if (!wrist || !elbow) return null;

  const dx = wrist.x - elbow.x;
  const dy = wrist.y - elbow.y;
  const len = Math.hypot(dx, dy) || 1;

  const ux = dx / len;
  const uy = dy / len;

  const batTip = {
    x: wrist.x + ux * BAT_LENGTH,
    y: wrist.y + uy * BAT_LENGTH
  };

  ctx.save();

  ctx.strokeStyle = "#4e342e";
  ctx.lineWidth = 16;
  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
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

// ---------- BAT TRAIL ----------
function updateBatTrail(point) {
  batTrail.push({ x: point.x, y: point.y, life: 10 });
  if (batTrail.length > 14) batTrail.shift();
}

function tickBatTrail() {
  for (let i = batTrail.length - 1; i >= 0; i--) {
    batTrail[i].life--;
    if (batTrail[i].life <= 0) batTrail.splice(i, 1);
  }
}

function drawBatTrail() {
  for (let i = 0; i < batTrail.length; i++) {
    const p = batTrail[i];
    const alpha = clamp(p.life / 10, 0, 1) * 0.35;
    const radius = 8 + (batTrail.length - i) * 0.5;
    ctx.fillStyle = `rgba(255, 202, 40, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- TIMING ----------
function getTimingFeedback(batTip, ballObj) {
  const diff = batTip.x - ballObj.x;
  const absDiff = Math.abs(diff);

  if (absDiff <= 16) {
    return { label: "PERFECT!", powerBonus: 1.14, direction: 1.0 };
  }

  if (battingSide === "right") {
    if (diff < -16) {
      return { label: "TOO EARLY", powerBonus: 0.86, direction: 0.92 };
    }
    return { label: "TOO LATE", powerBonus: 0.84, direction: 1.05 };
  } else {
    if (diff > 16) {
      return { label: "TOO EARLY", powerBonus: 0.86, direction: 0.92 };
    }
    return { label: "TOO LATE", powerBonus: 0.84, direction: 1.05 };
  }
}

// ---------- DISTANCE ----------
function updateDistanceDuringFlight() {
  if (!ball || !ball.hit) return;

  const startX = ball.contactX ?? ball.x;
  const travelPx = Math.abs(ball.x - startX);
  currentDistanceFt = Math.max(ball.estimatedDistanceFt || 0, Math.round(travelPx * 0.22));
}

function drawDistanceOverlay() {
  if (gameState === "playing" && ball && ball.hit && currentDistanceFt > 0) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#14304b";
    ctx.fillStyle = "#ffd43b";
    ctx.font = '900 42px "Baloo 2", sans-serif';
    ctx.strokeText(`${Math.round(currentDistanceFt)} FT`, canvas.width / 2, canvas.height * 0.14);
    ctx.fillText(`${Math.round(currentDistanceFt)} FT`, canvas.width / 2, canvas.height * 0.14);
    ctx.restore();
  }

  if (distanceTextTimer > 0) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#14304b";
    ctx.fillStyle = "#25a9ff";
    ctx.font = '900 34px "Baloo 2", sans-serif';
    ctx.strokeText(distanceText, canvas.width / 2, canvas.height * 0.36);
    ctx.fillText(distanceText, canvas.width / 2, canvas.height * 0.36);
    ctx.restore();

    distanceTextTimer--;
  }
}

function showDistanceText(text) {
  distanceText = text;
  distanceTextTimer = 38;
}

// ---------- MINIMAP ----------
function drawMiniMap() {
  if (!miniMapCanvas || !miniCtx) return;

  miniCtx.clearRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);

  miniCtx.fillStyle = "#0b2343";
  miniCtx.fillRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);

  miniCtx.strokeStyle = "rgba(255,255,255,0.18)";
  miniCtx.lineWidth = 2;
  miniCtx.strokeRect(1, 1, miniMapCanvas.width - 2, miniMapCanvas.height - 2);

  miniCtx.fillStyle = "rgba(255,255,255,0.06)";
  miniCtx.fillRect(18, 55, miniMapCanvas.width - 36, 24);

  miniCtx.strokeStyle = "rgba(255,255,255,0.30)";
  miniCtx.lineWidth = 4;
  miniCtx.beginPath();
  miniCtx.moveTo(miniMapCanvas.width - 24, 67);
  miniCtx.lineTo(34, 67);
  miniCtx.stroke();

  miniCtx.fillStyle = "#ffffff";
  miniCtx.beginPath();
  miniCtx.moveTo(20, 67);
  miniCtx.lineTo(28, 58);
  miniCtx.lineTo(38, 67);
  miniCtx.lineTo(34, 78);
  miniCtx.lineTo(24, 78);
  miniCtx.closePath();
  miniCtx.fill();

  miniCtx.fillStyle = "#ffd54f";
  miniCtx.beginPath();
  miniCtx.arc(miniMapCanvas.width - 24, 67, 7, 0, Math.PI * 2);
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
    if (timingText === "PERFECT!") fill = "#2ed573";
    if (timingText === "TOO EARLY" || timingText === "TOO LATE") fill = "#ff9f1a";

    ctx.fillStyle = fill;
    ctx.font = '900 40px "Baloo 2", sans-serif';
    ctx.strokeText(timingText, canvas.width / 2, canvas.height * 0.30);
    ctx.fillText(timingText, canvas.width / 2, canvas.height * 0.30);
    ctx.restore();

    timingTextTimer--;
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
  ctx.fillText("Press Pause again to keep playing.", canvas.width / 2, canvas.height * 0.43);
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
  ctx.fillText("Press the button to begin.", canvas.width / 2, canvas.height * 0.41);
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
  ctx.fillText(`Hits: ${hits}`, canvas.width / 2, canvas.height * 0.43);
  ctx.fillText(`Best Distance: ${Math.round(bestDistanceFt)} FT`, canvas.width / 2, canvas.height * 0.50);
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
  countdownValue = 3;
  gameState = "countdown";

  if (instructionChip) {
    instructionChip.textContent = "Get set...";
  }

  hideControlsPanel();
  fadeOutIntroMusic(1800);

  const tick = () => {
    if (!countdownActive) return;

    if (countdownValue > 0) {
      playCountdownBeep(countdownValue);
      if (instructionChip) {
        instructionChip.textContent = `Starting in ${countdownValue}...`;
      }
      countdownValue--;
      countdownTimer = setTimeout(tick, 1000);
    } else {
      playGoSound();
      if (instructionChip) {
        instructionChip.textContent = "Swing!";
      }
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
    if (rightHandBtn) rightHandBtn.classList.add("active");
    if (leftHandBtn) leftHandBtn.classList.remove("active");
  } else {
    if (leftHandBtn) leftHandBtn.classList.add("active");
    if (rightHandBtn) rightHandBtn.classList.remove("active");
  }
}

if (rightHandBtn) {
  rightHandBtn.onclick = () => {
    battingSide = "right";
    prevBatPoint = null;
    updateSideButtons();
  };
}

if (leftHandBtn) {
  leftHandBtn.onclick = () => {
    battingSide = "left";
    prevBatPoint = null;
    updateSideButtons();
  };
}

// ---------- MAIN LOOP ----------
async function loop() {
  const shake = getShakeOffset();

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(shake.x, shake.y);

  drawBackground();
  drawMiniMap();

  let pose = null;

  if (detector && (gameState === "playing" || gameState === "countdown" || gameState === "start")) {
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
      }
    }
  }

  drawBatTrail();

  if (gameState === "playing") {
    updateBall();
    updateDistanceDuringFlight();
    drawBall();
    updateAndDrawConfetti();
    updateAndDrawStars();
    updateAndDrawHomerBursts();
    updateAndDrawHomerTrailParticles();
    drawHitOverlay();
    drawDistanceOverlay();

    if (pitchesLeft <= 0 && !ball) {
      gameState = "end";
      showControlsPanel();
      if (instructionChip) {
        instructionChip.textContent = "Round over. Press Start Game to play again.";
      }
    }
  } else {
    updateAndDrawConfetti();
    updateAndDrawStars();
    updateAndDrawHomerBursts();
    updateAndDrawHomerTrailParticles();
    drawHitOverlay();
    drawDistanceOverlay();
  }

  tickBatTrail();

  if (gameState === "start") {
    drawStartOverlay();
  }

  if (gameState === "countdown") {
    drawCountdownOverlay();
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
  console.log("startOrResumeGame fired");

  try {
    initAudio();

    if (!introMusicStarted) {
      await playIntroMusic();
    }

    if (!detector) {
      console.log("setting up camera...");
      await setupCamera();
      console.log("camera ready");

      console.log("loading model...");
      await loadModel();
      console.log("model ready");
    }

    hideSplashScreen();

    if (gameState === "paused") {
      gameState = "playing";
      if (pauseBtn) pauseBtn.textContent = "Pause";
      if (instructionChip) instructionChip.textContent = "Game resumed.";
      hideControlsPanel();
      if (!ball) scheduleNextPitch();
      playStartSound();
      if (!animationId) loop();
      return;
    }

    resetRound();
    if (pauseBtn) pauseBtn.textContent = "Pause";
    playStartSound();
    startCountdown();

    if (!animationId) {
      loop();
    }
  } catch (err) {
    console.error("START ERROR:", err);
    alert("Start failed. See console.");
  }
}

function togglePause() {
  if (gameState === "playing") {
    gameState = "paused";
    if (pauseBtn) pauseBtn.textContent = "Resume";
    clearPitchTimer();
    clearCountdownTimer();
    showControlsPanel();
    if (instructionChip) instructionChip.textContent = "Game paused.";
    return;
  }

  if (gameState === "countdown") {
    gameState = "paused";
    countdownActive = false;
    clearCountdownTimer();
    if (pauseBtn) pauseBtn.textContent = "Resume";
    showControlsPanel();
    if (instructionChip) instructionChip.textContent = "Game paused.";
    return;
  }

  if (gameState === "paused") {
    if (pauseBtn) pauseBtn.textContent = "Pause";

    if (!ball && hits === 0 && misses === 0 && pitchesLeft === roundPitches) {
      startCountdown();
    } else {
      gameState = "playing";
      hideControlsPanel();
      if (instructionChip) instructionChip.textContent = "Game resumed.";
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
  if (pauseBtn) pauseBtn.textContent = "Pause";
  showControlsPanel();
  if (instructionChip) {
    instructionChip.textContent = "Strong swings can send the ball farther. Timing matters too.";
  }
}

// ---------- INIT ----------
console.log("GAME JS LOADED");

if (startBtn) {
  startBtn.onclick = startOrResumeGame;
}

if (splashStartBtn) {
  splashStartBtn.onclick = startOrResumeGame;
}

if (pauseBtn) {
  pauseBtn.onclick = togglePause;
}

if (resetBtn) {
  resetBtn.onclick = resetGame;
}

if (muteBtn) {
  muteBtn.onclick = async () => {
    soundEnabled = !soundEnabled;

    if (soundEnabled) {
      initAudio();
      muteBtn.textContent = "Sound: On";
      playStartSound();
    } else {
      muteBtn.textContent = "Sound: Off";
      if (introMusic && !introMusic.paused) {
        introMusic.pause();
      }
    }
  };
}

updateSideButtons();
updateHud();
resizeCanvas();

if (pitchDelayVal && pitchDelaySlider) {
  pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;
}
