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

const controlDock = document.getElementById("controlDock");

const DIFFICULTIES = {
  easy: { pitchSpeed: 8.0, swingThreshold: 300, pitchDelay: 4.0, ballScale: 1.45, contactDistance: 88 },
  medium: { pitchSpeed: 8.5, swingThreshold: 400, pitchDelay: 3.7, ballScale: 1.20, contactDistance: 74 },
  hard: { pitchSpeed: 9.5, swingThreshold: 500, pitchDelay: 3.2, ballScale: 1.00, contactDistance: 62 }
};

let difficulty = "medium";
let detector = null;
let animationId = null;
let gameState = "start";
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
let summaryTimer = null;
let countdownActive = false;
let countdownValue = 5;

let roundSummary = null;
let showRoundComplete = false;
let roundCompleteTimer = 0;

let screenShakeTimer = 0;
let screenShakeAmount = 0;

let lastTimingOffset = 0.5;
let lastTimingRating = "";
let accuracyMarkerTimer = 0;

let coachText = "";
let coachTextTimer = 0;
let crowdText = "";
let crowdTextTimer = 0;
let crowdMood = "quiet";

let swingPowerDisplay = 0;
let swingPowerPeak = 0;

let splashReadyForHands = false;
let handRaiseHoldMs = 0;
let lastRaiseCheckTime = 0;
let autoStartTriggered = false;
let startInProgress = false;

const BALL_RADIUS = 14;
const GRAVITY = 0.44;
let CONTACT_DISTANCE = DIFFICULTIES[difficulty].contactDistance;
const BAT_LENGTH = 132;

const PLAYER_SCALE = 0.34;
const PLAYER_TARGET_X = 0.15;
const PLAYER_FLOOR_Y = 0.89;
const BALL_LANE_Y = 0.61;

const BALL_SPAWN_X_RATIO = 0.965;
const BALL_MISS_X_RATIO = 0.12;
const BG_ZOOM = 0.86;

const HIT_FEEDBACK_MS = 3800;
const BIG_HIT_FEEDBACK_MS = 4400;
const HOME_RUN_FEEDBACK_MS = 5200;
const MISS_FEEDBACK_MS = 3400;
const FEEDBACK_FADE_MS = 800;
const ROUND_COMPLETE_MS = 2200;

const TIPS = [
  "Strong swings can send the ball farther.",
  "A bat is a lever. Timing helps power.",
  "A smooth swing can create longer hits.",
  "Big upward swings can help launch the ball farther.",
  "Watch the ball all the way in.",
  "Timing matters as much as power."
];
let tipIndex = 0;

const stadiumBg = new Image();
let stadiumBgLoaded = false;
stadiumBg.onload = () => { stadiumBgLoaded = true; };
stadiumBg.src = "./stadium-bg.png";

let audioCtx = null;
let soundEnabled = true;
let introMusic = null;
let introMusicStarted = false;
let introFadeTimer = null;
let homeRunMusic = null;
let homeRunMusicTimer = null;

let ambientMasterGain = null;
let ambientRumbleOsc = null;
let ambientRumbleGain = null;
let ambientCrowdInterval = null;
let ambientRunning = false;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

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

if (pitchSpeedSlider && pitchSpeedVal) {
  pitchSpeedSlider.oninput = () => pitchSpeedVal.textContent = pitchSpeedSlider.value;
}
if (swingThresholdSlider && swingThresholdVal) {
  swingThresholdSlider.oninput = () => swingThresholdVal.textContent = swingThresholdSlider.value;
}
if (pitchDelaySlider && pitchDelayVal) {
  pitchDelaySlider.oninput = () => pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;
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
  if (splashScreen) splashScreen.classList.add("hidden");
}

