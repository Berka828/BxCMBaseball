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
    if (Math.random() > 0.65) tone(90 + Math.random() * 30, 0.18, "sine", 0.008, 0);
  }, 1000);
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
  const diff = batTip.x - ballObj.x;
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

function getFunHitText(resultLabel, distanceFt) {
  if (resultLabel === "HOME RUN!") return `HOME RUN! ${distanceFt} FT`;
  if (distanceFt >= 130) return `ROCKET BALL! ${distanceFt} FT`;
  if (distanceFt >= 95) return `BIG SMASH! ${distanceFt} FT`;
  if (distanceFt >= 70) return `NICE HIT! ${distanceFt} FT`;
  return `${resultLabel} ${distanceFt} FT`;
}

function classifyHit(power, upwardSwing) {
  if (power > 1.9 && upwardSwing > 0.6) return { label: "HOME RUN!", points: 80, confettiCount: 42, launchBoost: 1.28 };
  if (power > 1.5 && upwardSwing > 0.25) return { label: "TRIPLE!", points: 45, confettiCount: 24, launchBoost: 1.02 };
  if (power > 1.08) return { label: "DOUBLE!", points: 28, confettiCount: 16, launchBoost: 0.88 };
  if (power > 0.66) return { label: "SINGLE!", points: 16, confettiCount: 10, launchBoost: 0.72 };
  return { label: "FOUL TIP!", points: 8, confettiCount: 6, launchBoost: 0.54 };
}

