// ================================
// CORE CONFIG (NEW CAMERA FEEL)
// ================================
const PLAYER_SCALE = 0.34;
const PLAYER_TARGET_X = 0.15;
const PLAYER_FLOOR_Y = 0.89;

const BALL_LANE_Y = 0.61;

const BALL_SPAWN_X_RATIO = 0.965;
const BALL_MISS_X_RATIO = 0.12;

const BG_ZOOM = 0.86;

// ================================
// DIFFICULTY (SLOWED DOWN)
// ================================
const DIFFICULTIES = {
  easy:   { pitchSpeed: 8.0, swingThreshold: 300, pitchDelay: 4.0, ballScale: 1.45, contactDistance: 88 },
  medium: { pitchSpeed: 8.5, swingThreshold: 400, pitchDelay: 3.7, ballScale: 1.2, contactDistance: 74 },
  hard:   { pitchSpeed: 9.5, swingThreshold: 500, pitchDelay: 3.2, ballScale: 1.0, contactDistance: 62 }
};

let difficulty = "medium";

// ================================
// BALL SETTINGS
// ================================
const BALL_RADIUS = 14;
const GRAVITY = 0.44;
let CONTACT_DISTANCE = DIFFICULTIES[difficulty].contactDistance;

// ================================
// CREATE PITCH (UPDATED)
// ================================
function createPitch() {
  if (ball) return;

  const d = DIFFICULTIES[difficulty];

  ball = {
    x: canvas.width * BALL_SPAWN_X_RATIO,
    y: canvas.height * BALL_LANE_Y + (Math.random() - 0.5) * canvas.height * 0.025,

    vx: -d.pitchSpeed - Math.random() * 0.4,
    vy: (Math.random() - 0.5) * 0.08,

    size: BALL_RADIUS * d.ballScale,

    hit: false,
    active: true,
    trail: []
  };
}

// ================================
// UPDATE BALL (LONGER TRAVEL)
// ================================
function updateBall() {
  if (!ball) return;

  if (!ball.hit) {
    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 10) ball.trail.shift();

    if (ball.x < canvas.width * BALL_MISS_X_RATIO) {
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
// DRAW BALL (MORE VISIBLE)
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
// BACKGROUND (ZOOMED OUT)
// ================================
function drawBackground() {
  if (!stadiumBgLoaded) return;

  const drawWidth = canvas.width * BG_ZOOM;
  const drawHeight = canvas.height * BG_ZOOM;

  const offsetX = (canvas.width - drawWidth) / 2;
  const offsetY = (canvas.height - drawHeight) / 2 - 20;

  ctx.drawImage(stadiumBg, offsetX, offsetY, drawWidth, drawHeight);
}

// ================================
// MAIN LOOP (KEEP YOURS, JUST ENSURE THESE RUN)
// ================================
// drawBackground();
// updateBall();
// drawBall();
