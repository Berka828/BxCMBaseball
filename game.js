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
const controlsPanel = document.getElementById("controlsPanel");

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

pitchDelaySlider.value = "3";
pitchPitchSetup();

function pitchPitchSetup() {
  pitchSpeedSlider.oninput = () => pitchSpeedVal.textContent = pitchSpeedSlider.value;
  swingThresholdSlider.oninput = () => swingThresholdVal.textContent = swingThresholdSlider.value;
  pitchDelaySlider.oninput = () => pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;
  pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;
}

let detector = null;
let animationId = null;
let cameraReady = false;
let modelReady = false;
let trackingEnabled = false;

let gameState = "start"; // start | countdown | playing | paused | end
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
let poseCache = null;

let hitText = "";
let hitTextTimer = 0;
let timingText = "";
let timingTextTimer = 0;
let flashTimer = 0;

let confetti = [];
let floatingStars = [];
let homerBursts = [];
let homerTrailParticles = [];
let batTrail = [];

let pitchTimer = null;
let countdownTimer = null;
let countdownValue = 5;
let countdownActive = false;

let endHoldUntil = 0;
let endFeedback = "";
let controlsReturnedAfterEnd = false;

let screenShakeTimer = 0;
let screenShakeAmount = 0;
let gestureStartCooldownUntil = 0;

const BALL_RADIUS = 14;
const GRAVITY = 0.44;
const CONTACT_DISTANCE = 68;
const BAT_LENGTH = 132;

const SKELETON_SCALE = 0.68;
const SKELETON_OFFSET_Y = 100;
const SKELETON_OFFSET_X = 0;

// ---------- IMAGE ASSETS ----------
const backgroundImg = new Image();
let backgroundReady = false;
backgroundImg.onload = () => { backgroundReady = true; };
backgroundImg.onerror = () => { backgroundReady = false; };
backgroundImg.src = "stadium-bg.png";

// optional Yankees wall logo if you still want it elsewhere later
const yankeesLogoImg = new Image();
let yankeesLogoReady = false;
yankeesLogoImg.onload = () => { yankeesLogoReady = true; };
yankeesLogoImg.onerror = () => { yankeesLogoReady = false; };
yankeesLogoImg.src = "yankees-logo.png";

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

function playCountdownBeep(n) {
  tone(n > 1 ? 660 : 880, 0.10, "triangle", 0.11, 0);
}

