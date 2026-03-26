const MIRROR_MODE = true;

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

// -------------------- DEFAULTS --------------------
pitchDelaySlider.value = "3";
pitchDelayVal.textContent = "3s";

pitchSpeedSlider.oninput = () => {
  pitchSpeedVal.textContent = pitchSpeedSlider.value;
};
swingThresholdSlider.oninput = () => {
  swingThresholdVal.textContent = swingThresholdSlider.value;
};
pitchDelaySlider.oninput = () => {
  pitchDelayVal.textContent = `${pitchDelaySlider.value}s`;
};

// -------------------- STATE --------------------
let detector = null;
let cameraReady = false;
let modelReady = false;
let poseLoopStarted = false;
let renderLoopStarted = false;

let latestPose = null;
let latestBatTip = null;

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

let pitchTimer = null;
let countdownTimer = null;
let countdownValue = 5;
let countdownActive = false;

let endHoldUntil = 0;
let endFeedback = "";
let controlsReturnedAfterEnd = false;

let gestureStartCooldownUntil = 0;

let hitText = "";
let hitTextTimer = 0;
let timingText = "";
let timingTextTimer = 0;
let screenFlashTimer = 0;

let confetti = [];
let homerTrail = [];

const BALL_RADIUS = 14;
const GRAVITY = 0.42;
const CONTACT_DISTANCE = 68;
const BAT_LENGTH = 132;

const SKELETON_SCALE = 0.68;
const SKELETON_OFFSET_Y = 100;
const SKELETON_OFFSET_X = 0;

// -------------------- IMAGE BACKGROUND --------------------
const backgroundImg = new Image();
let backgroundReady = false;

backgroundImg.onload = () => {
  backgroundReady = true;
};
backgroundImg.onerror = () => {
  backgroundReady = false;
};
backgroundImg.src = "stadium-bg.png";

// -------------------- AUDIO --------------------
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
  tone(180, 0.04, "square", 0.14, 0);
  tone(320, 0.08, "triangle", 0.10, 0.02);
}

function playBigHitSound() {
  tone(220, 0.04, "square", 0.15, 0);
  tone(440, 0.10, "triangle", 0.12, 0.03);
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

// -------------------- HELPERS --------------------
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
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

function buildEndFeedback() {
  if (hits >= 8 && bestExitVelo >= 220) return "Excellent round. Strong contact and big power.";
  if (hits >= 6) return "Nice work. You made solid contact throughout the round.";
  if (bestExitVelo >= 220) return "Great power. Try improving timing for even better results.";
  if (misses > hits) return "Try swinging a little earlier and staying with the ball longer.";
  return "Good effort. Keep practicing your timing and follow-through.";
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

  countdownValue = 5;
  countdownActive = false;

  endHoldUntil = 0;
  endFeedback = "";
  controlsReturnedAfterEnd = false;

  hitText = "";
  hitTextTimer = 0;
  timingText = "";
  timingTextTimer = 0;
  screenFlashTimer = 0;

  confetti = [];
  homerTrail = [];

  updateHud();
  instructionChip.textContent = "Press Start to begin.";
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

// -------------------- CAMERA / POSE --------------------
function getKeypoint(pose, name, minScore = 0.25) {
  return pose?.keypoints?.find(k => k.name === name && (k.score ?? 0) > minScore) || null;
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
    await tf.setBackend("webgl");
    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
    );
    modelReady = true;
  }
}

function startPoseLoop() {
  if (poseLoopStarted) return;
  poseLoopStarted = true;

  const updatePose = async () => {
    if (cameraReady && modelReady && detector) {
      try {
        const poses = await detector.estimatePoses(video, { flipHorizontal: true });
        latestPose = poses[0] || null;
      } catch (err) {
        // keep last pose
      }
    }
    requestAnimationFrame(updatePose);
  };

  requestAnimationFrame(updatePose);
}

// -------------------- BACKGROUND --------------------
function drawFallbackBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#203a5c");
  grad.addColorStop(1, "#88a3b8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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

  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// -------------------- SKELETON / BAT --------------------
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
    x: valid.reduce((sum, p) => sum + p.x, 0) / valid.length,
    y: valid.reduce((sum, p) => sum + p.y, 0) / valid.length
  };
}

function screenX(x) {
  return MIRROR_MODE ? canvas.width - x : x;
}

