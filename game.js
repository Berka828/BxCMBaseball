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
let gameState = "start"; // start | countdown | playing | paused | end
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
stadiumBg.onerror = () => { console.error("Background image failed to load."); };
stadiumBg.src = "./stadium-bg.png";

const BALL_RADIUS = 14;
const GRAVITY = 0.44;
const CONTACT_DISTANCE = 68;
const BAT_LENGTH = 132;

const SKELETON_SCALE = 0.68;
const SKELETON_OFFSET_Y = 125;
const SKELETON_OFFSET_X = -300;

// ---------- AUDIO ----------
let audioCtx = null;
let soundEnabled = true;

function setupIntroMusic() {
  if (introMusic) return;
  introMusic = new Audio("./intro-theme.mp3");
  introMusic.loop = false;
  introMusic.volume = 0.45;
  introMusic.preload = "auto";
}

async function playIntroMusic() {
  try {
    setupIntroMusic();
    if (!introMusic) return;
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
  const startVolume = introMusic.volume;
  const steps = 24;
  const stepTime = duration / steps;
  let currentStep = 0;
  const fadeTimer = setInterval(() => {
    currentStep++;
    const t = currentStep / steps;
    introMusic.volume = Math.max(0, startVolume * (1 - t));
    if (currentStep >= steps) {
      clearInterval(fadeTimer);
      introMusic.pause();
      introMusic.currentTime = 0;
      introMusic.volume = 0.45;
    }
  }, stepTime);
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

function playStartSound() { tone(523.25, 0.10, "triangle", 0.14, 0); tone(659.25, 0.12, "triangle", 0.14, 0.08); tone(783.99, 0.16, "triangle", 0.14, 0.16); }
function playPitchSound() { tone(240, 0.08, "sawtooth", 0.09, 0); tone(180, 0.08, "sawtooth", 0.07, 0.05); }
function playMissSound() { tone(220, 0.08, "square", 0.08, 0); tone(170, 0.10, "square", 0.06, 0.06); }
function playHomeRunSound() { tone(392, 0.10, "triangle", 0.14, 0); tone(523.25, 0.10, "triangle", 0.14, 0.08); tone(659.25, 0.12, "triangle", 0.14, 0.16); tone(783.99, 0.18, "triangle", 0.14, 0.26); tone(1046.5, 0.20, "triangle", 0.12, 0.42); }
function playCountdownBeep(num) { const f = num > 1 ? 660 : 880; tone(f, 0.10, "triangle", 0.11, 0); }
function playGoSound() { tone(880, 0.08, "triangle", 0.12, 0); tone(1174.66, 0.12, "triangle", 0.12, 0.08); }

// ---------- HELPERS ----------
function checkForRaisedHandStart(points) {
  if (!points || autoStartTriggered) return;
  const now = performance.now();
  if (!lastRaiseCheckTime) lastRaiseCheckTime = now;
  const dt = now - lastRaiseCheckTime;
  lastRaiseCheckTime = now;
  const rightRaised = points.rightWrist && points.rightShoulder && points.rightWrist.y < points.rightShoulder.y - 20;
  const leftRaised = points.leftWrist && points.leftShoulder && points.leftWrist.y < points.leftShoulder.y - 20;
  const raised = rightRaised || leftRaised;
  if (raised) {
    handRaiseHoldMs += dt;
    instructionChip.textContent = "Hold still to start...";
  } else {
    handRaiseHoldMs = 0;
  }
  if (handRaiseHoldMs >= 800) {
    autoStartTriggered = true;
    handRaiseHoldMs = 0;
    startOrResumeGame();
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function getKeypoint(pose, name, minScore = 0.28) { return pose?.keypoints?.find(k => k.name === name && (k.score ?? 0) > minScore) || null; }

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
  if (veloEl) veloEl.textContent = Math.round(bestExitVelo);
  if (homeRunsEl) homeRunsEl.textContent = homeRuns;
  if (bestHitEl) bestHitEl.textContent = Math.round(bestExitVelo);
}

function hideSplashScreen() { if (splashScreen) splashScreen.classList.add("hidden"); }
function clearPitchTimer() { if (pitchTimer) { clearTimeout(pitchTimer); pitchTimer = null; } }
function clearCountdownTimer() { if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null; } }
function showControlsPanel() { if (rightPanel) { rightPanel.style.opacity = "1"; rightPanel.style.pointerEvents = "auto"; } }
function hideControlsPanel() { if (rightPanel) { rightPanel.style.opacity = "0.08"; rightPanel.style.pointerEvents = "none"; } }

function scheduleNextPitch() {
  clearPitchTimer();
  if (pitchesLeft <= 0 || gameState !== "playing") return;
  const delayMs = Math.round(parseFloat(pitchDelaySlider.value) * 1000);
  instructionChip.textContent = "Get ready...";
  pitchTimer = setTimeout(() => {
    if (gameState === "playing" && !ball) {
      createPitch();
      instructionChip.textContent = "Swing!";
    }
  }, delayMs);
}

function resetRound() {
  clearPitchTimer(); clearCountdownTimer();
  score = 0; hits = 0; misses = 0; bestExitVelo = 0; homeRuns = 0;
  handRaiseHoldMs = 0; lastRaiseCheckTime = 0; autoStartTriggered = false;
  pitchesLeft = roundPitches;
  prevBatPoint = null; batVelocity = { x: 0, y: 0, speed: 0 };
  ball = null; hitText = ""; hitTextTimer = 0; timingText = ""; timingTextTimer = 0;
  flashTimer = 0; confetti = []; floatingStars = []; homerBursts = []; homerTrailParticles = []; batTrail = [];
  screenShakeTimer = 0; screenShakeAmount = 0; countdownActive = false; countdownValue = 5;
  updateHud();
}

// ---------- CAMERA / MODEL ----------
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  });
  video.srcObject = stream;
  await new Promise(resolve => video.onloadedmetadata = () => resolve());
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