function playGoSound() {
  tone(880, 0.08, "triangle", 0.12, 0);
  tone(1174.66, 0.12, "triangle", 0.12, 0.08);
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

function clearCountdownTimer() {
  if (countdownTimer) {
    clearTimeout(countdownTimer);
    countdownTimer = null;
  }
}

function showControlsPanel() {
  if (!controlsPanel) return;
  controlsPanel.style.opacity = "1";
  controlsPanel.style.pointerEvents = "auto";
}

function hideControlsPanel() {
  if (!controlsPanel) return;
  controlsPanel.style.opacity = "0.08";
  controlsPanel.style.pointerEvents = "none";
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

function buildEndFeedback() {
  if (hits >= 8 && bestExitVelo >= 220) return "Excellent round. Strong contact, smart timing, and big power.";
  if (hits >= 6) return "Nice work. You made lots of contact and stayed active through the round.";
  if (bestExitVelo >= 220) return "Big power. Next step is even better timing for more extra-base hits.";
  if (misses > hits) return "Try starting your swing a little earlier and tracking the ball longer.";
  return "Good effort. Smooth swings and better timing will boost your score.";
}

function resetRound() {
  clearPitchTimer();
  clearCountdownTimer();

  score = 0;
  hits = 0;
  misses = 0;
  bestExitVelo = 0;
  pitchesLeft = roundPitches;

  prevBatPoint = null;
  batVelocity = { x: 0, y: 0, speed: 0 };
  ball = null;
  poseCache = null;

  hitText = "";
  hitTextTimer = 0;
  timingText = "";
  timingTextTimer = 0;
  flashTimer = 0;

  confetti = [];
  floatingStars = [];
  homerBursts = [];
  homerTrailParticles = [];
  batTrail = [];

  endHoldUntil = 0;
  endFeedback = "";
  controlsReturnedAfterEnd = false;

  screenShakeTimer = 0;
  screenShakeAmount = 0;

  countdownValue = 5;
  countdownActive = false;

  updateHud();
  instructionChip.textContent = "Raise both hands, do a practice swing, or press Start.";
  showControlsPanel();
}

function startEndSequence() {
  gameState = "end";
  endFeedback = buildEndFeedback();
  endHoldUntil = performance.now() + 10000;
  controlsReturnedAfterEnd = false;
  hideControlsPanel();
  instructionChip.textContent = "Round over. Review your results.";
}

async function ensureTrackingReady() {
  if (!cameraReady) {
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
    cameraReady = true;
    resizeCanvas();
  }

  if (!modelReady) {
    await tf.ready();
    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
    );
    modelReady = true;
  }

  trackingEnabled = true;
}

// ---------- BACKGROUND ----------
function drawFallbackBackground() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, "#2c3d57");
  skyGrad.addColorStop(1, "#6e91a8");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#4d9c3e";
  ctx.fillRect(0, canvas.height * 0.68, canvas.width, canvas.height * 0.32);

  ctx.fillStyle = "#c97342";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.80);
  ctx.lineTo(canvas.width * 0.18, canvas.height * 0.78);
  ctx.lineTo(canvas.width * 0.28, canvas.height * 0.93);
  ctx.lineTo(0, canvas.height * 0.98);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#c26b3d";
  ctx.beginPath();
  ctx.ellipse(
    canvas.width * 0.78,
    canvas.height * 0.88,
    canvas.width * 0.12,
    canvas.height * 0.08,
    -0.08,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawBackgroundImageCover(img) {
  const imgRatio = img.width / img.height;
  const canvasRatio = canvas.width / canvas.height;

  let drawWidth, drawHeight, x, y;

  if (imgRatio > canvasRatio) {
    drawHeight = canvas.height;
    drawWidth = drawHeight * imgRatio;
    x = (canvas.width - drawWidth) / 2;
    y = 0;
  } else {
    drawWidth = canvas.width;
    drawHeight = drawWidth / imgRatio;
    x = 0;
    y = (canvas.height - drawHeight) / 2;
  }

  ctx.drawImage(img, x, y, drawWidth, drawHeight);
}

function drawBackground() {
  if (backgroundReady) {
    drawBackgroundImageCover(backgroundImg);
  } else {
    drawFallbackBackground();
  }

  const haze = ctx.createLinearGradient(0, 0, 0, canvas.height);
  haze.addColorStop(0, "rgba(255,255,255,0.03)");
  haze.addColorStop(1, "rgba(0,0,0,0.04)");
  ctx.fillStyle = haze;
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

function midPoint(a, b, t = 0.5) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function drawBatTrail() {
  if (batTrail.length < 2) return;

  for (let i = 1; i < batTrail.length; i++) {
    const a = batTrail[i - 1];
    const b = batTrail[i];
    const alpha = i / batTrail.length;

    ctx.save();
    ctx.strokeStyle = `rgba(${a.color.r}, ${a.color.g}, ${a.color.b}, ${alpha * 0.55})`;
    ctx.lineWidth = 4 + alpha * 8;
    ctx.lineCap = "round";
    ctx.shadowBlur = 10;
    ctx.shadowColor = `rgba(${a.color.r}, ${a.color.g}, ${a.color.b}, 0.8)`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
}

function updateBatTrail(batTip) {
  if (!batTip) return;
  const strong = batVelocity.speed > 520;
  const color = strong ? { r: 255, g: 208, b: 70 } : { r: 88, g: 225, b: 255 };

  batTrail.push({
    x: batTip.x,
    y: batTip.y,
    life: 10,
    color
  });

  if (batTrail.length > 12) batTrail.shift();
}

function tickBatTrail() {
  for (let i = batTrail.length - 1; i >= 0; i--) {
    batTrail[i].life--;
    if (batTrail[i].life <= 0) batTrail.splice(i, 1);
  }
}

function drawStickFigure(pose) {
  let ls = getKeypoint(pose, "left_shoulder");
  let rs = getKeypoint(pose, "right_shoulder");
  let le = getKeypoint(pose, "left_elbow");
  let re = getKeypoint(pose, "right_elbow");
  let lw = getKeypoint(pose, "left_wrist");
  let rw = getKeypoint(pose, "right_wrist");
  let lh = getKeypoint(pose, "left_hip");
  let rh = getKeypoint(pose, "right_hip");
  let lk = getKeypoint(pose, "left_knee");
  let rk = getKeypoint(pose, "right_knee");
  let la = getKeypoint(pose, "left_ankle");
  let ra = getKeypoint(pose, "right_ankle");
  let nose = getKeypoint(pose, "nose");
  let leye = getKeypoint(pose, "left_eye", 0.2);
  let reye = getKeypoint(pose, "right_eye", 0.2);

  const center = getPoseCenter([ls, rs, le, re, lw, rw, lh, rh, lk, rk, la, ra, nose]);
  if (!center) return { rw: null, re: null, lw: null, le: null };

  ls = scalePoint(ls, center, SKELETON_SCALE);
  rs = scalePoint(rs, center, SKELETON_SCALE);
  le = scalePoint(le, center, SKELETON_SCALE);
  re = scalePoint(re, center, SKELETON_SCALE);
  lw = scalePoint(lw, center, SKELETON_SCALE);
  rw = scalePoint(rw, center, SKELETON_SCALE);
  lh = scalePoint(lh, center, SKELETON_SCALE);
  rh = scalePoint(rh, center, SKELETON_SCALE);
  lk = scalePoint(lk, center, SKELETON_SCALE);
  rk = scalePoint(rk, center, SKELETON_SCALE);
  la = scalePoint(la, center, SKELETON_SCALE);
  ra = scalePoint(ra, center, SKELETON_SCALE);
  nose = scalePoint(nose, center, SKELETON_SCALE);
  leye = scalePoint(leye, center, SKELETON_SCALE);
  reye = scalePoint(reye, center, SKELETON_SCALE);

  const armColor = "#58e1ff";
  const legColor = "#8df55f";
  const coreColor = "#ffd54f";
  const headColor = "#ffb86c";

  const shoulderMid = (ls && rs) ? midPoint(ls, rs, 0.5) : null;
  const hipMid = (lh && rh) ? midPoint(lh, rh, 0.5) : null;

  if (shoulderMid && hipMid) {
    const shortHip = midPoint(shoulderMid, hipMid, 0.62);
    drawStickBone(shoulderMid, shortHip, coreColor, 7);
  }

  if (ls && rs) drawStickBone(ls, rs, coreColor, 5);

  drawStickBone(ls, le, armColor, 6);
  drawStickBone(le, lw, armColor, 6);
  drawStickBone(rs, re, armColor, 6);
  drawStickBone(re, rw, armColor, 6);

  if (hipMid && lk) drawStickBone(hipMid, lk, legColor, 6);
  if (lk && la) drawStickBone(lk, la, legColor, 6);
  if (hipMid && rk) drawStickBone(hipMid, rk, legColor, 6);
  if (rk && ra) drawStickBone(rk, ra, legColor, 6);

  if (nose && shoulderMid) drawStickBone(shoulderMid, nose, headColor, 5);

  if (nose && leye && reye) {
    const headR = Math.max(10, Math.abs(leye.x - reye.x) * 0.95);
    ctx.save();
    ctx.strokeStyle = headColor;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 8;
    ctx.shadowColor = headColor;
    ctx.beginPath();
    ctx.arc(nose.x, nose.y + 3, headR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  [ls, rs, le, re, lw, rw, lk, rk, la, ra].forEach(p => drawStickJoint(p, 4, "#ffffff", 5));
  if (shoulderMid) drawStickJoint(shoulderMid, 3, "#ffffff", 4);
  if (hipMid) drawStickJoint(hipMid, 3, "#ffffff", 4);

  return { rw, re, lw, le, ls, rs };
}

function wristsAboveShoulders(pose) {
  const lw = getKeypoint(pose, "left_wrist", 0.25);
  const rw = getKeypoint(pose, "right_wrist", 0.25);
  const ls = getKeypoint(pose, "left_shoulder", 0.25);
  const rs = getKeypoint(pose, "right_shoulder", 0.25);
  if (!lw || !rw || !ls || !rs) return false;
  return lw.y < ls.y && rw.y < rs.y;
}

function tryGestureStart(pose) {
  if (gameState !== "start") return;
  if (countdownActive) return;
  if (performance.now() < gestureStartCooldownUntil) return;

  const handsUp = wristsAboveShoulders(pose);
  const practiceSwing = batVelocity.speed > Math.max(parseFloat(swingThresholdSlider.value) * 0.82, 260);

  if (handsUp || practiceSwing) {
    gestureStartCooldownUntil = performance.now() + 2500;
    startCountdown();
  }
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

// ---------- HIT ----------
function getTimingFeedback(batTip, ballObj) {
  const diff = batTip.x - ballObj.x;
  if (Math.abs(diff) < 25) return { label: "PERFECT!", powerBonus: 1.15, direction: 1 };
  if (diff < -25) return { label: "TOO EARLY", powerBonus: 0.85, direction: 1.2 };
  return { label: "TOO LATE", powerBonus: 0.85, direction: 0.8 };
}

function createPitch() {
  if (pitchesLeft <= 0) return;
  if (gameState !== "playing") return;
  if (ball) return;

  ball = {
    x: canvas.width + 30,
    y: canvas.height * (0.62 + Math.random() * 0.06),
    vx: -parseFloat(pitchSpeedSlider.value) - Math.random() * 1.2,
    vy: (Math.random() - 0.5) * 0.18,
    hit: false,
    active: true,
    trail: [],
    result: ""
  };

  playPitchSound();
}

function classifyHit(power, upwardSwing) {
  if (power > 1.9 && upwardSwing > 0.6) return { label: "HOME RUN!", points: 80, confettiCount: 42, launchBoost: 1.28 };
  if (power > 1.5 && upwardSwing > 0.25) return { label: "TRIPLE!", points: 45, confettiCount: 24, launchBoost: 1.02 };
  if (power > 1.08) return { label: "DOUBLE!", points: 28, confettiCount: 16, launchBoost: 0.88 };
  if (power > 0.66) return { label: "SINGLE!", points: 16, confettiCount: 10, launchBoost: 0.72 };
  return { label: "FOUL TIP!", points: 8, confettiCount: 6, launchBoost: 0.54 };
}

function tryHit(batTip) {
  if (!ball || !ball.active || ball.hit) return;

  const d = Math.hypot(ball.x - batTip.x, ball.y - batTip.y);
  if (d > CONTACT_DISTANCE) return;
  if (batVelocity.speed < parseFloat(swingThresholdSlider.value)) return;

  ball.hit = true;

  const timing = getTimingFeedback(batTip, ball);
  let power = clamp(batVelocity.speed / 700, 0.35, 2.1);
  power *= timing.powerBonus;
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

  ball.vx = lateral * baseVX * result.launchBoost * timing.direction + (Math.random() - 0.5) * 1.4;
  ball.vy = baseVY * result.launchBoost + (Math.random() - 0.5) * 1.0;
  ball.result = result.label;

  score += result.points;
  hits++;
  bestExitVelo = Math.max(bestExitVelo, power * 100);
  pitchesLeft--;

  hitText = result.label;
  hitTextTimer = 34;
  timingText = timing.label;
  timingTextTimer = 28;
  flashTimer = result.label === "HOME RUN!" ? 9 : 4;

  spawnConfetti(ball.x, ball.y, result.confettiCount);
  spawnStars(ball.x, ball.y, result.label);
  updateHud();

  if (result.label === "HOME RUN!") {
    playHomeRunSound();
    triggerHomeRunCelebration(ball.x, ball.y);
    instructionChip.textContent = "HOME RUN! PERFECT SWING!";
  } else if (result.label === "TRIPLE!" || result.label === "DOUBLE!") {
    playBigHitSound();
    instructionChip.textContent = timing.label;
  } else {
    playHitSound();
    instructionChip.textContent = timing.label;
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
  if (!ball || !ball.active) return;
  if (gameState !== "playing") return;

  if (!ball.hit) {
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.trail.push({ x: ball.x, y: ball.y, a: 0.16 });
    if (ball.trail.length > 7) ball.trail.shift();
    if (ball.x < -40) resolveMiss();
  } else {
    ball.vy += GRAVITY;
    ball.vx *= 0.992;
    ball.vy *= 0.996;

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.trail.push({ x: ball.x, y: ball.y, a: 0.24 });
    if (ball.trail.length > 16) ball.trail.shift();

    if (ball.result === "HOME RUN!") {
      spawnHomeRunTrail();
      spawnHomeRunTrail();
    }

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
  ctx.shadowBlur = ball.result === "HOME RUN!" ? 24 : 14;
  ctx.shadowColor = ball.result === "HOME RUN!" ? "#ffd54f" : "#ffffff";
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

// ---------- OVERLAYS ----------
function wrapCenteredText(text, centerX, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], centerX, y + i * lineHeight);
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
    if (timingText === "PERFECT!") fill = "#66e07a";
    if (timingText === "TOO EARLY" || timingText === "TOO LATE") fill = "#ffcc66";

    ctx.fillStyle = fill;
    ctx.font = '900 40px "Baloo 2", sans-serif';
    ctx.strokeText(timingText, canvas.width / 2, canvas.height * 0.30);
    ctx.fillText(timingText, canvas.width / 2, canvas.height * 0.30);
    ctx.restore();
    timingTextTimer--;
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
  ctx.fillText("Press Pause, Space, or Esc to resume.", canvas.width / 2, canvas.height * 0.43);
}

function drawStartOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 60px "Baloo 2", sans-serif';
  ctx.fillText("PRESS START", canvas.width / 2, canvas.height * 0.30);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 26px "Nunito", sans-serif';
  ctx.fillText("Raise both hands or do a practice swing to start too.", canvas.width / 2, canvas.height * 0.39);
  ctx.fillText("Choose left or right handed play.", canvas.width / 2, canvas.height * 0.45);
  ctx.fillText("Press Space or Esc anytime to pause.", canvas.width / 2, canvas.height * 0.51);
}

function drawEndOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54f";
  ctx.font = '900 56px "Baloo 2", sans-serif';
  ctx.fillText("ROUND OVER!", canvas.width / 2, canvas.height * 0.31);

  ctx.fillStyle = "#ffffff";
  ctx.font = '900 28px "Nunito", sans-serif';
  ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height * 0.40);
  ctx.fillText(`Hits: ${hits}   |   Misses: ${misses}   |   Best EV: ${Math.round(bestExitVelo)}`, canvas.width / 2, canvas.height * 0.47);

  ctx.fillStyle = "#dfeaff";
  ctx.font = '900 24px "Nunito", sans-serif';
  wrapCenteredText(endFeedback, canvas.width / 2, canvas.height * 0.58, canvas.width * 0.62, 32);

  const secondsLeft = Math.max(0, Math.ceil((endHoldUntil - performance.now()) / 1000));
  if (!controlsReturnedAfterEnd && secondsLeft > 0) {
    ctx.fillStyle = "#ffffff";
    ctx.font = '900 20px "Nunito", sans-serif';
    ctx.fillText(`Controls return in ${secondsLeft}...`, canvas.width / 2, canvas.height * 0.71);
  }
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
    ctx.fillText("Get set...", canvas.width / 2, canvas.height * 0.56);
  } else {
    ctx.font = '900 90px "Baloo 2", sans-serif';
    ctx.strokeText("SWING!", canvas.width / 2, canvas.height * 0.45);
    ctx.fillText("SWING!", canvas.width / 2, canvas.height * 0.45);
  }
}

// ---------- MAIN LOOP ----------
async function renderFrame() {
  const shake = getShakeOffset();

  if (trackingEnabled && modelReady && detector && cameraReady) {
    try {
      const poses = await detector.estimatePoses(video, { flipHorizontal: true });
      poseCache = poses[0] || null;
    } catch (e) {
      // keep last poseCache
    }
  }

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(shake.x, shake.y);

  drawBackground();
  drawMiniMap();

  if (poseCache) {
    const points = drawStickFigure(poseCache);
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

    if (gameState === "start") {
      tryGestureStart(poseCache);
    }
  }

  drawBatTrail();

  if (gameState === "playing") {
    updateBall();
    drawBall();
    updateAndDrawConfetti();
    updateAndDrawStars();
    updateAndDrawHomerBursts();
    updateAndDrawHomerTrailParticles();
    drawHitOverlay();

    if (pitchesLeft <= 0 && !ball) {
      startEndSequence();
    }
  } else {
    drawBall();
    updateAndDrawConfetti();
    updateAndDrawStars();
    updateAndDrawHomerBursts();
    updateAndDrawHomerTrailParticles();
    drawHitOverlay();
  }

  if (gameState === "end" && !controlsReturnedAfterEnd && performance.now() >= endHoldUntil) {
    controlsReturnedAfterEnd = true;
    showControlsPanel();
    instructionChip.textContent = "Round complete. Start a new game when ready.";
  }

  tickBatTrail();

  if (gameState === "start") drawStartOverlay();
  if (gameState === "countdown") drawCountdownOverlay();
  if (gameState === "paused") drawPauseOverlay();
  if (gameState === "end") drawEndOverlay();

  ctx.restore();
  animationId = requestAnimationFrame(renderFrame);
}

// ---------- CONTROLS ----------
function startCountdown() {
  clearCountdownTimer();
  countdownActive = true;
  countdownValue = 5;
  gameState = "countdown";
  instructionChip.textContent = "Get set...";
  hideControlsPanel();

  const tick = () => {
    if (!countdownActive) return;

    if (countdownValue > 0) {
      playCountdownBeep(countdownValue);
      countdownValue--;
      countdownTimer = setTimeout(tick, 1000);
    } else {
      playGoSound();
      countdownActive = false;
      gameState = "playing";
      instructionChip.textContent = "Swing!";
      createPitch();
    }
  };

  tick();
}

function togglePause() {
  if (gameState === "playing") {
    gameState = "paused";
    pauseBtn.textContent = "Resume Game";
    clearPitchTimer();
    clearCountdownTimer();
    showControlsPanel();
    instructionChip.textContent = "Game paused.";
    return;
  }

  if (gameState === "countdown") {
    gameState = "paused";
    countdownActive = false;
    clearCountdownTimer();
    pauseBtn.textContent = "Resume Game";
    showControlsPanel();
    instructionChip.textContent = "Game paused.";
    return;
  }

  if (gameState === "paused") {
    pauseBtn.textContent = "Pause Game";

    if (!ball && hits === 0 && misses === 0 && pitchesLeft === roundPitches) {
      startCountdown();
    } else {
      gameState = "playing";
      hideControlsPanel();
      instructionChip.textContent = "Game resumed.";
      if (!ball) scheduleNextPitch();
      playStartSound();
    }
  }
}

async function startOrResumeGame() {
  initAudio();
  await ensureTrackingReady();

  if (!animationId) {
    renderFrame();
  }

  if (gameState === "paused") {
    gameState = "playing";
    pauseBtn.textContent = "Pause Game";
    instructionChip.textContent = "Game resumed.";
    hideControlsPanel();
    if (!ball) scheduleNextPitch();
    playStartSound();
    return;
  }

  if (gameState === "start" || gameState === "end") {
    resetRound();
    pauseBtn.textContent = "Pause Game";
    playStartSound();
    startCountdown();
  }
}

function resetGame() {
  clearPitchTimer();
  clearCountdownTimer();
  resetRound();
  gameState = "start";
  pauseBtn.textContent = "Pause Game";
  instructionChip.textContent = "Raise both hands, do a practice swing, or press Start.";
  showControlsPanel();
}

startBtn.onclick = startOrResumeGame;
pauseBtn.onclick = togglePause;
resetBtn.onclick = resetGame;

muteBtn.onclick = () => {
  soundEnabled = !soundEnabled;
  if (soundEnabled) {
    initAudio();
    muteBtn.textContent = "Sound: On";
    playStartSound();
  } else {
    muteBtn.textContent = "Sound: Off";
  }
};

rightHandBtn.onclick = () => {
  battingSide = "right";
  prevBatPoint = null;
  rightHandBtn.classList.add("active");
  leftHandBtn.classList.remove("active");
};

leftHandBtn.onclick = () => {
  battingSide = "left";
  prevBatPoint = null;
  leftHandBtn.classList.add("active");
  rightHandBtn.classList.remove("active");
};

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.key === "Escape" || e.key === "Esc") {
    e.preventDefault();
    if (["playing", "paused", "countdown"].includes(gameState)) {
      togglePause();
    }
  }
});

// ---------- INIT ----------
rightHandBtn.classList.add("active");
leftHandBtn.classList.remove("active");
updateHud();
resizeCanvas();
instructionChip.textContent = "Raise both hands, do a practice swing, or press Start.";
showControlsPanel();
