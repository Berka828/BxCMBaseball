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
const rightPanel = document.querySelector(".rightPanel");

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
let timingText = "";
let timingTextTimer = 0;

let confetti = [];
let floatingStars = [];
let homerBursts = [];
let homerTrailParticles = [];
let batTrail = [];

let pitchTimer = null;
let countdownTimer = null;
let countdownActive = false;
let countdownValue = 5;

let screenShakeTimer = 0;
let screenShakeAmount = 0;

// ===============================
// SIMPLE BACKGROUND ONLY
// ===============================
function drawBackground() {
  ctx.fillStyle = "#0b1f3a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ===============================
// REST OF YOUR GAME (UNCHANGED)
// ===============================

const BALL_RADIUS = 14;
const GRAVITY = 0.44;
const CONTACT_DISTANCE = 68;
const BAT_LENGTH = 132;

const SKELETON_SCALE = 0.68;
const SKELETON_OFFSET_Y = 360;
const SKELETON_OFFSET_X = -300;

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

// ---------- CAMERA ----------
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false
  });

  video.srcObject = stream;
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

// ---------- BALL ----------
function createPitch() {
  if (pitchesLeft <= 0 || ball) return;

  ball = {
    x: canvas.width + 30,
    y: canvas.height * 0.6,
    vx: -10,
    vy: 0,
    hit: false,
    active: true
  };
}

function updateBall() {
  if (!ball) return;

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < -40) {
    ball = null;
    misses++;
  }
}

function drawBall() {
  if (!ball) return;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- BAT ----------
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

  ctx.strokeStyle = "#ffca28";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(batTip.x, batTip.y);
  ctx.stroke();

  return batTip;
}

// ---------- LOOP ----------
async function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();

  let pose = null;

  if (detector) {
    const poses = await detector.estimatePoses(video, { flipHorizontal: true });
    pose = poses[0] || null;
  }

  if (pose) {
    const wrist = getKeypoint(pose, "right_wrist");
    const elbow = getKeypoint(pose, "right_elbow");

    if (wrist && elbow) {
      drawBatFromSide(wrist, elbow);
    }
  }

  updateBall();
  drawBall();

  requestAnimationFrame(loop);
}

// ---------- START ----------
startBtn.onclick = async () => {
  if (!detector) {
    await setupCamera();
    await loadModel();
  }
  createPitch();
  loop();
};

resizeCanvas();