// ---------- DRAWING & LOGIC ----------
function drawBackground() {
  if (!stadiumBgLoaded) {
    ctx.fillStyle = "#1e2f4d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.drawImage(stadiumBg, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

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
  return { x: valid.reduce((s, p) => s + p.x, 0) / valid.length, y: valid.reduce((s, p) => s + p.y, 0) / valid.length };
}

function getTimingFeedback(batTip, ballObj) {
  const diff = batTip.x - ballObj.x;
  if (Math.abs(diff) < 25) return { label: "PERFECT!", powerBonus: 1.15, direction: 1 };
  if (diff < -25) return { label: "TOO EARLY", powerBonus: 0.85, direction: 1.2 };
  return { label: "TOO LATE", powerBonus: 0.85, direction: 0.8 };
}

function drawStickFigure(pose) {
  const keys = ["left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle", "nose"];
  let points = {};
  keys.forEach(k => points[k] = getKeypoint(pose, k));
  const center = getPoseCenter(Object.values(points));
  if (!center) return { rw: null, re: null, lw: null, le: null };

  const scaled = {};
  keys.forEach(k => scaled[k] = scalePoint(points[k], center, SKELETON_SCALE));

  ctx.strokeStyle = "#58e1ff";
  ctx.lineWidth = 6;
  const drawB = (a, b) => { if (scaled[a] && scaled[b]) { ctx.beginPath(); ctx.moveTo(scaled[a].x, scaled[a].y); ctx.lineTo(scaled[b].x, scaled[b].y); ctx.stroke(); } };
  drawB("left_shoulder", "left_elbow"); drawB("left_elbow", "left_wrist");
  drawB("right_shoulder", "right_elbow"); drawB("right_elbow", "right_wrist");
  
  return { rw: scaled.right_wrist, re: scaled.right_elbow, lw: scaled.left_wrist, le: scaled.left_elbow };
}

function getBattingArm(points) {
  if (battingSide === "right") return (points.rw && points.re) ? { wrist: points.rw, elbow: points.re } : null;
  return (points.lw && points.le) ? { wrist: points.lw, elbow: points.le } : null;
}

function drawBatFromSide(wrist, elbow) {
  if (!wrist || !elbow) return null;
  const dx = wrist.x - elbow.x; const dy = wrist.y - elbow.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len; const ny = dy / len;
  const batTip = { x: wrist.x + nx * BAT_LENGTH, y: wrist.y + ny * BAT_LENGTH };
  ctx.strokeStyle = "#ffca28"; ctx.lineWidth = 12; ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y); ctx.lineTo(batTip.x, batTip.y); ctx.stroke();
  return batTip;
}

function updateBatVelocity(point) {
  const now = performance.now();
  if (!prevBatPoint) { prevBatPoint = { ...point, t: now }; return; }
  const dt = Math.max((now - prevBatPoint.t) / 1000, 0.001);
  batVelocity = { x: (point.x - prevBatPoint.x) / dt, y: (point.y - prevBatPoint.y) / dt, speed: Math.hypot((point.x - prevBatPoint.x) / dt, (point.y - prevBatPoint.y) / dt) };
  prevBatPoint = { ...point, t: now };
}

function createPitch() {
  if (pitchesLeft <= 0 || gameState !== "playing" || ball) return;
  ball = { x: canvas.width + 30, y: canvas.height * (0.62 + Math.random() * 0.06), vx: -parseFloat(pitchSpeedSlider.value), vy: (Math.random() - 0.5) * 0.18, hit: false, active: true, trail: [], result: "" };
  playPitchSound();
}

function tryHit(batTip) {
  if (!ball || !ball.active || ball.hit) return;
  const d = Math.hypot(ball.x - batTip.x, ball.y - batTip.y);
  if (d > CONTACT_DISTANCE || batVelocity.speed < parseFloat(swingThresholdSlider.value)) return;
  ball.hit = true;
  const timing = getTimingFeedback(batTip, ball);
  let power = clamp(batVelocity.speed / 700, 0.35, 2.1) * timing.powerBonus;
  const upwardSwing = clamp((-batVelocity.y) / 700, -0.4, 1.0);
  ball.vx = (battingSide === "right" ? 1 : -1) * (9 + power * 8) * timing.direction;
  ball.vy = -(4 + Math.max(0, upwardSwing) * 7 + power * 2.2);
  if (power > 1.8) { ball.result = "HOME RUN!"; homeRuns++; triggerHomeRunCelebration(ball.x, ball.y); playHomeRunSound(); }
  else { ball.result = "HIT!"; hits++; }
  score += Math.round(power * 20); bestExitVelo = Math.max(bestExitVelo, power * 100); pitchesLeft--;
  showHitText(ball.result); updateHud();
}

