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

const MODES = {
  kid: {
    contactBoost: 1.18,
    powerBoost: 1.10,
    gravityBoost: 0.92,
    label: "KID MODE"
  },
  pro: {
    contactBoost: 0.96,
    powerBoost: 1.00,
    gravityBoost: 1.06,
    label: "PRO MODE"
  }
};

let difficulty = "medium";
let detector = null;
let animationId = null;
let gameState = "start";
let battingSide = "right";

let startInProgress = false;

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
let lastBatSegment = null;

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

let turtleImg = new Image();
turtleImg.src = "./happy-turtle-cartoon-generated-by-ai_942243-2745 (1).png";

let bronxGlowTimer = 0;

let introChimePlayed = false;
let turtleEntranceOffset = 180;
let turtleFloatPhase = 0;
let bronxIntroShimmer = 0;

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
let arcadeMode = "kid";
let streakCount = 0;
let streakTimer = 0;
let streakText = "";
let streakTextTimer = 0;

let splashReadyForHands = false;
let handRaiseHoldMs = 0;
let lastRaiseCheckTime = 0;
let autoStartTriggered = false;

const BALL_RADIUS = 14;
const GRAVITY = 0.44;
let CONTACT_DISTANCE = DIFFICULTIES[difficulty].contactDistance;
const BAT_LENGTH = 150;

const PLAYER_SCALE = 0.34;
const PLAYER_FLOOR_Y = 0.89;
const BALL_LANE_Y = 0.66;
const BG_ZOOM = 0.86;

function getPlayerTargetX() {
  // Right-handed batter stands on the right side of the screen and swings left.
  // Left-handed batter stands on the left side of the screen and swings right.
  return battingSide === "right" ? 0.72 : 0.15;
}

function getBallSpawnXRatio() {
  return battingSide === "right" ? 0.06 : 0.965;
}

function getBallMissXRatio() {
  return battingSide === "right" ? 0.94 : 0.12;
}

function getIncomingPitchVelocityX(speed) {
  return battingSide === "right"
    ? (speed + Math.random() * 0.45)
    : (-speed - Math.random() * 0.45);
}

function getBallApproachProgress(x) {
  if (battingSide === "right") {
    return x / canvas.width;
  }
  return 1 - (x / canvas.width);
}

function getPitcherMiniMapX() {
  return battingSide === "right" ? 20 : miniMapCanvas.width - 16;
}

