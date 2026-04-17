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
  kid: { contactBoost: 1.18, powerBoost: 1.10, gravityBoost: 0.92, label: "KID MODE" },
  pro: { contactBoost: 0.96, powerBoost: 1.00, gravityBoost: 1.06, label: "PRO MODE" }
};

let difficulty = "medium";
let detector = null;
let animationId = null;
let gameState = "start";
let battingSide = "right";
let startInProgress = false;

let score = 0, hits = 0, misses = 0, homeRuns = 0, pitchesLeft = 10;
const roundPitches = 10;

let bestDistanceFt = 0, currentDistanceFt = 0;
let prevBatPoint = null, batVelocity = { x: 0, y: 0, speed: 0 };
let lastBatTip = null, lastBatSegment = null, ball = null;

let hitText = "", hitTextTimer = 0, flashTimer = 0;
let timingText = "", timingTextTimer = 0, distanceText = "", distanceTextTimer = 0;
let missText = "", missTextTimer = 0;

let confetti = [], floatingStars = [], homerBursts = [], homerTrailParticles = [], batTrail = [];
let pitchTimer = null, countdownTimer = null, summaryTimer = null;
let countdownActive = false, countdownValue = 5;

// Corrected Turtle Filename
let turtleImg = new Image();
turtleImg.src = "./happy-turtle-cartoon-generated-by-ai_942243-2745.png"; 

let bronxGlowTimer = 0, introChimePlayed = false;
let turtleEntranceOffset = 180, turtleFloatPhase = 0, bronxIntroShimmer = 0;
let roundSummary = null, showRoundComplete = false, roundCompleteTimer = 0;
let screenShakeTimer = 0, screenShakeAmount = 0;
let lastTimingOffset = 0.5, lastTimingRating = "", accuracyMarkerTimer = 0;
let coachText = "", coachTextTimer = 0, crowdText = "", crowdTextTimer = 0, crowdMood = "quiet";
let swingPowerDisplay = 0, swingPowerPeak = 0, arcadeMode = "kid";
let splashReadyForHands = false, handRaiseHoldMs = 0, lastRaiseCheckTime = 0, autoStartTriggered = false;

const BALL_RADIUS = 14, GRAVITY = 0.44;
let CONTACT_DISTANCE = DIFFICULTIES[difficulty].contactDistance;
const BAT_LENGTH = 150, PLAYER_SCALE = 0.34, PLAYER_FLOOR_Y = 0.89, BALL_LANE_Y = 0.66;
const BALL_SPAWN_X_RATIO = 0.965, BALL_MISS_X_RATIO = 0.12, BG_ZOOM = 0.86;
const HIT_FEEDBACK_MS = 3800, BIG_HIT_FEEDBACK_MS = 4400, HOME_RUN_FEEDBACK_MS = 5200;
const MISS_FEEDBACK_MS = 3400, FEEDBACK_FADE_MS = 800, ROUND_COMPLETE_MS = 2200;

const TIPS = ["Strong swings send it farther.", "Timing helps power.", "Smooth swings create distance.", "Watch the ball in.", "Launch high!"];
let tipIndex = 0;

const stadiumBg = new Image();
let stadiumBgLoaded = false;
stadiumBg.onload = () => { stadiumBgLoaded = true; };
stadiumBg.src = "./stadium-bg.png";

let audioCtx = null, soundEnabled = true, introMusic = null, introMusicStarted = false;
let ambientMasterGain = null, ambientRunning = false, cameraZoom = 1, targetCameraZoom = 1;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function transformPoseToBattingPosition(rawPoints) {
  const bounds = getPoseBounds(rawPoints);
  if (!bounds) return rawPoints;
  const targetHeight = canvas.height * PLAYER_SCALE;
  const scale = targetHeight / Math.max(bounds.height, 1);
  const scaled = {};
  for (const [key, value] of Object.entries(rawPoints)) {
    scaled[key] = value ? { x: ((bounds.maxX - value.x) + bounds.minX) * scale, y: value.y * scale } : null;
  }
  const scaledBounds = getPoseBounds(scaled);
  const targetX = (battingSide === "right") ? canvas.width * 0.15 : canvas.width * 0.75;
  const offsetX = targetX - scaledBounds.minX;
  const offsetY = (canvas.height * PLAYER_FLOOR_Y) - scaledBounds.maxY;
  for (const key of Object.keys(scaled)) { if (scaled[key]) { scaled[key].x += offsetX; scaled[key].y += offsetY; } }
  return scaled;
}

