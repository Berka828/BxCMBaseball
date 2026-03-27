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

const easyBtn = document.getElementById("easyBtn");
const mediumBtn = document.getElementById("mediumBtn");
const hardBtn = document.getElementById("hardBtn");

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

// ---------- DIFFICULTY ----------
const DIFFICULTIES = {
  easy: {
    pitchSpeed: 10,
    swingThreshold: 320,
    pitchDelay: 3.8,
    ballScale: 1.35,
    contactDistance: 84
  },
  medium: {
    pitchSpeed: 12,
    swingThreshold: 420,
    pitchDelay: 3.5,
    ballScale: 1.0,
    contactDistance: 68
  },
  hard: {
    pitchSpeed: 14,
    swingThreshold: 520,
    pitchDelay: 3.0,
    ballScale: 0.78,
    contactDistance: 56
  }
};

let difficulty = "medium";

function setDifficulty(level) {
  difficulty = level;
  const d = DIFFICULTIES[level];

  if (pitchSpeedSlider) pitchSpeedSlider.value = String(d.pitchSpeed);
  if (swingThresholdSlider) swingThresholdSlider.value = String(d.swingThreshold);
  if (pitchDelaySlider) pitchDelaySlider.value = String(d.pitchDelay);

  if (pitchSpeedVal) pitchSpeedVal.textContent = pitchSpeedSlider.value;
  if (swingThresholdVal) swingThresholdVal.textContent = swingThresholdSlider.value;
  if (pitchDelayVal) pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;

  if (easyBtn) easyBtn.classList.toggle("active", level === "easy");
  if (mediumBtn) mediumBtn.classList.toggle("active", level === "medium");
  if (hardBtn) hardBtn.classList.toggle("active", level === "hard");
}

if (easyBtn) easyBtn.onclick = () => setDifficulty("easy");
if (mediumBtn) mediumBtn.onclick = () => setDifficulty("medium");
if (hardBtn) hardBtn.onclick = () => setDifficulty("hard");

setDifficulty("medium");

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
let gameState = "start"; // start | countdown | playing | paused | round_complete | summary
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
let lastBatTip = null;

let ball = null;
let hitText = "";
let hitTextTimer = 0;
let flashTimer = 0;
let timingText = "";
let timingTextTimer = 0;
let distanceText = "";
let distanceTextTimer = 0;
let missText = "";
let missTextTimer = 0;

let confetti = [];
let floatingStars = [];
let homerBursts = [];
let homerTrailParticles = [];
let batTrail = [];

let pitchTimer = null;
let countdownTimer = null;
let countdownActive = false;
let countdownValue = 5;

let roundSummary = null;
let showRoundComplete = false;
let roundCompleteTimer = 0;

let screenShakeTimer = 0;
let screenShakeAmount = 0;

const BALL_RADIUS = 14;
const GRAVITY = 0.44;
let CONTACT_DISTANCE = DIFFICULTIES[difficulty].contactDistance;
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

// ---------- TIMING SETTINGS ----------
const HIT_FEEDBACK_MS = 3800;
const BIG_HIT_FEEDBACK_MS = 4400;
const HOME_RUN_FEEDBACK_MS = 5200;
const MISS_FEEDBACK_MS = 3400;
const FEEDBACK_FADE_MS = 800;
const ROUND_COMPLETE_MS = 2200;

// ---------- BACKGROUNDS ----------
const stadiumBg = new Image();
let stadiumBgLoaded = false;
stadiumBg.onload = () => { stadiumBgLoaded = true; };
stadiumBg.onerror = () => { console.error("Background image failed to load."); };
stadiumBg.src = "./stadium-bg.png";

function drawImageCover(img, alpha = 1) {
  if (!img || !img.width || !img.height) return;

  const imgRatio = img.width / img.height;
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

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();
}