function getBatterMiniMapX() {
  return battingSide === "right" ? miniMapCanvas.width - 28 : 28;
}

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
let cameraZoom = 1;
let targetCameraZoom = 1;
let cameraZoomFrames = 0;
let stadiumLightPhase = 0;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function setArcadeMode(mode) {
  arcadeMode = mode;
  if (instructionChip) {
    instructionChip.textContent = mode === "kid"
      ? "Kid Mode on: bigger contact zone, easier launch."
      : "Pro Mode on: tighter contact, more demanding timing.";
  }
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
  const targetLeftX = canvas.width * getPlayerTargetX();

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

function updateCameraZoom() {
  if (cameraZoomFrames > 0) {
    cameraZoomFrames--;
  } else {
    targetCameraZoom = 1;
  }

  cameraZoom += (targetCameraZoom - cameraZoom) * 0.12;
}

function drawStadiumLights() {
  stadiumLightPhase += 0.012;

  const beam1X = canvas.width * (0.18 + Math.sin(stadiumLightPhase) * 0.08);
  const beam2X = canvas.width * (0.78 + Math.cos(stadiumLightPhase * 0.9) * 0.08);

  const grad1 = ctx.createLinearGradient(beam1X, 0, beam1X + 160, canvas.height * 0.55);
  grad1.addColorStop(0, "rgba(255,255,255,0.13)");
  grad1.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad1;
  ctx.beginPath();
  ctx.moveTo(beam1X, 0);
  ctx.lineTo(beam1X + 110, 0);
  ctx.lineTo(beam1X + 230, canvas.height * 0.58);
  ctx.lineTo(beam1X - 60, canvas.height * 0.58);
  ctx.closePath();
  ctx.fill();

  const grad2 = ctx.createLinearGradient(beam2X, 0, beam2X - 160, canvas.height * 0.55);
  grad2.addColorStop(0, "rgba(255,255,255,0.10)");
  grad2.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad2;
  ctx.beginPath();
  ctx.moveTo(beam2X, 0);
  ctx.lineTo(beam2X - 110, 0);
  ctx.lineTo(beam2X - 230, canvas.height * 0.58);
  ctx.lineTo(beam2X + 60, canvas.height * 0.58);
  ctx.closePath();
  ctx.fill();
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
  drawStadiumLights();
  
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

function initAudio() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioCtx = new AudioCtx();
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  if (!ambientMasterGain && audioCtx) {
    ambientMasterGain = audioCtx.createGain();
    ambientMasterGain.gain.value = 0;
    ambientMasterGain.connect(audioCtx.destination);
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

function noiseBurst(duration = 0.22, gainValue = 0.015) {
  if (!soundEnabled || !audioCtx) return;

  const bufferSize = Math.floor(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.18;

  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  filter.type = "bandpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.8;
  gain.gain.value = gainValue;

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

function playStartSound() {
  tone(523.25, 0.10, "triangle", 0.14, 0);
  tone(659.25, 0.12, "triangle", 0.14, 0.08);
  tone(783.99, 0.16, "triangle", 0.14, 0.16);
}
function playPitchSound() {
  tone(240, 0.08, "sawtooth", 0.09, 0);
  tone(180, 0.08, "sawtooth", 0.07, 0.05);
  noiseBurst(0.08, 0.008);
}
function playMissSound() {
  tone(220, 0.08, "square", 0.08, 0);
  tone(170, 0.10, "square", 0.06, 0.06);
}
function playHitSound() {
  tone(180, 0.03, "square", 0.14, 0);
  tone(320, 0.08, "triangle", 0.10, 0.015);
  noiseBurst(0.05, 0.010);
}
function playBigHitSound() {
  tone(220, 0.04, "square", 0.15, 0);
  tone(440, 0.08, "triangle", 0.12, 0.03);
  tone(660, 0.12, "triangle", 0.10, 0.08);
  noiseBurst(0.08, 0.016);
}
function playHomeRunSound() {
  tone(392, 0.10, "triangle", 0.14, 0);
  tone(523.25, 0.10, "triangle", 0.14, 0.08);
  tone(659.25, 0.12, "triangle", 0.14, 0.16);
  tone(783.99, 0.18, "triangle", 0.14, 0.26);
  tone(1046.5, 0.20, "triangle", 0.12, 0.42);
  tone(1318.5, 0.24, "triangle", 0.10, 0.60);
  noiseBurst(0.14, 0.020);
}
function playBooSound() {
  tone(180, 0.10, "sawtooth", 0.08, 0);
  tone(150, 0.16, "sawtooth", 0.06, 0.08);
}
function playCheerSound() {
  tone(520, 0.08, "triangle", 0.10, 0);
  tone(620, 0.10, "triangle", 0.10, 0.07);
  tone(760, 0.12, "triangle", 0.10, 0.16);
  noiseBurst(0.10, 0.012);
}
function playCountdownBeep(num) {
  const f = num > 1 ? 660 : 880;
  tone(f, 0.10, "triangle", 0.11, 0);
}
function playGoSound() {
  tone(880, 0.08, "triangle", 0.12, 0);
  tone(1174.66, 0.12, "triangle", 0.12, 0.08);
}
function playPowerMeterBlip(power) {
  if (power < 0.35) return;
  const freq = 220 + power * 260;
  tone(freq, 0.035, "triangle", 0.035, 0);
}

function playIntroStadiumChime() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  tone(523.25, 0.10, "triangle", 0.08, 0);
  tone(659.25, 0.12, "triangle", 0.08, 0.08);
  tone(783.99, 0.16, "triangle", 0.07, 0.18);
}

function updateIntroDecor() {
  if (gameState !== "start") return;

  if (!introChimePlayed) {
    introChimePlayed = true;
    playIntroStadiumChime();
  }

  turtleEntranceOffset += (0 - turtleEntranceOffset) * 0.06;
  turtleFloatPhase += 0.04;
  bronxIntroShimmer += 0.025;
}

function drawIntroBronxShimmer() {
  if (gameState !== "start") return;

  const letters = ["B", "R", "O", "N", "X"];
  const baseX = canvas.width * 0.5 - 100;
  const y = canvas.height * 0.18;

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = '900 46px "Baloo 2", sans-serif';

  for (let i = 0; i < letters.length; i++) {
    const shimmer = Math.sin(bronxIntroShimmer * 2 + i * 0.6);
    const glow = Math.max(0, shimmer);

    ctx.fillStyle = glow > 0.65 ? "#ffd43b" : "rgba(255,255,255,0.72)";
    ctx.shadowBlur = glow > 0.65 ? 18 : 0;
    ctx.shadowColor = "#ffd43b";
    ctx.fillText(letters[i], baseX + i * 50, y);
  }

  ctx.restore();
}

function drawIntroTurtleMascot() {
  if (gameState !== "start") return;
  if (!turtleImg.complete) return;

  const w = 150;
  const h = 150;
  const x = canvas.width - 190 + turtleEntranceOffset;
  const y = canvas.height - 210 + Math.sin(turtleFloatPhase) * 8;

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.shadowBlur = 22;
  ctx.shadowColor = "rgba(255,212,59,0.28)";
  ctx.drawImage(turtleImg, x, y, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = clamp(1 - turtleEntranceOffset / 180, 0, 1);
  ctx.fillStyle = "rgba(8,18,40,0.78)";
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - 170, y + 16, 150, 46, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 16px "Nunito", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("Ready to play?", x - 95, y + 45);
  ctx.restore();
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
  } catch {}
}
function fadeOutIntroMusic(duration = 1800) {
  if (!introMusic || introMusic.paused) return;

  if (introFadeTimer) clearInterval(introFadeTimer);

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
    if (homeRunMusicTimer) clearTimeout(homeRunMusicTimer);

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
  } catch {}
}

function startAmbientCrowd() {
  if (!audioCtx || !soundEnabled || ambientRunning) return;
  ambientRunning = true;

  ambientMasterGain.gain.cancelScheduledValues(audioCtx.currentTime);
  ambientMasterGain.gain.linearRampToValueAtTime(0.040, audioCtx.currentTime + 0.6);

  ambientRumbleOsc = audioCtx.createOscillator();
  ambientRumbleGain = audioCtx.createGain();
  ambientRumbleOsc.type = "sine";
  ambientRumbleOsc.frequency.value = 74;
  ambientRumbleGain.gain.value = 0.011;
  ambientRumbleOsc.connect(ambientRumbleGain);
  ambientRumbleGain.connect(ambientMasterGain);
  ambientRumbleOsc.start();

  ambientCrowdInterval = setInterval(() => {
    if (!audioCtx || !ambientRunning || !soundEnabled) return;

    const base = 180 + Math.random() * 120;
    tone(base, 0.25, "triangle", 0.012, 0);
    tone(base * 1.18, 0.22, "triangle", 0.009, 0.04);
    tone(90 + Math.random() * 30, 0.18, "sine", 0.008, 0);

    if (Math.random() > 0.78) {
      tone(520 + Math.random() * 80, 0.10, "triangle", 0.010, 0);
      noiseBurst(0.06, 0.008);
    }

    if (Math.random() > 0.88) {
      tone(640 + Math.random() * 100, 0.12, "triangle", 0.012, 0);
      tone(760 + Math.random() * 120, 0.14, "triangle", 0.010, 0.05);
    }
  }, 900);
}

function stopAmbientCrowd() {
  if (!ambientRunning) return;
  ambientRunning = false;

  if (ambientCrowdInterval) {
    clearInterval(ambientCrowdInterval);
    ambientCrowdInterval = null;
  }

  if (ambientMasterGain && audioCtx) {
    ambientMasterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    ambientMasterGain.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + 0.35);
  }

  if (ambientRumbleOsc) {
    try { ambientRumbleOsc.stop(audioCtx.currentTime + 0.4); } catch {}
    ambientRumbleOsc = null;
  }
  ambientRumbleGain = null;
}

function speakCoach(text) {
  if (!soundEnabled || !("speechSynthesis" in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.pitch = 1.0;
    utter.volume = 0.9;

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find(v => /en-US/i.test(v.lang) && /Google|Samantha|Jenny|Aria|Davis|Guy/i.test(v.name)) ||
      voices.find(v => /en-US/i.test(v.lang)) ||
      voices[0];

    if (preferred) utter.voice = preferred;
    window.speechSynthesis.speak(utter);
  } catch {}
}

function coachSay(text, overlayMs = 2200, speak = false) {
  coachText = text;
  coachTextTimer = Math.round(overlayMs / (1000 / 60));
  if (speak) speakCoach(text.replace(/^Coach:\s*/i, ""));
}

function setCrowdText(text, ms = 1800) {
  crowdText = text;
  crowdTextTimer = Math.round(ms / (1000 / 60));
}

function updateCrowdMood(type) {
  if (type === "home_run") {
    crowdMood = "wild";
    setCrowdText("CROWD GOES WILD!", 2200);
    playCheerSound();
    return;
  }
  if (type === "big_hit") {
    crowdMood = "cheer";
    setCrowdText("BIG CHEER!", 1800);
    playCheerSound();
    return;
  }
  if (type === "miss") {
    crowdMood = "boo";
    setCrowdText("OOOH!", 1500);
    playBooSound();
    return;
  }
  crowdMood = "quiet";
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
  stopAmbientCrowd();

  showRoundComplete = true;
  roundCompleteTimer = Math.round(ROUND_COMPLETE_MS / (1000 / 60));
  gameState = "round_complete";

  summaryTimer = setTimeout(() => {
    showRoundComplete = false;
    roundSummary = buildRoundSummary();
    gameState = "summary";
    showControlsPanel();
    coachSay("Coach: Review the round and press reset when you're ready.", 5000, true);
  }, ROUND_COMPLETE_MS + 2200);
}

function resetRound() {
  clearPitchTimer();
  clearCountdownTimer();
  clearSummaryTimer();

  score = 0;
  hits = 0;
  misses = 0;
  homeRuns = 0;
  bestDistanceFt = 0;
  currentDistanceFt = 0;
  pitchesLeft = roundPitches;

  prevBatPoint = null;
  batVelocity = { x: 0, y: 0, speed: 0 };
  lastBatTip = null;
  ball = null;

  hitText = "";
  hitTextTimer = 0;
  timingText = "";
  timingTextTimer = 0;
  distanceText = "";
  distanceTextTimer = 0;
  missText = "";
  missTextTimer = 0;

  coachText = "";
  coachTextTimer = 0;
  crowdText = "";
  crowdTextTimer = 0;
  crowdMood = "quiet";

  accuracyMarkerTimer = 0;
  lastTimingOffset = 0.5;
  lastTimingRating = "";

  swingPowerDisplay = 0;
  swingPowerPeak = 0;

  handRaiseHoldMs = 0;
  lastRaiseCheckTime = 0;
  autoStartTriggered = false;

  flashTimer = 0;
  confetti = [];
  floatingStars = [];
  homerBursts = [];
  homerTrailParticles = [];
  batTrail = [];

  screenShakeTimer = 0;
  screenShakeAmount = 0;

  countdownActive = false;
  countdownValue = 5;
  roundSummary = null;
  showRoundComplete = false;
  roundCompleteTimer = 0;

  CONTACT_DISTANCE = DIFFICULTIES[difficulty].contactDistance;
  updateHud();

  if (instructionChip) {
    instructionChip.textContent = "Strong swings can send the ball farther. Timing matters too.";
  }

  showControlsPanel();
}

function getTimingFeedback(batTip, ballObj) {
  const diff = battingSide === "right"
    ? (ballObj.x - batTip.x)
    : (batTip.x - ballObj.x);

  const absDiff = Math.abs(diff);

  if (absDiff <= 16) {
    lastTimingOffset = 0.50;
    lastTimingRating = "PERFECT!";
    accuracyMarkerTimer = Math.round(2200 / (1000 / 60));
    return { label: "PERFECT!", powerBonus: 1.14, direction: 1.0 };
  }

  if (diff < -16) {
    lastTimingOffset = 0.22;
    lastTimingRating = "TOO EARLY";
    accuracyMarkerTimer = Math.round(2200 / (1000 / 60));
    return { label: "TOO EARLY", powerBonus: 0.86, direction: 0.92 };
  }

  lastTimingOffset = 0.80;
  lastTimingRating = "TOO LATE";
  accuracyMarkerTimer = Math.round(2200 / (1000 / 60));
  return { label: "TOO LATE", powerBonus: 0.84, direction: 1.05 };
}

function estimateDistanceFt(power, resultLabel) {
  let base = 20 + power * 55;
  if (resultLabel === "DOUBLE!") base += 18;
  if (resultLabel === "TRIPLE!") base += 34;
  if (resultLabel === "HOME RUN!") base += 55;
  return Math.round(clamp(base, 12, 220));
}

function getHitCommentary(resultLabel, timingLabel, distanceFt) {
  if (resultLabel === "HOME RUN!") {
    if (timingLabel === "PERFECT!") return `Coach: Perfect timing! That's gone! ${distanceFt} feet!`;
    if (timingLabel === "TOO EARLY") return `Coach: You got out in front and still crushed it! ${distanceFt} feet!`;
    return `Coach: You stayed on it and launched it! ${distanceFt} feet!`;
  }

  if (resultLabel === "TRIPLE!") {
    if (timingLabel === "PERFECT!") return `Coach: Perfect barrel. That's deep into the gap!`;
    return `Coach: Big swing. That's extra bases!`;
  }

  if (resultLabel === "DOUBLE!") {
    if (timingLabel === "TOO EARLY") return `Coach: A little early, but you drove it hard!`;
    if (timingLabel === "TOO LATE") return `Coach: Late hands, but strong contact!`;
    return `Coach: Nice solid shot. That's a double!`;
  }

  if (resultLabel === "SINGLE!") {
    if (timingLabel === "PERFECT!") return `Coach: Nice contact. You squared it up.`;
    if (timingLabel === "TOO EARLY") return `Coach: Early swing, but you still found it.`;
    if (timingLabel === "TOO LATE") return `Coach: A little late, but you got a piece of it.`;
    return `Coach: Nice job putting the bat on the ball.`;
  }

  if (timingLabel === "TOO EARLY") return `Coach: You were early. Wait a beat longer next time.`;
  if (timingLabel === "TOO LATE") return `Coach: Late swing. Start a little sooner.`;
  return `Coach: You got a piece of it. Stay with the ball.`;
}

function getFunHitText(resultLabel, distanceFt) {
  if (resultLabel === "HOME RUN!") return `HOME RUN! ${distanceFt} FT`;
  if (distanceFt >= 130) return `ROCKET BALL! ${distanceFt} FT`;
  if (distanceFt >= 95) return `BIG SMASH! ${distanceFt} FT`;
  if (distanceFt >= 70) return `NICE HIT! ${distanceFt} FT`;
  return `${resultLabel} ${distanceFt} FT`;
}

function classifyHit(power, upwardSwing) {
  if (power > 2.0 && upwardSwing > 0.78) {
    return { label: "HOME RUN!", points: 80, confettiCount: 42, launchBoost: 1.18 };
  }
  if (power > 1.55 && upwardSwing > 0.42) {
    return { label: "TRIPLE!", points: 45, confettiCount: 24, launchBoost: 0.98 };
  }
  if (power > 1.10) {
    return { label: "DOUBLE!", points: 28, confettiCount: 16, launchBoost: 0.84 };
  }
  if (power > 0.72) {
    return { label: "SINGLE!", points: 16, confettiCount: 10, launchBoost: 0.68 };
  }
  return { label: "FOUL TIP!", points: 8, confettiCount: 6, launchBoost: 0.50 };
}

function createPitch() {
  if (pitchesLeft <= 0 || gameState !== "playing" || ball) return;

  CONTACT_DISTANCE = DIFFICULTIES[difficulty].contactDistance;
  const scale = DIFFICULTIES[difficulty].ballScale;
  const sliderPitchSpeed = parseFloat(pitchSpeedSlider?.value || String(DIFFICULTIES[difficulty].pitchSpeed));

  ball = {
    x: canvas.width * getBallSpawnXRatio(),
    y: canvas.height * BALL_LANE_Y + (Math.random() - 0.5) * canvas.height * 0.024,
    vx: getIncomingPitchVelocityX(sliderPitchSpeed),
    vy: (Math.random() - 0.5) * 0.08,
    size: BALL_RADIUS * scale * 1.12,
    hit: false,
    active: true,
    trail: [],
    result: "",
    estimatedDistanceFt: 0,
    contactX: 0
  };

  playPitchSound();
  coachSay("Coach: Track it all the way in.", 2200, false);
}

function scheduleNextPitch(extraDelayMs = 0) {
  clearPitchTimer();
  if (pitchesLeft <= 0 || gameState !== "playing") return;

  const baseDelayMs = Math.round((parseFloat(pitchDelaySlider?.value || "3.5")) * 1000);
  const delayMs = baseDelayMs + extraDelayMs;

  rotateTip();

  pitchTimer = setTimeout(() => {
    if (gameState === "playing" && !ball) {
      createPitch();
      if (instructionChip) instructionChip.textContent = "Swing across your body to meet the ball.";
      coachSay("Coach: Eyes on the ball.", 2200, false);
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

function getMissFeedback() {
  if (!lastBatTip || !ball) return "MISSED IT";
  const dx = lastBatTip.x - ball.x;
  const dy = lastBatTip.y - ball.y;
  if (Math.abs(dy) > 36) return dy < 0 ? "SWING TOO HIGH" : "SWING TOO LOW";
  if (battingSide === "right") return dx < 0 ? "TOO LATE" : "TOO EARLY";
  return dx < 0 ? "TOO EARLY" : "TOO LATE";
}

function spawnConfetti(x, y, count) {
  for (let i = 0; i < count; i++) {
    confetti.push({
      x, y,
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

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby || 1;

  let t = (apx * abx + apy * aby) / abLenSq;
  t = clamp(t, 0, 1);

  const cx = ax + abx * t;
  const cy = ay + aby * t;

  return Math.hypot(px - cx, py - cy);
}

function triggerHomeRunCelebration(x, y) {
  screenShakeTimer = 28;
  screenShakeAmount = 14;
  flashTimer = 14;
  targetCameraZoom = 1.12;
  cameraZoomFrames = 22;

  for (let i = 0; i < 4; i++) {
    homerBursts.push({
      x: x + (Math.random() - 0.5) * 120,
      y: y + (Math.random() - 0.5) * 80,
      radius: 10,
      life: 26 + i * 4,
      color: ["#ffd54f", "#42a5f5", "#ff7043", "#66bb6a"][i % 4]
    });
  }

  for (let i = 0; i < 34; i++) {
    homerTrailParticles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 7 - 1,
      life: 20 + Math.random() * 22,
      size: 4 + Math.random() * 7,
      color: ["#ffd54f", "#ffffff", "#25a9ff", "#ff7043"][i % 4]
    });
  }

  bronxGlowTimer = 52;
  playHomeRunSound();
  playHomeRunMusicBurst();
  updateCrowdMood("home_run");
}

function updateBatVelocity(batTip) {
  if (!batTip) return;

  if (!prevBatPoint) {
    prevBatPoint = { x: batTip.x, y: batTip.y };
    batVelocity = { x: 0, y: 0, speed: 0 };
    return;
  }

  const dx = batTip.x - prevBatPoint.x;
  const dy = batTip.y - prevBatPoint.y;
  const speed = Math.hypot(dx, dy);

  batVelocity = { x: dx, y: dy, speed };
  prevBatPoint = { x: batTip.x, y: batTip.y };

  const power = clamp((speed - 4) / 24, 0, 1);
  swingPowerDisplay += (power - swingPowerDisplay) * 0.24;
  swingPowerPeak = Math.max(swingPowerPeak * 0.96, swingPowerDisplay);

  if (power > 0.62 && Math.random() > 0.92) {
    playPowerMeterBlip(power);
  }
}

function updateBatTrail(batTip) {
  if (!batTip) return;
  batTrail.push({
    x: batTip.x,
    y: batTip.y,
    life: 10
  });
  if (batTrail.length > 16) batTrail.shift();
}

function tickBatTrail() {
  for (let i = batTrail.length - 1; i >= 0; i--) {
    batTrail[i].life--;
    if (batTrail[i].life <= 0) batTrail.splice(i, 1);
  }
}

function drawBatTrail() {
  if (batTrail.length < 2) return;

  ctx.save();
  for (let i = 1; i < batTrail.length; i++) {
    const a = batTrail[i - 1];
    const b = batTrail[i];
    const alpha = b.life / 10;

    ctx.strokeStyle = `rgba(255,212,59,${0.18 * alpha})`;
    ctx.lineWidth = 8 * alpha + 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStar(x, y, size, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 12, size / 12);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? 12 : 5;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(255,212,59,${alpha})`;
  ctx.fill();
  ctx.restore();
}

function getBattingArm(points) {
  if (!points) return null;

  if (battingSide === "right") {
    if (points.rightWrist && points.rightElbow) {
      return { wrist: points.rightWrist, elbow: points.rightElbow };
    }
    if (points.leftWrist && points.leftElbow) {
      return { wrist: points.leftWrist, elbow: points.leftElbow };
    }
  } else {
    if (points.leftWrist && points.leftElbow) {
      return { wrist: points.leftWrist, elbow: points.leftElbow };
    }
    if (points.rightWrist && points.rightElbow) {
      return { wrist: points.rightWrist, elbow: points.rightElbow };
    }
  }

  return null;
}

function drawJointDot(p, color = "rgba(255,255,255,0.9)", r = 6) {
  if (!p) return;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSkeletonLine(a, b, color = "rgba(255,255,255,0.22)", width = 8) {
  if (!a || !b) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawSilhouetteFigure(pose) {
  const points = getScaledPosePoints(pose);
  if (!points) return null;

  const {
    nose,
    leftShoulder, rightShoulder,
    leftElbow, rightElbow,
    leftWrist, rightWrist,
    leftHip, rightHip,
    leftKnee, rightKnee,
    leftAnkle, rightAnkle
  } = points;

  const shoulderMid = leftShoulder && rightShoulder
    ? { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 }
    : null;

  const hipMid = leftHip && rightHip
    ? { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 }
    : null;

  const headRadius = shoulderMid && nose
    ? clamp(Math.abs(shoulderMid.y - nose.y) * 0.75, 15, 28)
    : 18;

  ctx.save();
  ctx.globalAlpha = 0.94;

  drawSkeletonLine(leftShoulder, rightShoulder, "rgba(255,255,255,0.35)", 14);
  drawSkeletonLine(leftHip, rightHip, "rgba(255,255,255,0.32)", 16);

  drawSkeletonLine(leftShoulder, leftElbow, "rgba(255,255,255,0.30)", 10);
  drawSkeletonLine(leftElbow, leftWrist, "rgba(255,255,255,0.26)", 9);
  drawSkeletonLine(rightShoulder, rightElbow, "rgba(255,255,255,0.30)", 10);
  drawSkeletonLine(rightElbow, rightWrist, "rgba(255,255,255,0.26)", 9);

  drawSkeletonLine(leftShoulder, leftHip, "rgba(255,255,255,0.24)", 12);
  drawSkeletonLine(rightShoulder, rightHip, "rgba(255,255,255,0.24)", 12);
  drawSkeletonLine(shoulderMid, hipMid, "rgba(255,255,255,0.22)", 14);

  drawSkeletonLine(leftHip, leftKnee, "rgba(255,255,255,0.24)", 10);
  drawSkeletonLine(leftKnee, leftAnkle, "rgba(255,255,255,0.20)", 9);
  drawSkeletonLine(rightHip, rightKnee, "rgba(255,255,255,0.24)", 10);
  drawSkeletonLine(rightKnee, rightAnkle, "rgba(255,255,255,0.20)", 9);

  if (nose) {
    ctx.beginPath();
    ctx.arc(nose.x, nose.y, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  drawJointDot(leftShoulder, "#cfe6ff", 6);
  drawJointDot(rightShoulder, "#cfe6ff", 6);
  drawJointDot(leftElbow, "#bcd9ff", 5);
  drawJointDot(rightElbow, "#bcd9ff", 5);
  drawJointDot(leftWrist, "#ffd54f", 6);
  drawJointDot(rightWrist, "#ffd54f", 6);
  drawJointDot(leftHip, "#bdecc7", 6);
  drawJointDot(rightHip, "#bdecc7", 6);
  drawJointDot(leftKnee, "rgba(255,255,255,0.65)", 5);
  drawJointDot(rightKnee, "rgba(255,255,255,0.65)", 5);
  drawJointDot(leftAnkle, "rgba(255,255,255,0.55)", 5);
  drawJointDot(rightAnkle, "rgba(255,255,255,0.55)", 5);

  ctx.restore();
  return points;
}

function drawBatFromSide(wrist, elbow) {
  if (!wrist || !elbow) return null;

  const forearmDx = wrist.x - elbow.x;
  const forearmDy = wrist.y - elbow.y;
  const len = Math.hypot(forearmDx, forearmDy) || 1;

  const dirX = forearmDx / len;
  const dirY = forearmDy / len;

  const extension = battingSide === "right" ? -1 : 1;

  const batStart = {
    x: wrist.x - dirX * 18,
    y: wrist.y - dirY * 18
  };

  const batTip = {
    x: batStart.x + dirX * BAT_LENGTH * extension,
    y: batStart.y + dirY * BAT_LENGTH * extension
  };

  lastBatSegment = { ax: batStart.x, ay: batStart.y, bx: batTip.x, by: batTip.y };
  lastBatTip = batTip;

  ctx.save();
  ctx.strokeStyle = "#c98b46";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(batStart.x, batStart.y);
  ctx.lineTo(batTip.x, batTip.y);
  ctx.stroke();

  ctx.strokeStyle = "#5a320f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(batStart.x, batStart.y);
  ctx.lineTo(batTip.x, batTip.y);
  ctx.stroke();

  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(batStart.x, batStart.y, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  return batTip;
}

function tryHit(batTip) {
  if (!ball || !ball.active || ball.hit || !lastBatSegment || !batTip) return;

  const distToBat = pointToSegmentDistance(
    ball.x,
    ball.y,
    lastBatSegment.ax,
    lastBatSegment.ay,
    lastBatSegment.bx,
    lastBatSegment.by
  );

  const threshold = CONTACT_DISTANCE * (arcadeMode === "kid" ? MODES.kid.contactBoost : MODES.pro.contactBoost);
  const minSwing = parseFloat(swingThresholdSlider?.value || "420") / 100;

  const towardBall = battingSide === "right"
    ? batVelocity.x < -0.4
    : batVelocity.x > 0.4;

  if (distToBat > threshold || batVelocity.speed < minSwing || !towardBall) return;

  ball.hit = true;
  ball.active = false;
  pitchesLeft--;
  hits++;

  const timing = getTimingFeedback(batTip, ball);
  const swingPower = clamp((batVelocity.speed / 12), 0.3, 2.4);
  const upwardSwing = clamp((-batVelocity.y + 1.5) / 12, 0, 1.2);
  const mode = arcadeMode === "kid" ? MODES.kid : MODES.pro;

  const result = classifyHit(swingPower * timing.powerBonus * mode.powerBoost, upwardSwing);
  ball.result = result.label;

  const horizontalDirection = battingSide === "right" ? -1 : 1;
  const launchX = horizontalDirection * (4.5 + swingPower * 3.6 * timing.direction);
  const launchY = -(4.2 + upwardSwing * 6.2 * result.launchBoost) / mode.gravityBoost;

  ball.vx = launchX;
  ball.vy = launchY;
  ball.active = true;
  ball.contactX = ball.x;
  ball.estimatedDistanceFt = estimateDistanceFt(swingPower * timing.powerBonus * mode.powerBoost, result.label);
  currentDistanceFt = ball.estimatedDistanceFt;

  score += result.points;
  if (result.label === "HOME RUN!") homeRuns++;

  bestDistanceFt = Math.max(bestDistanceFt, ball.estimatedDistanceFt);
  updateHud();

  hitText = getFunHitText(result.label, ball.estimatedDistanceFt);
  hitTextTimer = Math.round((result.label === "HOME RUN!" ? HOME_RUN_FEEDBACK_MS : result.label === "TRIPLE!" || result.label === "DOUBLE!" ? BIG_HIT_FEEDBACK_MS : HIT_FEEDBACK_MS) / (1000 / 60));

  timingText = timing.label;
  timingTextTimer = Math.round(2200 / (1000 / 60));

  distanceText = `${ball.estimatedDistanceFt} FT`;
  distanceTextTimer = Math.round(2600 / (1000 / 60));

  streakCount++;
  streakTimer = 180;
  if (streakCount >= 2) {
    streakText = `${streakCount} HIT STREAK!`;
    streakTextTimer = 140;
  }

  spawnConfetti(ball.x, ball.y, result.confettiCount);
  spawnStars(ball.x, ball.y, result.label);

  coachSay(getHitCommentary(result.label, timing.label, ball.estimatedDistanceFt), 3200, result.label === "HOME RUN!");
  updateCrowdMood(result.label === "HOME RUN!" ? "home_run" : (result.label === "TRIPLE!" || result.label === "DOUBLE!") ? "big_hit" : "quiet");

  if (result.label === "HOME RUN!") {
    triggerHomeRunCelebration(ball.x, ball.y);
  } else if (result.label === "TRIPLE!" || result.label === "DOUBLE!") {
    playBigHitSound();
    targetCameraZoom = 1.06;
    cameraZoomFrames = 12;
  } else {
    playHitSound();
  }
}

function updateDistanceDuringFlight() {
  if (!ball || !ball.hit || !ball.active) return;
  const traveledPx = Math.abs(ball.x - ball.contactX);
  const bonus = Math.abs(ball.vx) * 2 + Math.max(0, -ball.vy) * 1.6;
  currentDistanceFt = Math.max(currentDistanceFt, Math.round(traveledPx * 0.18 + bonus * 5));
  bestDistanceFt = Math.max(bestDistanceFt, currentDistanceFt);
  updateHud();
}

function updateBall() {
  if (!ball) return;

  ball.trail.push({ x: ball.x, y: ball.y, life: 12 });
  if (ball.trail.length > 14) ball.trail.shift();

  for (let i = ball.trail.length - 1; i >= 0; i--) {
    ball.trail[i].life--;
    if (ball.trail[i].life <= 0) ball.trail.splice(i, 1);
  }

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.hit) {
    ball.vy += GRAVITY * (arcadeMode === "kid" ? MODES.kid.gravityBoost : MODES.pro.gravityBoost);

    if (ball.result === "HOME RUN!") {
      homerTrailParticles.push({
        x: ball.x,
        y: ball.y,
        vx: (Math.random() - 0.5) * 2.8,
        vy: (Math.random() - 0.5) * 2.2,
        life: 14 + Math.random() * 10,
        size: 3 + Math.random() * 3,
        color: ["#ffd54f", "#ffffff", "#25a9ff", "#ff7043"][Math.floor(Math.random() * 4)]
      });
    }

    if (
      ball.y > canvas.height * 0.92 ||
      ball.x < -80 ||
      ball.x > canvas.width + 80
    ) {
      ball = null;

      if (pitchesLeft <= 0) {
        endRoundToSummary();
      } else {
        schedulePitchAfterFeedback(900);
      }
    }

    return;
  }

  const missX = canvas.width * getBallMissXRatio();
  const outOfZone = (ball.vx < 0 && ball.x < missX) || (ball.vx > 0 && ball.x > missX);

  if (outOfZone) {
    misses++;
    pitchesLeft--;
    updateHud();

    missText = getMissFeedback();
    missTextTimer = Math.round(MISS_FEEDBACK_MS / (1000 / 60));

    streakCount = 0;
    playMissSound();
    updateCrowdMood("miss");
    coachSay("Coach: Stay with it. Watch the ball into the bat.", 2400, false);

    ball = null;

    if (pitchesLeft <= 0) {
      endRoundToSummary();
    } else {
      schedulePitchAfterFeedback(900);
    }
  }
}

function updateAndDrawConfetti() {
  if (!confetti.length) return;

  ctx.save();
  for (let i = confetti.length - 1; i >= 0; i--) {
    const c = confetti[i];
    c.x += c.vx;
    c.y += c.vy;
    c.vy += 0.22;
    c.life--;

    const alpha = clamp(c.life / 46, 0, 1);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate((46 - c.life) * 0.2);
    ctx.fillStyle = c.color.replace(")", `, ${alpha})`).replace("rgb", "rgba");
    ctx.globalAlpha = alpha;
    ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.68);
    ctx.restore();

    if (c.life <= 0) confetti.splice(i, 1);
  }
  ctx.restore();
}

function updateAndDrawStars() {
  if (!floatingStars.length) return;

  for (let i = floatingStars.length - 1; i >= 0; i--) {
    const s = floatingStars[i];
    s.y += s.vy;
    s.life--;

    const alpha = clamp(s.life / 32, 0, 1);
    drawStar(s.x, s.y, s.size, alpha);

    if (s.life <= 0) floatingStars.splice(i, 1);
  }
}

function updateAndDrawHomerBursts() {
  if (!homerBursts.length) return;

  ctx.save();
  for (let i = homerBursts.length - 1; i >= 0; i--) {
    const b = homerBursts[i];
    b.radius += 6;
    b.life--;

    const alpha = clamp(b.life / 36, 0, 1);
    ctx.strokeStyle = b.color.replace(")", `, ${alpha})`).replace("rgb", "rgba");
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.stroke();

    if (b.life <= 0) homerBursts.splice(i, 1);
  }
  ctx.restore();
}

function updateAndDrawHomerTrailParticles() {
  if (!homerTrailParticles.length) return;

  ctx.save();
  for (let i = homerTrailParticles.length - 1; i >= 0; i--) {
    const p = homerTrailParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.04;
    p.life--;

    ctx.globalAlpha = clamp(p.life / 24, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    if (p.life <= 0) homerTrailParticles.splice(i, 1);
  }
  ctx.restore();
}

function drawBall() {
  if (!ball) return;

  if (ball.trail?.length) {
    ctx.save();
    for (let i = 1; i < ball.trail.length; i++) {
      const a = ball.trail[i - 1];
      const b = ball.trail[i];
      const alpha = clamp(b.life / 12, 0, 1) * 0.28;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = ball.size * 0.65 * alpha + 1;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(210,0,0,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.size * 0.84, Math.PI * 0.15, Math.PI * 1.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.size * 0.84, Math.PI * 1.15, Math.PI * 2.15);
  ctx.stroke();

  ctx.restore();
}

function drawCenterText(text, y, size = 56, fill = "#ffffff", shadow = "rgba(0,0,0,0.45)") {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `900 ${size}px "Baloo 2", sans-serif`;
  ctx.fillStyle = fill;
  ctx.shadowBlur = 18;
  ctx.shadowColor = shadow;
  ctx.fillText(text, canvas.width / 2, y);
  ctx.restore();
}

function drawHitOverlay() {
  if (hitTextTimer <= 0 || !hitText) return;

  const alpha = clamp(hitTextTimer / (hitText.includes("HOME RUN") ? 160 : 120), 0, 1);
  const color = hitText.includes("HOME RUN") ? "#ffd54f" : hitText.includes("ROCKET") ? "#ff7043" : "#ffffff";

  ctx.save();
  ctx.globalAlpha = alpha;
  drawCenterText(hitText, canvas.height * 0.28, hitText.includes("HOME RUN") ? 72 : 54, color);
  ctx.restore();

  hitTextTimer--;
  if (hitTextTimer <= 0) hitText = "";
}

function drawDistanceOverlay() {
  if (distanceTextTimer <= 0 || !distanceText) return;

  ctx.save();
  ctx.globalAlpha = clamp(distanceTextTimer / 120, 0, 1);
  drawCenterText(distanceText, canvas.height * 0.36, 34, "#dff6ff", "rgba(0,0,0,0.32)");
  ctx.restore();

  distanceTextTimer--;
  if (distanceTextTimer <= 0) distanceText = "";
}

function drawMissOverlay() {
  if (missTextTimer <= 0 || !missText) return;

  ctx.save();
  ctx.globalAlpha = clamp(missTextTimer / 110, 0, 1);
  drawCenterText(missText, canvas.height * 0.28, 48, "#ffb3b3", "rgba(0,0,0,0.4)");
  ctx.restore();

  missTextTimer--;
  if (missTextTimer <= 0) missText = "";
}

function drawCoachOverlay() {
  if (coachTextTimer <= 0 || !coachText) return;

  const w = Math.min(canvas.width * 0.64, 700);
  const h = 56;
  const x = canvas.width / 2 - w / 2;
  const y = canvas.height * 0.82;

  ctx.save();
  ctx.globalAlpha = clamp(coachTextTimer / 120, 0, 1);
  ctx.fillStyle = "rgba(8,18,40,0.78)";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 22);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = '900 20px "Nunito", sans-serif';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(coachText, canvas.width / 2, y + 35);
  ctx.restore();

  coachTextTimer--;
  if (coachTextTimer <= 0) coachText = "";
}

function drawCrowdOverlay() {
  if (crowdTextTimer <= 0 || !crowdText) return;

  ctx.save();
  ctx.globalAlpha = clamp(crowdTextTimer / 120, 0, 1);
  ctx.textAlign = "center";
  ctx.font = '900 26px "Baloo 2", sans-serif';
  ctx.fillStyle = crowdMood === "wild" ? "#ffd54f" : crowdMood === "boo" ? "#ffb3b3" : "#dbeaff";
  ctx.fillText(crowdText, canvas.width / 2, canvas.height * 0.18);
  ctx.restore();

  crowdTextTimer--;
  if (crowdTextTimer <= 0) crowdText = "";
}

function drawStartOverlay() {
  drawCenterText("Raise both hands or press Start", canvas.height * 0.72, 34, "#ffffff");
}

function drawCountdownOverlay() {
  if (!countdownActive) return;
  const text = countdownValue > 0 ? String(countdownValue) : "GO!";
  const color = countdownValue > 1 ? "#ffffff" : countdownValue === 1 ? "#ffd54f" : "#2ed573";
  drawCenterText(text, canvas.height * 0.5, 110, color);
}

function drawPauseOverlay() {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  drawCenterText("Paused", canvas.height * 0.48, 74, "#ffffff");
}

function drawRoundCompleteOverlay() {
  drawCenterText("ROUND COMPLETE!", canvas.height * 0.42, 68, "#ffd54f");
}

function drawSummaryOverlay() {
  if (!roundSummary) return;

  const w = Math.min(canvas.width * 0.72, 760);
  const h = Math.min(canvas.height * 0.56, 420);
  const x = canvas.width / 2 - w / 2;
  const y = canvas.height / 2 - h / 2;

  ctx.save();
  ctx.fillStyle = "rgba(8,18,40,0.86)";
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 28);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 48px "Baloo 2", sans-serif';
  ctx.fillText(roundSummary.title, canvas.width / 2, y + 72);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 28px "Nunito", sans-serif';
  ctx.fillText(roundSummary.message, canvas.width / 2, y + 126);

  ctx.font = '800 22px "Nunito", sans-serif';
  ctx.fillStyle = "#dbeaff";
  ctx.fillText(`Badge: ${roundSummary.badge}`, canvas.width / 2, y + 180);

  ctx.fillStyle = "#ffffff";
  ctx.font = '800 20px "Nunito", sans-serif';
  ctx.fillText(`Hits: ${hits}   •   Home Runs: ${homeRuns}   •   Best Hit: ${Math.round(bestDistanceFt)} FT`, canvas.width / 2, y + 228);

  ctx.fillStyle = "#cfe6ff";
  ctx.font = '800 18px "Nunito", sans-serif';
  wrapCenteredText(roundSummary.tip, canvas.width / 2, y + 286, w - 100, 28);

  ctx.fillStyle = "#ffffff";
  ctx.font = '800 18px "Nunito", sans-serif';
  ctx.fillText("Press Reset to play again", canvas.width / 2, y + h - 34);

  ctx.restore();
}

function wrapCenteredText(text, centerX, startY, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let y = startY;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, centerX, y);
      line = words[i];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) ctx.fillText(line, centerX, y);
}

function drawPitchIconsRow() {
  const total = roundPitches;
  const size = 18;
  const gap = 12;
  const rowWidth = total * size + (total - 1) * gap;
  const startX = canvas.width / 2 - rowWidth / 2;
  const y = canvas.height * 0.12;

  const used = roundPitches - pitchesLeft;

  ctx.save();
  for (let i = 0; i < total; i++) {
    const x = startX + i * (size + gap) + size / 2;
    const filled = i < used;
    const hitIdx = i < hits;
    const missIdx = i >= hits && i < used;

    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);

    if (!filled) {
      ctx.fillStyle = "rgba(255,255,255,0.10)";
    } else if (hitIdx) {
      ctx.fillStyle = "#2ed573";
    } else if (missIdx) {
      ctx.fillStyle = "#ff6b6b";
    } else {
      ctx.fillStyle = "#ffffff";
    }

    ctx.fill();
  }
  ctx.restore();
}

function drawAccuracyMeter() {
  const w = 210;
  const h = 16;
  const x = canvas.width * 0.5 - w / 2;
  const y = canvas.height * 0.92;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 999);
  ctx.fill();

  ctx.fillStyle = "rgba(46,213,115,0.95)";
  ctx.beginPath();
  ctx.roundRect(x + w * 0.42, y, w * 0.16, h, 999);
  ctx.fill();

  ctx.fillStyle = "rgba(255,212,59,0.92)";
  ctx.beginPath();
  ctx.roundRect(x + w * 0.28, y, w * 0.14, h, 999);
  ctx.fill();

  ctx.fillStyle = "rgba(255,112,67,0.92)";
  ctx.beginPath();
  ctx.roundRect(x + w * 0.58, y, w * 0.14, h, 999);
  ctx.fill();

  if (accuracyMarkerTimer > 0) {
    const mx = x + w * lastTimingOffset;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mx, y - 10);
    ctx.lineTo(mx, y + h + 10);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = '900 14px "Nunito", sans-serif';
    ctx.fillText(lastTimingRating, mx, y - 16);
    accuracyMarkerTimer--;
  }

  ctx.restore();
}

function drawSwingPowerMeter() {
  const w = 18;
  const h = 120;
  const x = canvas.width * 0.06;
  const y = canvas.height * 0.55;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 999);
  ctx.fill();

  const fillH = h * clamp(swingPowerPeak, 0, 1);
  const gy = y + h - fillH;
  const grad = ctx.createLinearGradient(0, y + h, 0, gy);
  grad.addColorStop(0, "#2ed573");
  grad.addColorStop(0.5, "#ffd54f");
  grad.addColorStop(1, "#ff7043");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, gy, w, fillH, 999);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 12px "Nunito", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("POWER", x + w / 2, y - 12);
  ctx.restore();
}

function getShakeOffset() {
  if (screenShakeTimer <= 0) return { x: 0, y: 0 };
  screenShakeTimer--;
  return {
    x: (Math.random() - 0.5) * screenShakeAmount,
    y: (Math.random() - 0.5) * screenShakeAmount * 0.7
  };
}

function checkForRaisedHandsStart(points) {
  if (!splashReadyForHands || autoStartTriggered || !points) return;

  const { leftWrist, rightWrist, leftShoulder, rightShoulder, nose } = points;
  if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder || !nose) {
    handRaiseHoldMs = 0;
    return;
  }

  const handsUp = leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y && leftWrist.y < nose.y && rightWrist.y < nose.y;
  const now = performance.now();

  if (!lastRaiseCheckTime) lastRaiseCheckTime = now;
  const dt = now - lastRaiseCheckTime;
  lastRaiseCheckTime = now;

  if (handsUp) {
    handRaiseHoldMs += dt;
    if (instructionChip) instructionChip.textContent = "Hands up detected... starting soon.";

    if (handRaiseHoldMs > 900 && !autoStartTriggered) {
      autoStartTriggered = true;
      startOrResumeGame();
    }
  } else {
    handRaiseHoldMs = 0;
  }
}

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: "user"
    },
    audio: false
  });

  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play().then(resolve).catch(resolve);
    };
  });
}

async function loadModel() {
  const model = poseDetection.SupportedModels.MoveNet;
  detector = await poseDetection.createDetector(model, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
  });
}

function drawMiniMap() {
  if (!miniCtx || !miniMapCanvas) return;

  miniCtx.clearRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);

  miniCtx.fillStyle = "rgba(8,18,40,0.84)";
  miniCtx.fillRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);

  miniCtx.strokeStyle = "rgba(255,255,255,0.12)";
  miniCtx.lineWidth = 2;
  miniCtx.beginPath();
  miniCtx.moveTo(12, miniMapCanvas.height * 0.5);
  miniCtx.lineTo(miniMapCanvas.width - 12, miniMapCanvas.height * 0.5);
  miniCtx.stroke();

  const pitcherX = getPitcherMiniMapX();
  const batterX = getBatterMiniMapX();

  miniCtx.fillStyle = "#ffd54f";
  miniCtx.beginPath();
  miniCtx.arc(pitcherX, 65, 7, 0, Math.PI * 2);
  miniCtx.fill();

  miniCtx.fillStyle = "#25a9ff";
  miniCtx.beginPath();
  miniCtx.arc(batterX, 65, 7, 0, Math.PI * 2);
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
  miniCtx.textAlign = "center";
  miniCtx.fillText("Pitcher", pitcherX, 18);
  miniCtx.fillText("Batter", batterX, 18);
}

function drawBronxGlow() {
  if (bronxGlowTimer <= 0) return;

  const letters = ["B", "R", "O", "N", "X"];
  const baseX = canvas.width * 0.5 - 100;
  const y = canvas.height * 0.12;

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = '900 52px "Baloo 2", sans-serif';

  for (let i = 0; i < letters.length; i++) {
    const active = bronxGlowTimer > 48 - i * 8;

    ctx.fillStyle = active ? "#ffd43b" : "rgba(255,255,255,0.38)";
    ctx.shadowBlur = active ? 20 : 0;
    ctx.shadowColor = "#ffd43b";
    ctx.fillText(letters[i], baseX + i * 50, y);
  }

  ctx.restore();
  bronxGlowTimer--;
}

async function loop() {
  const shake = getShakeOffset();

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(shake.x, shake.y);
  
  updateCameraZoom();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
  
  drawBackground();
  drawMiniMap();
  updateIntroDecor();

  let pose = null;
  if (detector && (gameState === "playing" || gameState === "countdown" || gameState === "start")) {
    const poses = await detector.estimatePoses(video, { flipHorizontal: true });
    pose = poses[0] || null;
  }

  if (pose) {
    const points = drawSilhouetteFigure(pose);

    if (gameState === "start") {
      checkForRaisedHandsStart(points);
    }

    const battingArm = getBattingArm(points);
    if (battingArm) {
      const batTip = drawBatFromSide(battingArm.wrist, battingArm.elbow);
      if (batTip) {
        updateBatVelocity(batTip);
        updateBatTrail(batTip);
        if (gameState === "playing") tryHit(batTip);
      }
    }
  }

  drawAccuracyMeter();
  drawSwingPowerMeter();
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

  drawCoachOverlay();
  drawCrowdOverlay();
  drawBronxGlow();
  tickBatTrail();

  if (gameState === "start") drawStartOverlay();
  if (gameState === "countdown") drawCountdownOverlay();
  if (gameState === "paused") drawPauseOverlay();
  if (gameState === "round_complete") drawRoundCompleteOverlay();
  if (gameState === "summary") drawSummaryOverlay();

  if (gameState === "start") {
    drawIntroBronxShimmer();
    drawIntroTurtleMascot();
  }

  ctx.restore();
  animationId = requestAnimationFrame(loop);
}

function startCountdown() {
  clearCountdownTimer();
  countdownActive = true;
  countdownValue = 5;
  gameState = "countdown";

  if (instructionChip) instructionChip.textContent = "Get set...";
  hideControlsPanel();
  fadeOutIntroMusic(1800);

  const tick = () => {
    if (!countdownActive) return;

    if (countdownValue > 0) {
      playCountdownBeep(countdownValue);
      if (instructionChip) instructionChip.textContent = `Starting in ${countdownValue}...`;
      countdownValue--;
      countdownTimer = setTimeout(tick, 1000);
    } else {
      playGoSound();
      if (instructionChip) instructionChip.textContent = "Let's play ball!";
      coachSay("Let's play ball!", 2000, true);
      countdownActive = false;
      gameState = "playing";
      startAmbientCrowd();

      setTimeout(() => {
        if (gameState === "playing" && !ball) {
          createPitch();
        }
      }, 500);
    }
  };

  tick();
}

async function ensureVisionReady() {
  if (!detector) {
    await setupCamera();
    await loadModel();
  }
}

async function startOrResumeGame() {
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

    introChimePlayed = true;

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

function togglePause() {
  if (gameState === "playing") {
    gameState = "paused";
    if (pauseBtn) pauseBtn.textContent = "Resume";
    clearPitchTimer();
    clearCountdownTimer();
    stopAmbientCrowd();
    showControlsPanel();
    if (instructionChip) instructionChip.textContent = "Game paused.";
    return;
  }

  if (gameState === "countdown") {
    gameState = "paused";
    countdownActive = false;
    clearCountdownTimer();
    stopAmbientCrowd();
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
      startAmbientCrowd();
      if (instructionChip) instructionChip.textContent = "Game resumed.";
      if (!ball) scheduleNextPitch();
      playStartSound();
    }
  }
}

async function resetGame() {
  clearPitchTimer();
  clearCountdownTimer();
  clearSummaryTimer();
  stopAmbientCrowd();

  if (introMusic && !introMusic.paused) {
    introMusic.pause();
    introMusic.currentTime = 0;
  }
  if (homeRunMusic && !homeRunMusic.paused) {
    homeRunMusic.pause();
    homeRunMusic.currentTime = 0;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  introChimePlayed = false;
  turtleEntranceOffset = 180;
  turtleFloatPhase = 0;
  bronxIntroShimmer = 0;
  
  resetRound();
  splashReadyForHands = true;
  gameState = "start";
  showSplashScreen();
  if (pauseBtn) pauseBtn.textContent = "Pause";
  if (instructionChip) instructionChip.textContent = "Press Start or raise both hands to begin.";

  try {
    await ensureVisionReady();
    if (!animationId) loop();
  } catch (err) {
    console.warn("Vision warm reset issue:", err);
  }
}

if (startBtn) startBtn.onclick = startOrResumeGame;
if (splashStartBtn) splashStartBtn.onclick = startOrResumeGame;
if (pauseBtn) pauseBtn.onclick = togglePause;
if (resetBtn) resetBtn.onclick = resetGame;

if (muteBtn) {
  muteBtn.onclick = async () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      initAudio();
      muteBtn.textContent = "Sound: On";
      playStartSound();
    } else {
      muteBtn.textContent = "Sound: Off";
      stopAmbientCrowd();
      if (introMusic && !introMusic.paused) introMusic.pause();
      if (homeRunMusic && !homeRunMusic.paused) homeRunMusic.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    }
  };
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (gameState === "playing" || gameState === "countdown") togglePause();
    else if (gameState === "paused") togglePause();
  }
  if (e.key === "k" || e.key === "K") {
    setArcadeMode("kid");
  }

  if (e.key === "p" || e.key === "P") {
    setArcadeMode("pro");
  }
});

function setBattingSide(side) {
  battingSide = side;
  prevBatPoint = null;
  lastBatTip = null;
  lastBatSegment = null;
  batTrail = [];
  ball = null;

  if (rightHandBtn) rightHandBtn.classList.toggle("active", side === "right");
  if (leftHandBtn) leftHandBtn.classList.toggle("active", side === "left");

  if (instructionChip) {
    instructionChip.textContent = side === "right"
      ? "Right-handed mode: batter on right, pitch comes from left."
      : "Left-handed mode: batter on left, pitch comes from right.";
  }
}

if (rightHandBtn) {
  rightHandBtn.onclick = () => setBattingSide("right");
}

if (leftHandBtn) {
  leftHandBtn.onclick = () => setBattingSide("left");
}

setDifficulty("medium");
setArcadeMode("kid");
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