function createPitch() {
  if (pitchesLeft <= 0 || gameState !== "playing" || ball) return;
  const isRighty = (battingSide === "right");
  const speed = parseFloat(pitchSpeedSlider.value);
  ball = {
    x: isRighty ? canvas.width * 0.965 : canvas.width * 0.035,
    y: canvas.height * BALL_LANE_Y + (Math.random() - 0.5) * canvas.height * 0.024,
    vx: isRighty ? -speed : speed,
    vy: (Math.random() - 0.5) * 0.08,
    size: BALL_RADIUS * DIFFICULTIES[difficulty].ballScale,
    hit: false, active: true, trail: []
  };
  playPitchSound();
}

function updateBall() {
  if (!ball || !ball.active || gameState !== "playing") return;
  if (!ball.hit) {
    ball.x += ball.vx; ball.y += ball.vy;
    ball.trail.push({ x: ball.x, y: ball.y, a: 0.16 });
    if (ball.trail.length > 9) ball.trail.shift();
    const isRighty = (battingSide === "right");
    const missed = isRighty ? ball.x < canvas.width * BALL_MISS_X_RATIO : ball.x > canvas.width * (1 - BALL_MISS_X_RATIO);
    if (missed) resolveMiss();
  } else {
    ball.vy += GRAVITY * (ball.gravityScale || 1);
    ball.x += ball.vx * 0.99; ball.y += ball.vy * 0.99;
    if (ball.y > canvas.height + 60 || ball.x < -90 || ball.x > canvas.width + 90) resolveFinishedHit();
  }
}

function drawMiniMap() {
  if (!miniCtx) return;
  const isRighty = (battingSide === "right");
  miniCtx.fillStyle = "#0b2343"; miniCtx.fillRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);
  const batX = isRighty ? 35 : miniMapCanvas.width - 35;
  const pitX = isRighty ? miniMapCanvas.width - 35 : 35;
  miniCtx.fillStyle = "#25a9ff"; miniCtx.beginPath(); miniCtx.arc(batX, 65, 7, 0, Math.PI * 2); miniCtx.fill();
  miniCtx.fillStyle = "#ffd54f"; miniCtx.beginPath(); miniCtx.arc(pitX, 65, 7, 0, Math.PI * 2); miniCtx.fill();
  if (ball) {
    const bx = clamp((ball.x / canvas.width) * miniMapCanvas.width, 10, miniMapCanvas.width - 10);
    miniCtx.fillStyle = "#fff"; miniCtx.beginPath(); miniCtx.arc(bx, 65, 6, 0, Math.PI * 2); miniCtx.fill();
  }
}

// REST OF HELPER FUNCTIONS (tone, noiseBurst, drawBackground, loop, start/pause logic)...
// Ensure setupCamera is called inside startOrResumeGame

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
  video.srcObject = stream;
  await video.play();
  resizeCanvas();
}

async function startOrResumeGame() {
  if (startInProgress) return;
  startInProgress = true;
  try {
    initAudio();
    await setupCamera();
    await loadModel();
    hideSplashScreen();
    resetRound();
    startCountdown();
    if (!animationId) loop();
  } catch (err) { alert("Camera Start failed."); }
  finally { startInProgress = false; }
}

// Boilerplate listeners
startBtn.onclick = startOrResumeGame;
splashStartBtn.onclick = startOrResumeGame;
resetBtn.onclick = resetGame;

// Load Pose Model
async function loadModel() {
  await tf.ready();
  detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet);
}

// Start visual loop
loop();