function triggerHomeRunCelebration(x, y) { screenShakeTimer = 20; flashTimer = 10; }
function showHitText(text) { hitText = text; hitTextTimer = 40; }

function updateBall() {
  if (!ball) return;
  ball.x += ball.vx; ball.y += ball.vy;
  if (ball.hit) ball.vy += GRAVITY;
  if (ball.x < -50 || ball.y > canvas.height + 50 || ball.x > canvas.width + 100) {
    if (!ball.hit) { misses++; pitchesLeft--; playMissSound(); }
    ball = null; updateHud(); scheduleNextPitch();
  }
}

function drawBall() {
  if (!ball) return;
  ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2); ctx.fill();
}

function drawMiniMap() {
  miniCtx.fillStyle = "#0b2343"; miniCtx.fillRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);
  if (ball) {
    const bx = (ball.x / canvas.width) * miniMapCanvas.width;
    const by = (ball.y / canvas.height) * miniMapCanvas.height;
    miniCtx.fillStyle = "white"; miniCtx.beginPath(); miniCtx.arc(bx, by, 4, 0, Math.PI * 2); miniCtx.fill();
  }
}

// ---------- CORE LOOP ----------
async function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawMiniMap();
  
  let pose = null;
  if (detector && (gameState === "start" || gameState === "playing" || gameState === "countdown")) {
    const poses = await detector.estimatePoses(video, { flipHorizontal: true });
    pose = poses[0] || null;
  }

  if (pose) {
    const points = drawStickFigure(pose);
    if (gameState === "start") checkForRaisedHandStart(points);
    const arm = getBattingArm(points);
    if (arm) {
      const batTip = drawBatFromSide(arm.wrist, arm.elbow);
      if (batTip) { updateBatVelocity(batTip); if (gameState === "playing") tryHit(batTip); }
    }
  }

  if (gameState === "playing") updateBall();
  drawBall();

  if (hitTextTimer > 0) {
    ctx.fillStyle = "yellow"; ctx.font = "bold 60px Arial"; ctx.textAlign = "center";
    ctx.fillText(hitText, canvas.width / 2, canvas.height / 2); hitTextTimer--;
  }

  if (gameState === "countdown") {
    ctx.fillStyle = "white"; ctx.font = "bold 100px Arial"; ctx.textAlign = "center";
    ctx.fillText(countdownValue || "GO!", canvas.width / 2, canvas.height / 2);
  }

  animationId = requestAnimationFrame(loop);
}

// ---------- GAME FLOW ----------
async function startOrResumeGame() {
  hideSplashScreen();
  instructionChip.textContent = "Loading camera and model...";
  try {
    initAudio();
    if (!detector) {
      await setupCamera();
      await loadModel();
    }
    if (gameState === "paused") { gameState = "playing"; hideControlsPanel(); }
    else { resetRound(); startCountdown(); }
    if (!animationId) loop();
  } catch (err) { console.error(err); alert("Failed to start."); }
}

function startCountdown() {
  gameState = "countdown"; countdownValue = 3;
  const tick = () => {
    if (countdownValue > 0) { playCountdownBeep(countdownValue); countdownValue--; countdownTimer = setTimeout(tick, 1000); }
    else { playGoSound(); gameState = "playing"; scheduleNextPitch(); }
  };
  tick();
}

function togglePause() {
  if (gameState === "playing") { gameState = "paused"; clearPitchTimer(); showControlsPanel(); pauseBtn.textContent = "Resume"; }
  else if (gameState === "paused") { gameState = "playing"; hideControlsPanel(); scheduleNextPitch(); pauseBtn.textContent = "Pause"; }
}

// ---------- LISTENERS ----------
startBtn.onclick = startOrResumeGame;
if (splashStartBtn) {
  splashStartBtn.addEventListener("click", async () => {
    if (!introMusicStarted) await playIntroMusic();
    startOrResumeGame();
  });
}
pauseBtn.onclick = togglePause;
resetBtn.onclick = () => { resetRound(); gameState = "start"; showControlsPanel(); };
rightHandBtn.onclick = () => { battingSide = "right"; rightHandBtn.classList.add("active"); leftHandBtn.classList.remove("active"); };
leftHandBtn.onclick = () => { battingSide = "left"; leftHandBtn.classList.add("active"); rightHandBtn.classList.remove("active"); };
muteBtn.onclick = () => { soundEnabled = !soundEnabled; muteBtn.textContent = soundEnabled ? "Sound: On" : "Sound: Off"; };

updateHud();
resizeCanvas();