function drawStickBone(a, b, color, width = 6) {
  if (!a || !b) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(screenX(a.x), a.y);
  ctx.lineTo(screenX(b.x), b.y);
  ctx.stroke();
  ctx.restore();
}

function drawStickJoint(p, radius = 4, color = "#ffffff") {
  if (!p) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowBlur = 5;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(screenX(p.x), p.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function midPoint(a, b, t = 0.5) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
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
    ctx.arc(screenX(nose.x), nose.y + 3, headR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  [ls, rs, le, re, lw, rw, lk, rk, la, ra].forEach(p => drawStickJoint(p, 4, "#ffffff"));

  return { rw, re, lw, le };
}

function getBattingArm(points) {
  if (battingSide === "right") {
    return points.rw && points.re ? { wrist: points.rw, elbow: points.re } : null;
  }
  return points.lw && points.le ? { wrist: points.lw, elbow: points.le } : null;
}

function drawBatFromSide(wrist, elbow) {
  if (!wrist || !elbow) return null;

  const wx = screenX(wrist.x);
  const ex = screenX(elbow.x);
  const wy = wrist.y;
  const ey = elbow.y;

  const dx = wx - ex;
  const dy = wy - ey;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;

  const tipX = wx + nx * BAT_LENGTH;
  const tipY = wy + ny * BAT_LENGTH;

  ctx.save();
  ctx.lineCap = "round";

  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.strokeStyle = "#ffca28";
  ctx.lineWidth = 8;
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#ffca28";
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.restore();

  return { x: tipX, y: tipY };
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

// -------------------- NEXT LEVEL GUIDE --------------------
function drawSwingGuide() {
  if (!latestBatTip) return;
  if (!["start", "countdown"].includes(gameState)) return;

  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255, 213, 79, 0.75)";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(255, 213, 79, 0.6)";

  const dir = battingSide === "right" ? -1 : 1;
  const lineStartX = latestBatTip.x;
  const lineEndX = latestBatTip.x + dir * 170;

  ctx.beginPath();
  ctx.moveTo(lineStartX, latestBatTip.y);
  ctx.lineTo(lineEndX, latestBatTip.y - 16);
  ctx.stroke();

  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = '900 18px "Nunito", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("SWING THIS WAY", latestBatTip.x + dir * 110, latestBatTip.y - 26);
  ctx.restore();
}

// -------------------- BALL --------------------
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

function createPitch() {
  if (pitchesLeft <= 0) return;
  if (gameState !== "playing") return;
  if (ball) return;

  const pitchSpeed = parseFloat(pitchSpeedSlider.value);

  if (battingSide === "right") {
    ball = {
      x: canvas.width + 30,
      y: canvas.height * (0.62 + Math.random() * 0.06),
      vx: -pitchSpeed - Math.random() * 1.2,
      vy: (Math.random() - 0.5) * 0.18,
      hit: false,
      result: ""
    };
  } else {
    ball = {
      x: -30,
      y: canvas.height * (0.62 + Math.random() * 0.06),
      vx: pitchSpeed + Math.random() * 1.2,
      vy: (Math.random() - 0.5) * 0.18,
      hit: false,
      result: ""
    };
  }

  playPitchSound();
}

function getTimingFeedback(batTip, ballObj) {
  const diff = batTip.x - ballObj.x;
  if (Math.abs(diff) < 25) return { label: "PERFECT!", powerBonus: 1.15, direction: 1 };
  if ((battingSide === "right" && diff < -25) || (battingSide === "left" && diff > 25)) {
    return { label: "TOO EARLY", powerBonus: 0.85, direction: 1.2 };
  }
  return { label: "TOO LATE", powerBonus: 0.85, direction: 0.8 };
}

function classifyHit(power, upwardSwing) {
  if (power > 1.9 && upwardSwing > 0.6) return { label: "HOME RUN!", points: 80, boost: 1.28 };
  if (power > 1.5 && upwardSwing > 0.25) return { label: "TRIPLE!", points: 45, boost: 1.02 };
  if (power > 1.08) return { label: "DOUBLE!", points: 28, boost: 0.88 };
  if (power > 0.66) return { label: "SINGLE!", points: 16, boost: 0.72 };
  return { label: "FOUL TIP!", points: 8, boost: 0.54 };
}

function tryHit(batTip) {
  if (!ball || ball.hit) return;

  const dx = ball.x - batTip.x;
  const dy = ball.y - batTip.y;
  const d = Math.hypot(dx, dy);

  if (d > CONTACT_DISTANCE) return;
  if (batVelocity.speed < parseFloat(swingThresholdSlider.value)) return;

  ball.hit = true;

  const timing = getTimingFeedback(batTip, ball);
  let power = clamp(batVelocity.speed / 700, 0.35, 2.1);
  power *= timing.powerBonus;
  const upwardSwing = clamp((-batVelocity.y) / 700, -0.4, 1.0);

  const result = classifyHit(power, upwardSwing);

  let launchDir = battingSide === "right" ? -1 : 1;
  launchDir *= timing.direction;

  const baseVX = (9 + power * 8) * launchDir;
  const baseVY = -(4 + Math.max(0, upwardSwing) * 7 + power * 2.2);

  ball.vx = baseVX * result.boost + (Math.random() - 0.5) * 1.1;
  ball.vy = baseVY * result.boost + (Math.random() - 0.5) * 0.9;
  ball.result = result.label;

  score += result.points;
  hits++;
  bestExitVelo = Math.max(bestExitVelo, power * 100);
  pitchesLeft--;

  hitText = result.label;
  hitTextTimer = 34;
  timingText = timing.label;
  timingTextTimer = 28;
  screenFlashTimer = result.label === "HOME RUN!" ? 8 : 3;
  updateHud();

  if (result.label === "HOME RUN!") {
    playHomeRunSound();
    instructionChip.textContent = "HOME RUN! PERFECT SWING!";
  } else if (result.label === "TRIPLE!" || result.label === "DOUBLE!") {
    playBigHitSound();
    instructionChip.textContent = timing.label;
  } else {
    playHitSound();
    instructionChip.textContent = timing.label;
  }
}

function updateBall() {
  if (!ball) return;
  if (gameState !== "playing") return;

  if (!ball.hit) {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if ((battingSide === "right" && ball.x < -40) || (battingSide === "left" && ball.x > canvas.width + 40)) {
      misses++;
      pitchesLeft--;
      ball = null;
      updateHud();
      playMissSound();
      instructionChip.textContent = "Miss! Reset and get ready.";
      scheduleNextPitch();
    }
  } else {
    ball.vy += GRAVITY;
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.result === "HOME RUN!") {
      homerTrail.push({
        x: ball.x,
        y: ball.y,
        life: 18 + Math.random() * 8,
        r: 4 + Math.random() * 5
      });
    }

    if (
      ball.y > canvas.height + 60 ||
      ball.x < -100 ||
      ball.x > canvas.width + 100
    ) {
      ball = null;
      instructionChip.textContent = "Nice! Get ready for the next pitch.";
      scheduleNextPitch();
    }
  }
}

function drawBall() {
  if (!ball) return;

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

// -------------------- SIMPLE FX --------------------
function updateAndDrawHomerTrail() {
  for (let i = homerTrail.length - 1; i >= 0; i--) {
    const p = homerTrail[i];
    p.life--;

    ctx.save();
    ctx.globalAlpha = Math.max(p.life / 22, 0);
    ctx.fillStyle = "#ffd54f";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ffd54f";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (p.life <= 0) homerTrail.splice(i, 1);
  }
}

function drawHitOverlay() {
  if (hitTextTimer > 0) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#14304b";
    ctx.fillStyle = hitText.includes("HOME RUN!") ? "#ffd54f" : "#ffffff";
    ctx.font = '900 64px "Baloo 2", sans-serif';
    ctx.strokeText(hitText, canvas.width / 2, canvas.height * 0.22);
    ctx.fillText(hitText, canvas.width / 2, canvas.height * 0.22);
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

  if (screenFlashTimer > 0) {
    ctx.fillStyle = `rgba(255,255,255,${screenFlashTimer * 0.02})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    screenFlashTimer--;
  }
}

// -------------------- MINIMAP --------------------
function drawMiniMap() {
  miniCtx.clearRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);

  miniCtx.fillStyle = "#0b2343";
  miniCtx.fillRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);

  miniCtx.strokeStyle = "rgba(255,255,255,0.18)";
  miniCtx.lineWidth = 2;
  miniCtx.strokeRect(1, 1, miniMapCanvas.width - 2, miniMapCanvas.height - 2);

  miniCtx.fillStyle = "#dbeaff";
  miniCtx.font = '900 12px "Nunito", sans-serif';
  miniCtx.textAlign = "left";
  miniCtx.fillText(battingSide === "right" ? "Right-handed" : "Left-handed", 12, 18);

  miniCtx.strokeStyle = "rgba(255,255,255,0.30)";
  miniCtx.lineWidth = 4;
  miniCtx.beginPath();
  if (battingSide === "right") {
    miniCtx.moveTo(miniMapCanvas.width - 24, 75);
    miniCtx.lineTo(34, 75);
  } else {
    miniCtx.moveTo(24, 75);
    miniCtx.lineTo(miniMapCanvas.width - 34, 75);
  }
  miniCtx.stroke();

  if (ball) {
    const bx = clamp((ball.x / canvas.width) * miniMapCanvas.width, 10, miniMapCanvas.width - 10);
    const by = clamp((ball.y / canvas.height) * miniMapCanvas.height, 18, miniMapCanvas.height - 18);

    miniCtx.fillStyle = "#ffffff";
    miniCtx.beginPath();
    miniCtx.arc(bx, by, 7, 0, Math.PI * 2);
    miniCtx.fill();
  }
}

// -------------------- OVERLAYS --------------------
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
  ctx.fillText("Choose right or left handed play.", canvas.width / 2, canvas.height * 0.39);
  ctx.fillText("The ball will come from that side.", canvas.width / 2, canvas.height * 0.45);
  ctx.fillText("Press Space or Esc anytime to pause.", canvas.width / 2, canvas.height * 0.51);
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
  ctx.fillText(endFeedback, canvas.width / 2, canvas.height * 0.58);

  const secondsLeft = Math.max(0, Math.ceil((endHoldUntil - performance.now()) / 1000));
  if (!controlsReturnedAfterEnd && secondsLeft > 0) {
    ctx.fillStyle = "#ffffff";
    ctx.font = '900 20px "Nunito", sans-serif';
    ctx.fillText(`Controls return in ${secondsLeft}...`, canvas.width / 2, canvas.height * 0.71);
  }
}

// -------------------- GAME FLOW --------------------
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
  startPoseLoop();
  startRenderLoop();

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
  instructionChip.textContent = "Press Start to begin.";
  showControlsPanel();
}

// -------------------- RENDER --------------------
function renderGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawMiniMap();

  latestBatTip = null;

  if (latestPose) {
    const points = drawStickFigure(latestPose);
    const battingArm = getBattingArm(points);

    if (battingArm) {
      const batTip = drawBatFromSide(battingArm.wrist, battingArm.elbow);
      if (batTip) {
        latestBatTip = batTip;
        updateBatVelocity(batTip);

        if (gameState === "playing") {
          tryHit(batTip);
        }
      }
    }
  }

  drawSwingGuide();

  if (gameState === "playing") {
    updateBall();
    drawBall();
    updateAndDrawHomerTrail();
    drawHitOverlay();

    if (pitchesLeft <= 0 && !ball) {
      startEndSequence();
    }
  } else {
    drawBall();
    updateAndDrawHomerTrail();
    drawHitOverlay();
  }

  if (gameState === "end" && !controlsReturnedAfterEnd && performance.now() >= endHoldUntil) {
    controlsReturnedAfterEnd = true;
    showControlsPanel();
    instructionChip.textContent = "Round complete. Start a new game when ready.";
  }

  if (gameState === "start") drawStartOverlay();
  if (gameState === "countdown") drawCountdownOverlay();
  if (gameState === "paused") drawPauseOverlay();
  if (gameState === "end") drawEndOverlay();
}

function startRenderLoop() {
  if (renderLoopStarted) return;
  renderLoopStarted = true;

  const frame = () => {
    renderGame();
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

// -------------------- UI --------------------
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
  instructionChip.textContent = "Right-handed mode selected.";
};

leftHandBtn.onclick = () => {
  battingSide = "left";
  prevBatPoint = null;
  leftHandBtn.classList.add("active");
  rightHandBtn.classList.remove("active");
  instructionChip.textContent = "Left-handed mode selected.";
};

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.key === "Escape" || e.key === "Esc") {
    e.preventDefault();
    if (["playing", "paused", "countdown"].includes(gameState)) {
      togglePause();
    }
  }
});

// -------------------- INIT --------------------
rightHandBtn.classList.add("active");
leftHandBtn.classList.remove("active