function drawBattingCageBackground(alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#20385f");
  grad.addColorStop(0.45, "#1a2f4f");
  grad.addColorStop(1, "#101d31");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const laneLeft = canvas.width * 0.08;
  const laneRight = canvas.width * 0.92;
  const laneTop = canvas.height * 0.18;
  const laneBottom = canvas.height * 0.88;

  const laneGrad = ctx.createLinearGradient(0, laneTop, 0, laneBottom);
  laneGrad.addColorStop(0, "rgba(255,255,255,0.03)");
  laneGrad.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = laneGrad;
  ctx.fillRect(laneLeft, laneTop, laneRight - laneLeft, laneBottom - laneTop);

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;

  for (let i = 0; i < 12; i++) {
    const x1 = laneLeft + i * ((laneRight - laneLeft) / 12);
    const x2 = laneLeft + i * ((laneRight - laneLeft) / 12) * 0.65 + canvas.width * 0.12;
    ctx.beginPath();
    ctx.moveTo(x1, laneTop);
    ctx.lineTo(x2, laneBottom);
    ctx.stroke();
  }

  for (let i = 0; i < 10; i++) {
    const y = laneTop + i * ((laneBottom - laneTop) / 10);
    ctx.beginPath();
    ctx.moveTo(laneLeft, y);
    ctx.lineTo(laneRight, y);
    ctx.stroke();
  }

  const centerX = canvas.width * 0.54;
  ctx.strokeStyle = "rgba(255,212,59,0.30)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.84, canvas.height * 0.63);
  ctx.lineTo(centerX - 20, canvas.height * 0.63);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(canvas.width * 0.10, canvas.height * 0.70, canvas.width * 0.26, canvas.height * 0.12);

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(canvas.width * 0.10, canvas.height * 0.70, canvas.width * 0.26, canvas.height * 0.12);

  for (let i = 0; i < 5; i++) {
    const lx = canvas.width * (0.14 + i * 0.18);
    ctx.fillStyle = "rgba(255,235,160,0.14)";
    ctx.beginPath();
    ctx.arc(lx, canvas.height * 0.08, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(lx, canvas.height * 0.08, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.restore();
}

function drawBackground() {
  if (stadiumBgLoaded) {
    drawImageCover(stadiumBg, 1);
  } else {
    ctx.fillStyle = "#1e2f4d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // normal darkening for readability
  ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // during active home run moments, blend in the batting cage look
  const shouldBlendCage =
    (ball && ball.result === "HOME RUN!" && ball.hit) ||
    flashTimer > 8 ||
    homeRuns > 0 && hitText.includes("HOME RUN!");

  if (shouldBlendCage) {
    drawBattingCageBackground(0.62);
  }
}

// ---------- AUDIO ----------
var audioCtx = null;
var soundEnabled = true;

var introMusic = null;
var introMusicStarted = false;
var introFadeTimer = null;

var homeRunMusic = null;
var homeRunMusicTimer = null;

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

function setupHomeRunMusic() {
  if (homeRunMusic) return;

  homeRunMusic = new Audio("./intro-theme.MP3");
  homeRunMusic.loop = false;
  homeRunMusic.volume = 0.55;
  homeRunMusic.preload = "auto";
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

async function playHomeRunMusicBurst() {
  try {
    setupHomeRunMusic();
    if (!homeRunMusic || !soundEnabled) return;

    if (homeRunMusicTimer) {
      clearTimeout(homeRunMusicTimer);
      homeRunMusicTimer = null;
    }

    homeRunMusic.pause();
    homeRunMusic.currentTime = 0;
    homeRunMusic.volume = 0.55;
    await homeRunMusic.play();

    homeRunMusicTimer = setTimeout(() => {
      if (homeRunMusic) {
        homeRunMusic.pause();
        homeRunMusic.currentTime = 0;
      }
    }, 2200);
  } catch (err) {
    console.warn("Home run music burst could not play:", err);
  }
}

// ---------- HELPERS ----------
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

function showSplashScreen() {
  if (!splashScreen) return;
  splashScreen.classList.remove("hidden");
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

function clearSummaryTimer() {
  if (summaryTimer) {
    clearTimeout(summaryTimer);
    summaryTimer = null;
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

function scheduleNextPitch(extraDelayMs = 0) {
  clearPitchTimer();

  if (pitchesLeft <= 0) return;
  if (gameState !== "playing") return;

  const baseDelayMs = Math.round((parseFloat(pitchDelaySlider?.value || "3.5")) * 1000);
  const delayMs = baseDelayMs + extraDelayMs;

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

function schedulePitchAfterFeedback(delayMs, extraDelayMs = 0) {
  clearPitchTimer();

  if (pitchesLeft <= 0 || gameState !== "playing") {
    if (pitchesLeft <= 0) endRoundToSummary();
    return;
  }

  pitchTimer = setTimeout(() => {
    if (pitchesLeft <= 0) {
      endRoundToSummary();
      return;
    }
    scheduleNextPitch(extraDelayMs);
  }, delayMs);
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

function getMissFeedback() {
  if (!lastBatTip || !ball) return "MISSED IT";

  const dx = lastBatTip.x - ball.x;
  const dy = lastBatTip.y - ball.y;

  if (Math.abs(dy) > 36) {
    return dy < 0 ? "SWING TOO HIGH" : "SWING TOO LOW";
  }

  return dx < 0 ? "TOO EARLY" : "TOO LATE";
}

function buildRoundSummary() {
  let title = "Great Job!";
  let message = "You played a strong round.";
  let tip = "Try smooth swings and good timing for longer hits.";
  let badge = "BXCM SLUGGER";

  if (homeRuns >= 2) {
    title = "Home Run Hero!";
    message = `You blasted ${homeRuns} home runs!`;
    tip = "Big upward swings can help launch the ball farther.";
    badge = "POWER STAR";
  } else if (bestDistanceFt >= 130) {
    title = "Rocket Hitter!";
    message = `Your best hit traveled ${bestDistanceFt} FT!`;
    tip = "Fast swings plus strong timing can create big distance.";
    badge = "DISTANCE ACE";
  } else if (hits >= 6) {
    title = "Contact Champ!";
    message = `You made contact on ${hits} pitches.`;
    tip = "Keeping your eye on timing helps you hit more often.";
    badge = "CONTACT PRO";
  } else if (hits >= 3) {
    title = "Nice Swinging!";
    message = `You made ${hits} solid hits this round.`;
    tip = "Try swinging a little sooner or later to find perfect timing.";
    badge = "RISING SLUGGER";
  } else {
    title = "Keep Practicing!";
    message = "Every swing helps you learn.";
    tip = "A smooth swing and good timing can send the ball farther.";
    badge = "TRY AGAIN STAR";
  }

  return { title, message, tip, badge };
}

function endRoundToSummary() {
  clearPitchTimer();
  clearCountdownTimer();

  showRoundComplete = true;
  roundCompleteTimer = Math.round(ROUND_COMPLETE_MS / (1000 / 60));
  gameState = "round_complete";

  setTimeout(() => {
    showRoundComplete = false;
    roundSummary = buildRoundSummary();
    gameState = "summary";
    showControlsPanel();
  }, ROUND_COMPLETE_MS + 2200);
}

// ---------- CHARACTER-LIKE SILHOUETTE ----------
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

function drawSilhouetteFigure(pose) {
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

  const neck = ls && rs ? { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 } : null;
  const pelvis = lh && rh ? { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 } : null;

  const shoulderWidth = ls && rs ? Math.hypot(rs.x - ls.x, rs.y - ls.y) : 70;
  const torsoW = Math.max(44, shoulderWidth * 0.82);
  const torsoH = neck && pelvis ? Math.max(78, Math.hypot(pelvis.x - neck.x, pelvis.y - neck.y) * 1.05) : 120;
  const headR = Math.max(20, Math.min(34, shoulderWidth * 0.34));

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  function capsule(a, b, width, color, alpha = 1) {
    if (!a || !b) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function circle(pt, r, color, alpha = 1) {
    if (!pt) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowBlur = 16;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const headColor = "rgba(125,77,255,0.92)";
  const bodyColor = "rgba(37,169,255,0.82)";
  const limbColor = "rgba(46,213,115,0.80)";
  const accentColor = "rgba(255,212,59,0.92)";

  if (nose && neck) {
    const headCenter = { x: nose.x, y: nose.y - headR * 0.12 };
    circle(headCenter, headR, headColor, 0.95);

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(headCenter.x, headCenter.y - 2, headR * 0.62, headR * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (neck && pelvis) {
    const torsoCenter = {
      x: (neck.x + pelvis.x) / 2,
      y: (neck.y + pelvis.y) / 2
    };

    ctx.save();
    ctx.translate(torsoCenter.x, torsoCenter.y);
    ctx.fillStyle = bodyColor;
    ctx.shadowBlur = 26;
    ctx.shadowColor = "rgba(37,169,255,0.55)";
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2, -torsoH / 2, torsoW, torsoH, 26);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.roundRect(-torsoW * 0.28, -torsoH * 0.22, torsoW * 0.56, torsoH * 0.18, 12);
    ctx.fill();
    ctx.restore();
  }

  circle(ls, 10, bodyColor, 0.9);
  circle(rs, 10, bodyColor, 0.9);
  circle(lh, 10, bodyColor, 0.85);
  circle(rh, 10, bodyColor, 0.85);

  capsule(ls, le, 18, limbColor, 0.88);
  capsule(le, lw, 14, limbColor, 0.84);
  capsule(rs, re, 18, limbColor, 0.88);
  capsule(re, rw, 14, limbColor, 0.84);

  capsule(lh, lk, 20, limbColor, 0.80);
  capsule(lk, la, 16, limbColor, 0.76);
  capsule(rh, rk, 20, limbColor, 0.80);
  capsule(rk, ra, 16, limbColor, 0.76);

  circle(lw, 8, accentColor, 0.95);
  circle(rw, 8, accentColor, 0.95);
  circle(la, 8, accentColor, 0.75);
  circle(ra, 8, accentColor, 0.75);

  if (neck && pelvis) {
    capsule(neck, pelvis, 8, "rgba(255,255,255,0.18)", 0.65);
  }

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

function updateBatTrail(point) {
  batTrail.push({ x: point.x, y: point.y, life: 10 });
  if (batTrail.length > 14) batTrail.shift();
  lastBatTip = point;
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

// ---------- OVERLAYS ----------
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
    const alpha = Math.min(1, distanceTextTimer / 24);
    ctx.save();
    ctx.globalAlpha = alpha;
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

function drawMissOverlay() {
  if (missTextTimer <= 0) return;

  const alpha = Math.min(1, missTextTimer / 24);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#14304b";
  ctx.fillStyle = "#ff9f1a";
  ctx.font = '900 38px "Baloo 2", sans-serif';
  ctx.strokeText(missText, canvas.width / 2, canvas.height * 0.32);
  ctx.fillText(missText, canvas.width / 2, canvas.height * 0.32);
  ctx.restore();

  missTextTimer--;
}

function drawBaseballIcon(x, y, r, active = true) {
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.28;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#d64545";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(x - 3, y, r - 4, -1.1, 1.1);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + 3, y, r - 4, 2.0, 4.2);
  ctx.stroke();

  ctx.restore();
}

function drawPitchIconsRow() {
  const total = roundPitches;
  const gap = 24;
  const r = 8;
  const rowWidth = (total - 1) * gap;
  const startX = canvas.width / 2 - rowWidth / 2;
  const y = canvas.height - 148;

  for (let i = 0; i < total; i++) {
    const active = i < pitchesLeft;
    drawBaseballIcon(startX + i * gap, y, r, active);
  }
}

function drawBadge(cx, cy, label) {
  ctx.save();

  ctx.beginPath();
  ctx.arc(cx, cy, 64, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd43b";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.fillStyle = "#25a9ff";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  ctx.fillStyle = "#7d4dff";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 16px "Baloo 2", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("BxCM", cx, cy - 8);
  ctx.font = '900 12px "Nunito", sans-serif';
  ctx.fillText(label, cx, cy + 14);

  ctx.restore();
}

function drawRoundCompleteOverlay() {
  if (!showRoundComplete) return;

  const alpha = Math.min(1, roundCompleteTimer / 24);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.shadowBlur = 30;
  ctx.shadowColor = "#ffd43b";
  ctx.fillStyle = "#ffd43b";
  ctx.strokeStyle = "#14304b";
  ctx.lineWidth = 10;
  ctx.font = '900 72px "Baloo 2", sans-serif';
  ctx.strokeText("ROUND COMPLETE", canvas.width / 2, canvas.height * 0.46);
  ctx.fillText("ROUND COMPLETE", canvas.width / 2, canvas.height * 0.46);
  ctx.restore();

  if (roundCompleteTimer > 0) roundCompleteTimer--;
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
  ctx.fillText("Press Space or Pause again to keep playing.", canvas.width / 2, canvas.height * 0.43);
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

function drawSummaryOverlay() {
  if (!roundSummary) return;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawBadge(canvas.width / 2, canvas.height * 0.24, roundSummary.badge);

  ctx.save();
  ctx.textAlign = "center";

  ctx.fillStyle = "#ffd43b";
  ctx.font = '900 54px "Baloo 2", sans-serif';
  ctx.fillText(roundSummary.title, canvas.width / 2, canvas.height * 0.40);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 28px "Nunito", sans-serif';
  ctx.fillText(roundSummary.message, canvas.width / 2, canvas.height * 0.50);

  ctx.font = '800 24px "Nunito", sans-serif';
  ctx.fillStyle = "#25a9ff";
  ctx.fillText(`Best Distance: ${Math.round(bestDistanceFt)} FT`, canvas.width / 2, canvas.height * 0.58);

  ctx.fillStyle = "#2ed573";
  ctx.fillText(`Hits: ${hits}   •   Home Runs: ${homeRuns}`, canvas.width / 2, canvas.height * 0.65);

  ctx.fillStyle = "#ffffff";
  ctx.font = '800 22px "Nunito", sans-serif';
  ctx.fillText(roundSummary.tip, canvas.width / 2, canvas.height * 0.75);

  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = '800 18px "Nunito", sans-serif';
  ctx.fillText("Administrator: press Reset to return to splash.", canvas.width / 2, canvas.height * 0.85);

  ctx.restore();
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

// ---------- FX ----------
function getShakeOffset() {
  if (screenShakeTimer <= 0) return { x: 0, y: 0 };
  screenShakeTimer--;
  return {
    x: (Math.random() - 0.5) * screenShakeAmount,
    y: (Math.random() - 0.5) * screenShakeAmount
  };
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
    const alpha = Math.min(1, hitTextTimer / 24);
    const scale = 1 + Math.sin((90 - hitTextTimer) * 0.10) * 0.03;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(canvas.width / 2, canvas.height * 0.22);
    ctx.scale(scale, scale);

    ctx.textAlign = "center";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#14304b";
    ctx.fillStyle = hitText.includes("HOME RUN!") ? "#ffd54f" : "#ffffff";
    ctx.font = '900 56px "Baloo 2", sans-serif';
    ctx.strokeText(hitText, 0, 0);
    ctx.fillText(hitText, 0, 0);
    ctx.restore();

    hitTextTimer--;
  }

  if (timingTextTimer > 0) {
    const alpha = Math.min(1, timingTextTimer / 24);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#14304b";

    let fill = "#ffffff";
    if (timingText === "PERFECT!") fill = "#2ed573";
    if (timingText === "TOO EARLY" || timingText === "TOO LATE") fill = "#ff9f1a";

    ctx.fillStyle = fill;
    ctx.font = '900 38px "Baloo 2", sans-serif';
    ctx.strokeText(timingText, canvas.width / 2, canvas.height * 0.30);
    ctx.fillText(timingText, canvas.width / 2, canvas.height * 0.30);
    ctx.restore();

    timingTextTimer--;
  }

  if (flashTimer > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashTimer * 0.020})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashTimer--;
  }
}

// ---------- COUNTDOWN ----------
function startCountdown() {
  clearCountdownTimer();
  countdownActive = true;
  countdownValue = 5;
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
    const points = drawSilhouetteFigure(pose);
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
    drawMissOverlay();
    drawPitchIconsRow();
  } else {
    updateAndDrawConfetti();
    updateAndDrawStars();
    updateAndDrawHomerBursts();
    updateAndDrawHomerTrailParticles();
    drawHitOverlay();
    drawDistanceOverlay();
    drawMissOverlay();

    if (gameState === "summary" || gameState === "round_complete") {
      drawPitchIconsRow();
    }
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

  if (gameState === "round_complete") {
    drawRoundCompleteOverlay();
  }

  if (gameState === "summary") {
    drawSummaryOverlay();
  }

  ctx.restore();
  animationId = requestAnimationFrame(loop);
}

// ---------- BUTTONS ----------
async function startOrResumeGame() {
  try {
    initAudio();

    if (!introMusicStarted) {
      await playIntroMusic();
    }

    if (!detector) {
      await setupCamera();
      await loadModel();
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
  clearSummaryTimer();
  resetRound();
  gameState = "start";
  showSplashScreen();
  if (pauseBtn) pauseBtn.textContent = "Pause";
  if (instructionChip) {
    instructionChip.textContent = "Strong swings can send the ball farther. Timing matters too.";
  }
}

// ---------- INIT ----------
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
      if (introMusic && !introMusic.paused) introMusic.pause();
      if (homeRunMusic && !homeRunMusic.paused) homeRunMusic.pause();
    }
  };
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();

    if (gameState === "playing" || gameState === "countdown") {
      togglePause();
    } else if (gameState === "paused") {
      togglePause();
    }
  }
});

updateSideButtons();
updateHud();
resizeCanvas();

if (pitchDelayVal && pitchDelaySlider) {
  pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;
}
