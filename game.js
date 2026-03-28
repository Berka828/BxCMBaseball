// ================================
// ⚾ BXCM BASEBALL GAME - PATCHED FULL VERSION
// ================================

// ===== ORIGINAL SETUP =====
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const miniMapCanvas = document.getElementById("miniMapCanvas");
const miniCtx = miniMapCanvas ? miniMapCanvas.getContext("2d") : null;

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

const pitchSpeedSlider = document.getElementById("pitchSpeed");

// ================================
// 🎥 SCENE FEEL (PATCHED)
// ================================
const PLAYER_SCALE = 0.34;       // was 0.40 → zoomed out feel
const PLAYER_TARGET_X = 0.15;    // was 0.21 → moves hitter left
const PLAYER_FLOOR_Y = 0.885;
const BALL_LANE_Y = 0.61;

// ================================
// ⚾ BALL SETTINGS
// ================================
const BALL_RADIUS = 14;
const GRAVITY = 0.44;

let ball = null;

// ================================
// 🎯 CREATE PITCH (PATCHED)
// ================================
function createPitch() {
  if (ball) return;

  const speed = parseFloat(pitchSpeedSlider?.value || "12");

  ball = {
    // 🔥 farther away (BIG CHANGE)
    x: canvas.width * 0.965,

    y: canvas.height * BALL_LANE_Y + (Math.random() - 0.5) * canvas.height * 0.03,

    // 🔥 slower for reaction time
    vx: -(speed * 0.75) - Math.random() * 0.5,

    vy: (Math.random() - 0.5) * 0.1,

    // 🔥 slightly bigger for kids visibility
    size: BALL_RADIUS * 1.15,

    hit: false,
    active: true,
    trail: []
  };
}

// ================================
// 🔄 UPDATE BALL (PATCHED)
// ================================
function updateBall() {
  if (!ball) return;

  if (!ball.hit) {
    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 8) ball.trail.shift();

    // 🔥 longer travel before miss
    if (ball.x < canvas.width * 0.12) {
      ball = null;
    }
  } else {
    ball.vy += GRAVITY;
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.y > canvas.height + 50) {
      ball = null;
    }
  }
}

// ================================
// 🎨 DRAW BALL (IMPROVED)
// ================================
function drawBall() {
  if (!ball) return;

  // trail
  ball.trail.forEach((p, i) => {
    ctx.globalAlpha = i / ball.trail.length;

    ctx.beginPath();
    ctx.arc(p.x, p.y, ball.size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  });

  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
}

// ================================
// 🏟 BACKGROUND (ZOOMED OUT)
// ================================
const stadiumBg = new Image();
let stadiumBgLoaded = false;

stadiumBg.onload = () => { stadiumBgLoaded = true; };
stadiumBg.src = "./stadium-bg.png";

function drawBackground() {
  if (stadiumBgLoaded) {
    const zoom = 0.86;

    const drawWidth = canvas.width * zoom;
    const drawHeight = canvas.height * zoom;

    const offsetX = (canvas.width - drawWidth) / 2;
    const offsetY = (canvas.height - drawHeight) / 2 - 20;

    ctx.drawImage(stadiumBg, offsetX, offsetY, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = "#1e2f4d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// ================================
// 📏 RESIZE
// ================================
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
window.addEventListener("resize", resizeCanvas);

// ================================
// 🔁 MAIN LOOP
// ================================
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  updateBall();
  drawBall();

  requestAnimationFrame(loop);
}

// ================================
// 🎮 CONTROLS
// ================================
startBtn.onclick = () => {
  createPitch();
};

resetBtn.onclick = () => {
  ball = null;
};

// ================================
// 🚀 START
// ================================
resizeCanvas();
loop();