function createPitch() {
  if (pitchesLeft <= 0 || gameState !== "playing" || ball) return;

  CONTACT_DISTANCE = DIFFICULTIES[difficulty].contactDistance;
  const scale = DIFFICULTIES[difficulty].ballScale;
  const sliderPitchSpeed = parseFloat(pitchSpeedSlider?.value || String(DIFFICULTIES[difficulty].pitchSpeed));

  ball = {
    x: canvas.width * BALL_SPAWN_X_RATIO,
    y: canvas.height * BALL_LANE_Y + (Math.random() - 0.5) * canvas.height * 0.024,
    vx: -sliderPitchSpeed - Math.random() * 0.45,
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
  if (ball.x < canvas.width * 0.22) return;

  const d = Math.hypot(ball.x - batTip.x, ball.y - batTip.y);
  if (d > CONTACT_DISTANCE) return;
  if (batVelocity.speed < parseFloat(swingThresholdSlider?.value || "420")) return;

  ball.hit = true;

  const timing = getTimingFeedback(batTip, ball);
  let power = clamp(batVelocity.speed / 700, 0.35, 2.1);
  power *= timing.powerBonus;

  const upwardSwing = clamp((-batVelocity.y) / 700, -0.4, 1.0);
  const lateral = batVelocity.x >= 0 ? 1 : -1;
  const result = classifyHit(power, upwardSwing);

  const baseVX = 9 + power * 8;
  const baseVY = -(4 + Math.max(0, upwardSwing) * 7 + power * 2.2);

  ball.vx = lateral * baseVX * result.launchBoost * timing.direction + (Math.random() - 0.5) * 1.2;
  ball.vy = baseVY * result.launchBoost + (Math.random() - 0.5) * 1.0;

  ball.result = result.label;
  ball.contactX = ball.x;
  ball.estimatedDistanceFt = estimateDistanceFt(power, result.label);
  currentDistanceFt = 0;

  score += result.points;
  hits++;
  pitchesLeft--;

  if (result.label === "HOME RUN!") {
    hitText = getFunHitText(result.label, ball.estimatedDistanceFt);
    hitTextTimer = Math.round((HOME_RUN_FEEDBACK_MS + FEEDBACK_FADE_MS) / (1000 / 60));
    timingText = timing.label;
    timingTextTimer = Math.round((HOME_RUN_FEEDBACK_MS + FEEDBACK_FADE_MS) / (1000 / 60));
    distanceText = `${ball.estimatedDistanceFt} FT`;
    distanceTextTimer = Math.round((HOME_RUN_FEEDBACK_MS + FEEDBACK_FADE_MS) / (1000 / 60));
    coachSay("Coach: Boom! That's your power swing!", 3000, true);
    updateCrowdMood("home_run");
  } else if (result.label === "TRIPLE!" || result.label === "DOUBLE!") {
    hitText = getFunHitText(result.label, ball.estimatedDistanceFt);
    hitTextTimer = Math.round((BIG_HIT_FEEDBACK_MS + FEEDBACK_FADE_MS) / (1000 / 60));
    timingText = timing.label;
    timingTextTimer = Math.round((BIG_HIT_FEEDBACK_MS + FEEDBACK_FADE_MS) / (1000 / 60));
    distanceText = `${ball.estimatedDistanceFt} FT`;
    distanceTextTimer = Math.round((BIG_HIT_FEEDBACK_MS + FEEDBACK_FADE_MS) / (1000 / 60));
    coachSay("Coach: Nice barrel. Great contact.", 2600, true);
    updateCrowdMood("big_hit");
  } else {
    hitText = getFunHitText(result.label, ball.estimatedDistanceFt);
    hitTextTimer = Math.round((HIT_FEEDBACK_MS + FEEDBACK_FADE_MS) / (1000 / 60));
    timingText = timing.label;
    timingTextTimer = Math.round((HIT_FEEDBACK_MS + FEEDBACK_FADE_MS) / (1000 / 60));
    distanceText = `${ball.estimatedDistanceFt} FT`;
    distanceTextTimer = Math.round((HIT_FEEDBACK_MS + FEEDBACK_FADE_MS) / (1000 / 60));
    coachSay("Coach: Nice swing. Keep that timing.", 2200, false);
  }

  spawnConfetti(ball.x, ball.y, result.confettiCount);
  spawnStars(ball.x, ball.y, result.label);

  if (result.label === "HOME RUN!") {
    homeRuns++;
    playHomeRunSound();
    playHomeRunMusicBurst();
    triggerHomeRunCelebration(ball.x, ball.y);
    if (instructionChip) instructionChip.textContent = "HOME RUN! That one flew a long way!";
  } else if (result.label === "TRIPLE!" || result.label === "DOUBLE!") {
    playBigHitSound();
    if (instructionChip) instructionChip.textContent = "Big hit! Watch how far it goes!";
  } else {
    playHitSound();
    if (instructionChip) instructionChip.textContent = "Nice contact!";
  }

  bestDistanceFt = Math.max(bestDistanceFt, ball.estimatedDistanceFt);
  updateHud();
}

function resolveMiss() {
  misses++;
  pitchesLeft--;
  ball = null;
  currentDistanceFt = 0;
  updateHud();
  playMissSound();
  updateCrowdMood("miss");

  const missFeedback = getMissFeedback();
  missText = missFeedback;
  missTextTimer = Math.round((MISS_FEEDBACK_MS + FEEDBACK_FADE_MS) / (1000 / 60));

  if (instructionChip) {
    instructionChip.textContent =
      missFeedback === "TOO EARLY" || missFeedback === "TOO LATE"
        ? "Try changing your timing on the next pitch."
        : "Adjust your swing height on the next pitch.";
  }

  if (missFeedback === "TOO EARLY") coachSay("Coach: Start just a little later.", 2600, true);
  if (missFeedback === "TOO LATE") coachSay("Coach: Swing a little sooner.", 2600, true);
  if (missFeedback === "SWING TOO HIGH") coachSay("Coach: Bring the bat down a little.", 2600, true);
  if (missFeedback === "SWING TOO LOW") coachSay("Coach: Lift the bat a little higher.", 2600, true);

  if (pitchesLeft <= 0) {
    pitchTimer = setTimeout(() => endRoundToSummary(), MISS_FEEDBACK_MS + FEEDBACK_FADE_MS + 1200);
  } else {
    pitchTimer = setTimeout(() => scheduleNextPitch(), MISS_FEEDBACK_MS + FEEDBACK_FADE_MS);
  }
}

function resolveFinishedHit() {
  const resultLabel = ball?.result || "";
  const finalDistance = Math.max(currentDistanceFt, ball?.estimatedDistanceFt || 0);

  bestDistanceFt = Math.max(bestDistanceFt, finalDistance);
  updateHud();

  ball = null;
  currentDistanceFt = 0;

  if (instructionChip) instructionChip.textContent = "Nice! Get ready for the next pitch.";

  if (pitchesLeft <= 0) {
    const endDelay =
      resultLabel === "HOME RUN!"
        ? HOME_RUN_FEEDBACK_MS + FEEDBACK_FADE_MS + 1800
        : resultLabel === "TRIPLE!" || resultLabel === "DOUBLE!"
          ? BIG_HIT_FEEDBACK_MS + FEEDBACK_FADE_MS + 1200
          : HIT_FEEDBACK_MS + FEEDBACK_FADE_MS + 900;

    pitchTimer = setTimeout(() => endRoundToSummary(), endDelay);
    return;
  }

  if (resultLabel === "HOME RUN!") {
    schedulePitchAfterFeedback(HOME_RUN_FEEDBACK_MS + FEEDBACK_FADE_MS, 2000);
  } else if (resultLabel === "TRIPLE!" || resultLabel === "DOUBLE!") {
    schedulePitchAfterFeedback(BIG_HIT_FEEDBACK_MS + FEEDBACK_FADE_MS);
  } else {
    schedulePitchAfterFeedback(HIT_FEEDBACK_MS + FEEDBACK_FADE_MS);
  }
}

function spawnHomeRunTrail() {
  if (!ball || ball.result !== "HOME RUN!") return;
  homerTrailParticles.push({
    x: ball.x,
    y: ball.y,
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5,
    life: 18 + Math.random() * 8,
    size: 4 + Math.random() * 5,
    color: ["#ffd54f", "#ffffff", "#42a5f5", "#ff7043"][Math.floor(Math.random() * 4)]
  });
}

function updateBall() {
  if (!ball || !ball.active || gameState !== "playing") return;

  if (!ball.hit) {
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.trail.push({ x: ball.x, y: ball.y, a: 0.16, s: ball.size });
    if (ball.trail.length > 9) ball.trail.shift();

    if (ball.x < canvas.width * BALL_MISS_X_RATIO) resolveMiss();
  } else {
    ball.vy += GRAVITY;
    ball.vx *= 0.992;
    ball.vy *= 0.996;
    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.trail.push({ x: ball.x, y: ball.y, a: 0.24, s: ball.size });
    if (ball.trail.length > 18) ball.trail.shift();

    if (ball.result === "HOME RUN!") {
      spawnHomeRunTrail();
      spawnHomeRunTrail();
    }

    if (ball.y > canvas.height + 60 || ball.x < -90 || ball.x > canvas.width + 90) {
      resolveFinishedHit();
    }
  }
}

function updateDistanceDuringFlight() {
  if (!ball || !ball.hit) return;
  const startX = ball.contactX ?? ball.x;
  const travelPx = Math.abs(ball.x - startX) + Math.abs(ball.y - canvas.height * BALL_LANE_Y) * 0.15;
  currentDistanceFt = Math.min(ball.estimatedDistanceFt || 0, Math.round(travelPx * 0.30));
}

function drawBall() {
  if (!ball || !ball.active) return;

  for (let i = 0; i < ball.trail.length; i++) {
    const p = ball.trail[i];
    const alpha = ((i + 1) / ball.trail.length) * p.a;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(5, (p.s || BALL_RADIUS) * 0.60), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.shadowBlur = ball.result === "HOME RUN!" ? 26 : 18;
  ctx.shadowColor = ball.result === "HOME RUN!" ? "#ffd54f" : "#ffffff";

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.size || BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#cfd8dc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, (ball.size || BALL_RADIUS) - 2, 0.4, 2.4);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, (ball.size || BALL_RADIUS) - 2, 3.6, 5.7);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(
    ball.x - (ball.size || BALL_RADIUS) * 0.28,
    ball.y - (ball.size || BALL_RADIUS) * 0.28,
    (ball.size || BALL_RADIUS) * 0.22,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.restore();
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

  batVelocity = { x: vx, y: vy, speed: Math.hypot(vx, vy) };
  prevBatPoint = { ...point, t: now };

  const power = clamp(batVelocity.speed / 750, 0, 1);
  swingPowerDisplay += (power - swingPowerDisplay) * 0.35;
  swingPowerPeak = Math.max(swingPowerPeak * 0.96, swingPowerDisplay);

  if (power > 0.75 && Math.random() > 0.82 && gameState === "playing") {
    playPowerMeterBlip(power);
  }
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
  swingPowerPeak *= 0.985;
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

function drawSwingPowerMeter() {
  const x = canvas.width - 70;
  const y = canvas.height * 0.22;
  const w = 26;
  const h = 220;
  const bulbR = 18;

  ctx.save();

  ctx.fillStyle = "rgba(10,20,40,0.72)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();

  const fillH = h * clamp(swingPowerPeak, 0, 1);
  const fillY = y + h - fillH;

  const grad = ctx.createLinearGradient(0, y + h, 0, y);
  grad.addColorStop(0, "#2ed573");
  grad.addColorStop(0.5, "#ffd43b");
  grad.addColorStop(1, "#ff7043");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x + 4, fillY, w - 8, fillH, 12);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x + w / 2, y + h + 18, bulbR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 12px "Nunito", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("SWING", x + w / 2, y - 12);
  ctx.fillText("POWER", x + w / 2, y + h + 48);

  ctx.restore();
}

function drawAccuracyMeter() {
  const meterW = 240;
  const meterH = 18;
  const x = canvas.width * 0.5 - meterW / 2;
  const y = canvas.height * 0.08;

  ctx.save();

  ctx.fillStyle = "rgba(10,20,40,0.72)";
  ctx.beginPath();
  ctx.roundRect(x, y, meterW, meterH, 12);
  ctx.fill();

  ctx.fillStyle = "#ff9f1a";
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 4, meterW * 0.38, meterH - 8, 8);
  ctx.fill();

  ctx.fillStyle = "#2ed573";
  ctx.beginPath();
  ctx.roundRect(x + meterW * 0.38, y + 4, meterW * 0.24, meterH - 8, 8);
  ctx.fill();

  ctx.fillStyle = "#ff9f1a";
  ctx.beginPath();
  ctx.roundRect(x + meterW * 0.62, y + 4, meterW * 0.34, meterH - 8, 8);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 12px "Nunito", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("EARLY", x + meterW * 0.18, y - 6);
  ctx.fillText("PERFECT", x + meterW * 0.50, y - 6);
  ctx.fillText("LATE", x + meterW * 0.79, y - 6);

  if (accuracyMarkerTimer > 0) {
    const markerX = clamp(x + meterW * lastTimingOffset, x + 6, x + meterW - 6);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(markerX, y - 4);
    ctx.lineTo(markerX, y + meterH + 4);
    ctx.stroke();

    ctx.fillStyle = lastTimingRating === "PERFECT!" ? "#2ed573" : "#ffffff";
    ctx.font = '900 14px "Baloo 2", sans-serif';
    ctx.fillText(lastTimingRating, x + meterW / 2, y + 38);

    accuracyMarkerTimer--;
  }

  ctx.restore();
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
    drawBaseballIcon(startX + i * gap, y, r, i < pitchesLeft);
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

function getShakeOffset() {
  if (screenShakeTimer <= 0) return { x: 0, y: 0 };
  screenShakeTimer--;
  return {
    x: (Math.random() - 0.5) * screenShakeAmount,
    y: (Math.random() - 0.5) * screenShakeAmount
  };
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
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#14304b";
    ctx.fillStyle = hitText.includes("HOME RUN!") ? "#ffd54f" : "#ffffff";
    ctx.font = '900 56px "Baloo 2", sans-serif';
    ctx.strokeText(hitText, canvas.width / 2, canvas.height * 0.22);
    ctx.fillText(hitText, canvas.width / 2, canvas.height * 0.22);
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
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 60px "Baloo 2", sans-serif';
  ctx.fillText("PRESS START", canvas.width / 2, canvas.height * 0.33);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 28px "Nunito", sans-serif';
  ctx.fillText("Press the button or raise both hands.", canvas.width / 2, canvas.height * 0.41);
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
    ctx.strokeText("LET'S PLAY BALL!", canvas.width / 2, canvas.height * 0.45);
    ctx.fillText("LET'S PLAY BALL!", canvas.width / 2, canvas.height * 0.45);
  }
}

function drawCoachOverlay() {
  if (coachTextTimer <= 0) return;
  const alpha = Math.min(1, coachTextTimer / 20);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(10,18,38,0.78)";
  ctx.beginPath();
  ctx.roundRect(canvas.width * 0.60, canvas.height * 0.12, 300, 56, 18);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 18px "Nunito", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(coachText, canvas.width * 0.60 + 18, canvas.height * 0.12 + 34);
  ctx.restore();

  coachTextTimer--;
}

function drawCrowdOverlay() {
  if (crowdTextTimer <= 0) return;
  const alpha = Math.min(1, crowdTextTimer / 16);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#14304b";
  ctx.fillStyle = crowdMood === "boo" ? "#ff9f1a" : "#ffd43b";
  ctx.font = '900 28px "Baloo 2", sans-serif';
  ctx.strokeText(crowdText, canvas.width * 0.18, canvas.height * 0.20);
  ctx.fillText(crowdText, canvas.width * 0.18, canvas.height * 0.20);
  ctx.restore();

  crowdTextTimer--;
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
  const torsoW = Math.max(44, shoulderWidth * 0.85);
  const torsoH = neck && pelvis ? Math.max(78, Math.hypot(pelvis.x - neck.x, pelvis.y - neck.y) * 1.1) : 120;
  const headR = Math.max(20, Math.min(36, shoulderWidth * 0.36));

  const glowPower = clamp(swingPowerDisplay * 1.5, 0.3, 1.2);

  const headColor = "#a66cff";
  const bodyColor = "#25d9ff";
  const limbColor = "#39ff88";
  const accentColor = "#ffd43b";

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  function glowLine(a, b, width, color) {
    if (!a || !b) return;

    ctx.save();
    ctx.shadowBlur = 30 * glowPower;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.lineWidth = width * 0.5;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function glowCircle(pt, r, color) {
    if (!pt) return;

    ctx.save();
    ctx.shadowBlur = 35 * glowPower;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (nose) glowCircle(nose, headR, headColor);

  if (neck && pelvis) {
    const torsoCenter = { x: (neck.x + pelvis.x) / 2, y: (neck.y + pelvis.y) / 2 };

    ctx.save();
    ctx.translate(torsoCenter.x, torsoCenter.y);
    ctx.shadowBlur = 45 * glowPower;
    ctx.shadowColor = bodyColor;

    const grad = ctx.createLinearGradient(0, -torsoH / 2, 0, torsoH / 2);
    grad.addColorStop(0, "#7cf3ff");
    grad.addColorStop(1, "#0099ff");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-torsoW / 2, -torsoH / 2, torsoW, torsoH, 30);
    ctx.fill();
    ctx.restore();
  }

  glowLine(ls, le, 20, limbColor);
  glowLine(le, lw, 16, limbColor);
  glowLine(rs, re, 20, limbColor);
  glowLine(re, rw, 16, limbColor);

  glowLine(lh, lk, 22, limbColor);
  glowLine(lk, la, 18, limbColor);
  glowLine(rh, rk, 22, limbColor);
  glowLine(rk, ra, 18, limbColor);

  glowCircle(lw, 10, accentColor);
  glowCircle(rw, 10, accentColor);
  glowCircle(la, 8, accentColor);
  glowCircle(ra, 8, accentColor);

  ctx.restore();
  return p;
}

function getBattingArm(points) {
  if (!points) return null;

  if (battingSide === "right") {
    if (points.rightWrist && points.rightElbow) return { wrist: points.rightWrist, elbow: points.rightElbow };
  } else {
    if (points.leftWrist && points.leftElbow) return { wrist: points.leftWrist, elbow: points.leftElbow };
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

function checkForRaisedHandsStart(points) {
  if (!points || !splashReadyForHands || autoStartTriggered || gameState !== "start") return;

  const now = performance.now();
  if (!lastRaiseCheckTime) lastRaiseCheckTime = now;
  const dt = now - lastRaiseCheckTime;
  lastRaiseCheckTime = now;

  const rightRaised = points.rightWrist && points.rightShoulder && points.rightWrist.y < points.rightShoulder.y - 18;
  const leftRaised = points.leftWrist && points.leftShoulder && points.leftWrist.y < points.leftShoulder.y - 18;
  const bothRaised = rightRaised && leftRaised;

  if (bothRaised) {
    handRaiseHoldMs += dt;
    if (instructionChip) instructionChip.textContent = "Raise both hands to start!";
  } else {
    handRaiseHoldMs = 0;
  }

  if (handRaiseHoldMs > 950) {
    autoStartTriggered = true;
    handRaiseHoldMs = 0;
    startOrResumeGame();
  }
}

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

function drawMiniMap() {
  if (!miniMapCanvas || !miniCtx) return;

  miniCtx.clearRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);
  miniCtx.fillStyle = "#0b2343";
  miniCtx.fillRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);

  miniCtx.strokeStyle = "rgba(255,255,255,0.18)";
  miniCtx.lineWidth = 2;
  miniCtx.strokeRect(1, 1, miniMapCanvas.width - 2, miniMapCanvas.height - 2);

  miniCtx.fillStyle = "rgba(255,255,255,0.06)";
  miniCtx.fillRect(14, 50, miniMapCanvas.width - 28, 30);

  miniCtx.strokeStyle = "rgba(255,255,255,0.30)";
  miniCtx.lineWidth = 4;
  miniCtx.beginPath();
  miniCtx.moveTo(miniMapCanvas.width - 16, 65);
  miniCtx.lineTo(20, 65);
  miniCtx.stroke();

  miniCtx.fillStyle = "#ffd54f";
  miniCtx.beginPath();
  miniCtx.arc(miniMapCanvas.width - 16, 65, 7, 0, Math.PI * 2);
  miniCtx.fill();

  miniCtx.fillStyle = "#25a9ff";
  miniCtx.beginPath();
  miniCtx.arc(28, 65, 7, 0, Math.PI * 2);
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
  miniCtx.fillText("Pitcher", miniMapCanvas.width - 58, 18);
  miniCtx.fillText("Batter", 12, 18);
}

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
  tickBatTrail();

  if (gameState === "start") drawStartOverlay();
  if (gameState === "countdown") drawCountdownOverlay();
  if (gameState === "paused") drawPauseOverlay();
  if (gameState === "round_complete") drawRoundCompleteOverlay();
  if (gameState === "summary") drawSummaryOverlay();

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
      createPitch();
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
});

if (rightHandBtn) {
  rightHandBtn.onclick = () => {
    battingSide = "right";
    prevBatPoint = null;
    rightHandBtn.classList.add("active");
    leftHandBtn.classList.remove("active");
  };
}

if (leftHandBtn) {
  leftHandBtn.onclick = () => {
    battingSide = "left";
    prevBatPoint = null;
    leftHandBtn.classList.add("active");
    rightHandBtn.classList.remove("active");
  };
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
