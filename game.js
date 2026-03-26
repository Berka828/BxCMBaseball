const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const miniMapCanvas = document.getElementById("miniMapCanvas");
const miniCtx = miniMapCanvas.getContext("2d");

const homeRunsEl = document.getElementById("homeRunsEl");
const bestHitEl = document.getElementById("bestHitEl");

const splashScreen = document.getElementById("splashScreen");
const splashStartBtn = document.getElementById("splashStartBtn");

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

// --- MINIMALIST SAFETY CHECKS ---
// These prevent the "Cannot set properties of null" error seen in your screenshot
const pitchSpeedSlider = document.getElementById("pitchSpeed");
const swingThresholdSlider = document.getElementById("swingThreshold");
const pitchDelaySlider = document.getElementById("pitchDelay");

const pitchSpeedVal = document.getElementById("pitchSpeedVal");
const swingThresholdVal = document.getElementById("swingThresholdVal");
const pitchDelayVal = document.getElementById("pitchDelayVal");

if (pitchSpeedSlider && pitchSpeedVal) {
    pitchSpeedSlider.oninput = () => pitchSpeedVal.textContent = pitchSpeedSlider.value;
}
if (swingThresholdSlider && swingThresholdVal) {
    swingThresholdSlider.oninput = () => swingThresholdVal.textContent = swingThresholdSlider.value;
}
if (pitchDelaySlider && pitchDelayVal) {
    pitchDelaySlider.oninput = () => pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;
}

// Default values if sliders are missing from the UI
const getPitchSpeed = () => pitchSpeedSlider ? parseFloat(pitchSpeedSlider.value) : 12;
const getSwingThreshold = () => swingThresholdSlider ? parseFloat(swingThresholdSlider.value) : 400;
const getPitchDelay = () => pitchDelaySlider ? parseFloat(pitchDelaySlider.value) : 2.5;

let detector = null;
let animationId = null;
let gameState = "start"; 
let battingSide = "right";

let introMusic = null;
let introMusicStarted = false;

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
let homeRuns = 0;

let handRaiseHoldMs = 0;
let lastRaiseCheckTime = 0;
let autoStartTriggered = false;

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

let bgTick = 0;
let stadiumBg = new Image();
let stadiumBgLoaded = false;

stadiumBg.onload = () => { stadiumBgLoaded = true; };
stadiumBg.src = "./stadium-bg.png"; // Ensure this filename is exact!

const BALL_RADIUS = 14;
const GRAVITY = 0.44;
const CONTACT_DISTANCE = 75;
const BAT_LENGTH = 140;

const SKELETON_SCALE = 0.7;
const SKELETON_OFFSET_Y = 120;
const SKELETON_OFFSET_X = -300;

// ---------- AUDIO ----------
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) audioCtx = new AudioCtx();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

function tone(freq, duration, type = "sine", gainValue = 0.1, startTime = 0) {
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
  osc.stop(now + duration + 0.05);
}

// SFX
function playStartSound() { tone(523, 0.1, "triangle", 0.1, 0); tone(659, 0.1, "triangle", 0.1, 0.08); }
function playPitchSound() { tone(200, 0.1, "sawtooth", 0.05); }
function playMissSound() { tone(150, 0.2, "square", 0.05); }
function playGoSound() { tone(880, 0.1, "triangle", 0.1); }

// ---------- LOGIC ----------
function hideSplashScreen() { if (splashScreen) splashScreen.classList.add("hidden"); }

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: 1280, height: 720 }, audio: false
  });
  video.srcObject = stream;
  await new Promise(res => video.onloadedmetadata = res);
  await video.play();
}

async function loadModel() {
  await tf.ready();
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );
}

function createPitch() {
  if (pitchesLeft <= 0 || ball) return;
  ball = { 
    x: canvas.width + 30, 
    y: canvas.height * 0.65, 
    vx: -getPitchSpeed(), 
    vy: (Math.random() - 0.5) * 0.5, 
    hit: false, active: true, trail: [] 
  };
  playPitchSound();
}

async function startOrResumeGame() {
  hideSplashScreen();
  if (instructionChip) instructionChip.textContent = "Starting Camera...";
  
  try {
    initAudio();
    if (!detector) {
      await setupCamera();
      await loadModel();
    }
    
    if (gameState === "paused") {
      gameState = "playing";
    } else {
      resetRound();
      startCountdown();
    }
    if (!animationId) loop();
  } catch (e) {
    console.error(e);
    alert("Camera failed. Check permissions.");
  }
}

function startCountdown() {
  gameState = "countdown";
  countdownValue = 3;
  const tick = () => {
    if (countdownValue > 0) {
      countdownValue--;
      setTimeout(tick, 1000);
    } else {
      playGoSound();
      gameState = "playing";
      createPitch();
    }
  };
  tick();
}

function resetRound() {
  score = 0; hits = 0; misses = 0; homeRuns = 0; pitchesLeft = 10;
  ball = null; gameState = "playing";
  updateHud();
}

function updateHud() {
  if (scoreEl) scoreEl.textContent = score;
  if (pitchesEl) pitchesEl.textContent = pitchesLeft;
  if (hitsEl) hitsEl.textContent = hits;
  if (homeRunsEl) homeRunsEl.textContent = homeRuns;
}

// --- SIMPLIFIED DRAWING ---
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Background
  if (stadiumBgLoaded) ctx.drawImage(stadiumBg, 0, 0, canvas.width, canvas.height);
  else { ctx.fillStyle = "#121212"; ctx.fillRect(0, 0, canvas.width, canvas.height); }

  // Game Logic Here (Pose + Ball)
  if (gameState === "playing") {
      if (ball) {
          ball.x += ball.vx;
          ctx.fillStyle = "white";
          ctx.beginPath(); ctx.arc(ball.x, ball.y, 10, 0, Math.PI*2); ctx.fill();
          if (ball.x < -20) { ball = null; misses++; pitchesLeft--; updateHud(); setTimeout(createPitch, 1500); }
      }
  }

  animationId = requestAnimationFrame(loop);
}

// --- INITIALIZE BUTTONS ---
if (splashStartBtn) splashStartBtn.onclick = startOrResumeGame;
if (startBtn) startBtn.onclick = startOrResumeGame;
if (pauseBtn) pauseBtn.onclick = () => { gameState = gameState === "playing" ? "paused" : "playing"; };

updateHud();
