// ================================
// BxCM BASEBALL GAME - CLEAN BUILD
// ================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let width, height;
function resizeCanvas() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ================================
// GAME STATE
// ================================

let gameStarted = false;
let gameOver = false;
let paused = false;

let score = 0;
let hits = 0;
let misses = 0;
let pitchesLeft = 5;

let currentMessage = "";
let messageTimer = 0;

let powerLevel = 0;
let lastHitDistance = 0;

let ball = null;

// ================================
// UI ELEMENTS
// ================================

const splash = document.getElementById("splash");
const startBtn = document.getElementById("startBtn");

// ================================
// START GAME (FIXED - NO ERRORS)
// ================================

startBtn.onclick = () => {
  try {
    splash.style.display = "none";
    startGame();
  } catch (e) {
    console.error(e);
  }
};

function startGame() {
  gameStarted = true;
  gameOver = false;
  score = 0;
  hits = 0;
  misses = 0;
  pitchesLeft = 5;

  nextPitch();
}

// ================================
// PAUSE (SPACEBAR)
// ================================

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    paused = !paused;
  }
});

// ================================
// BALL LOGIC
// ================================

function nextPitch() {
  if (pitchesLeft <= 0) {
    endGame();
    return;
  }

  ball = {
    x: width * 0.85,
    y: randomY(),
    vx: -12,
    radius: 14
  };

  pitchesLeft--;
}

function randomY() {
  return height * 0.6 + Math.random() * height * 0.2;
}

// ================================
// HIT DETECTION
// ================================

function tryHit() {
  if (!ball) return;

  const timing = Math.abs(ball.x - width * 0.35);

  if (timing < 40) {
    registerHit("perfect");
  } else if (timing < 80) {
    registerHit("good");
  } else {
    registerMiss("too early");
  }
}

window.addEventListener("click", tryHit);

// ================================
// HIT / MISS
// ================================

function registerHit(type) {
  hits++;

  if (type === "perfect") {
    score += 100;
    lastHitDistance = rand(180, 250);
    showMessage("💥 HOMERUN!");
  } else {
    score += 50;
    lastHitDistance = rand(90, 160);
    showMessage("Nice Hit!");
  }

  ball = null;
  delayNextPitch(1200);
}

function registerMiss(reason) {
  misses++;
  showMessage("Miss! " + reason);
  ball = null;
  delayNextPitch(1000);
}

function delayNextPitch(ms) {
  setTimeout(() => {
    if (!gameOver) nextPitch();
  }, ms);
}

// ================================
// MESSAGE SYSTEM (LONGER)
// ================================

function showMessage(msg) {
  currentMessage = msg;
  messageTimer = Date.now();
}

// ================================
// END GAME
// ================================

function endGame() {
  gameOver = true;
  showMessage("Great Job!");
}

// ================================
// DRAW LOOP
// ================================

function draw() {
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = "#0a1a2f";
  ctx.fillRect(0, 0, width, height);

  // ========================
  // PLAYER SILHOUETTE
  // ========================
  ctx.fillStyle = "rgba(0,200,255,0.9)";
  ctx.shadowBlur = 25;
  ctx.shadowColor = "#00eaff";

  ctx.beginPath();
  ctx.arc(width * 0.25, height * 0.7, 80, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // ========================
  // BALL
  // ========================
  if (ball) {
    ball.x += ball.vx;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    if (ball.x < 0) {
      registerMiss("too late");
    }
  }

  // ========================
  // POWER METER (THERMOMETER)
  // ========================
  const meterHeight = 200;
  ctx.fillStyle = "#333";
  ctx.fillRect(width - 60, height - meterHeight - 40, 20, meterHeight);

  ctx.fillStyle = "#00ffcc";
  ctx.fillRect(
    width - 60,
    height - 40 - powerLevel,
    20,
    powerLevel
  );

  // ========================
  // TEXT
  // ========================
  ctx.fillStyle = "#fff";
  ctx.font = "20px Arial";
  ctx.fillText(`Score: ${score}`, 20, 40);
  ctx.fillText(`Hits: ${hits}`, 20, 70);

  if (currentMessage && Date.now() - messageTimer < 4000) {
    ctx.font = "36px Arial";
    ctx.fillStyle = "#ffcc00";
    ctx.fillText(currentMessage, width / 2 - 120, height * 0.2);
  }

  if (lastHitDistance > 0) {
    ctx.fillText(`${lastHitDistance} ft`, width / 2 - 40, height * 0.3);
  }

  requestAnimationFrame(draw);
}

draw();

// ================================
// UTILS
// ================================

function rand(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}