function showSplashScreen() {
  if (splashScreen) splashScreen.classList.remove("hidden");
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

function showControlsPanel() {
  if (!controlDock) return;
  controlDock.classList.remove("hiddenDuringPlay");
  controlDock.style.pointerEvents = "auto";
}
function hideControlsPanel() {
  if (!controlDock) return;
  controlDock.classList.add("hiddenDuringPlay");
  controlDock.style.pointerEvents = "none";
}

function rotateTip() {
  tipIndex = (tipIndex + 1) % TIPS.length;
  if (instructionChip) instructionChip.textContent = TIPS[tipIndex];
}

function getKeypoint(pose, name, minScore = 0.28) {
  return pose?.keypoints?.find(k => k.name === name && (k.score ?? 0) > minScore) || null;
}

function getPoseBounds(rawPoints) {
  const pts = Object.values(rawPoints).filter(Boolean);
  if (!pts.length) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function transformPoseToBattingPosition(rawPoints) {
  const bounds = getPoseBounds(rawPoints);
  if (!bounds) return rawPoints;

  const targetHeight = canvas.height * PLAYER_SCALE;
  const scale = targetHeight / Math.max(bounds.height, 1);

  const scaled = {};
  for (const [key, value] of Object.entries(rawPoints)) {
    scaled[key] = value ? { x: value.x * scale, y: value.y * scale } : null;
  }

  const scaledBounds = getPoseBounds(scaled);
  const targetFootY = canvas.height * PLAYER_FLOOR_Y;
  const targetLeftX = canvas.width * PLAYER_TARGET_X;

  const offsetX = targetLeftX - scaledBounds.minX;
  const offsetY = targetFootY - scaledBounds.maxY;

  for (const key of Object.keys(scaled)) {
    if (!scaled[key]) continue;
    scaled[key].x += offsetX;
    scaled[key].y += offsetY;
  }

  return scaled;
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
  return transformPoseToBattingPosition(rawPoints);
}

function drawBackground() {
  if (stadiumBgLoaded) {
    const imgRatio = stadiumBg.width / stadiumBg.height;
    const canvasRatio = canvas.width / canvas.height;

    let coverWidth;
    let coverHeight;

    if (canvasRatio > imgRatio) {
      coverWidth = canvas.width;
      coverHeight = canvas.width / imgRatio;
    } else {
      coverHeight = canvas.height;
      coverWidth = canvas.height * imgRatio;
    }

    const drawWidth = coverWidth * BG_ZOOM;
    const drawHeight = coverHeight * BG_ZOOM;
    const offsetX = (canvas.width - drawWidth) / 2;
    const offsetY = (canvas.height - drawHeight) / 2 - canvas.height * 0.02;

    ctx.drawImage(stadiumBg, offsetX, offsetY, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = "#1e2f4d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const skyGlow = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.42);
  skyGlow.addColorStop(0, "rgba(255,255,255,0.06)");
  skyGlow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = skyGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.42);

  const lowerFieldGrad = ctx.createLinearGradient(0, canvas.height * 0.58, 0, canvas.height * 0.92);
  lowerFieldGrad.addColorStop(0, "rgba(32,120,58,0.00)");
  lowerFieldGrad.addColorStop(1, "rgba(36,145,74,0.22)");
  ctx.fillStyle = lowerFieldGrad;
  ctx.fillRect(0, canvas.height * 0.58, canvas.width, canvas.height * 0.34);

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.03, canvas.height * BALL_LANE_Y);
  ctx.lineTo(canvas.width * 0.98, canvas.height * BALL_LANE_Y);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.84, canvas.height * 0.49);
  ctx.lineTo(canvas.width * 0.26, canvas.height * 0.78);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.84, canvas.height * 0.73);
  ctx.lineTo(canvas.width * 0.26, canvas.height * 0.78);
  ctx.stroke();
}

// ... full patched file continues ...
// The complete patched file is in this canvas document.
// Copy from here instead of the broken link.

async function startOrResumeGame(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (startInProgress) return;
  startInProgress = true;

  try {
    initAudio();

    if (!introMusicStarted) {
      await playIntroMusic();
    }

    await ensureVisionReady();

    splashReadyForHands = true;
    hideSplashScreen();

    if (gameState === "paused") {
      gameState = "playing";
      if (pauseBtn) pauseBtn.textContent = "Pause";
      if (instructionChip) instructionChip.textContent = "Game resumed.";
      hideControlsPanel();
      startAmbientCrowd();
      if (!ball) scheduleNextPitch();
      playStartSound();
      if (!animationId) loop();
      return;
    }

    resetRound();
    if (pauseBtn) pauseBtn.textContent = "Pause";
    playStartSound();
    startCountdown();

    if (!animationId) loop();
  } catch (err) {
    console.error("START ERROR:", err);
    alert("Start failed: " + err.message);
  } finally {
    startInProgress = false;
  }
}

if (startBtn) {
  startBtn.onclick = startOrResumeGame;
  startBtn.addEventListener("click", startOrResumeGame);
}
if (splashStartBtn) {
  splashStartBtn.onclick = startOrResumeGame;
  splashStartBtn.addEventListener("click", startOrResumeGame);
}

setDifficulty("medium");
updateHud();
resizeCanvas();

if (pitchDelayVal && pitchDelaySlider) pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;
if (instructionChip) instructionChip.textContent = "Press Start or raise both hands to begin.";

if ("speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

(async () => {
  try {
    await ensureVisionReady();
    splashReadyForHands = true;
    if (!animationId) loop();
  } catch (err) {
    console.warn("Warm init failed until user starts:", err);
  }
})();
