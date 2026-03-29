// ================================
// CORE SETUP
// ================================
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let gameState = "start";
let ball = null;
let pitchesLeft = 10;

let slowMoTimer = 0;
let bronxGlow = 0;

const turtleImg = new Image();
turtleImg.src = "turtle.png"; // make sure this exists

// ================================
// AUDIO
// ================================
let audioCtx;

function initAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function speakCoach(text) {
  if (!("speechSynthesis" in window)) return;

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.02;
  utter.pitch = 0.9;

  const voices = speechSynthesis.getVoices();
  const v =
    voices.find(v => /en-US/i.test(v.lang) && /david|mark|alex|male/i.test(v.name)) ||
    voices.find(v => /en-US/i.test(v.lang)) ||
    voices[0];

  if (v) utter.voice = v;

  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

// ================================
// START FLOW (SAFE)
// ================================
async function startGame(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  initAudio();

  speakCoach("Let's play ball!");

  await new Promise(r => setTimeout(r, 1000));

  gameState = "playing";
  pitchesLeft = 10;

  createPitch();

  const splash = document.getElementById("splashScreen");
  if (splash) splash.style.display = "none";
}

// bind BOTH buttons
window.addEventListener("DOMContentLoaded", () => {
  const b1 = document.getElementById("startBtn");
  const b2 = document.getElementById("splashStartBtn");

  if (b1) b1.onclick = startGame;
  if (b2) b2.onclick = startGame;
});

// ================================
// PITCH
// ================================
const pitchStart = { x: 1100, y: 320 };
const strikeZone = { x: 300, y: 320 };

function createPitch() {
  ball = {
    x: pitchStart.x,
    y: pitchStart.y,
    vx: -9,
    vy: 0,
    radius: 14,
    hit: false
  };
}

// ================================
// BAT COLLISION (REAL)
// ================================
function distanceToBat(ball, wrist, tip) {
  const A = ball.x - wrist.x;
  const B = ball.y - wrist.y;
  const C = tip.x - wrist.x;
  const D = tip.y - wrist.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const t = Math.max(0, Math.min(1, dot / lenSq));

  const cx = wrist.x + t * C;
  const cy = wrist.y + t * D;

  return Math.hypot(ball.x - cx, ball.y - cy);
}

function tryHit(wrist, tip, speed) {
  if (!ball || ball.hit) return;

  const dist = distanceToBat(ball, wrist, tip);

  if (dist > 28) return;

  if (speed < 250) return;

  ball.hit = true;

  ball.vx = 14 + speed * 0.02;
  ball.vy = -6 - speed * 0.01;

  slowMoTimer = 20;

  if (speed > 600) {
    bronxGlow = 60;
    speakCoach("Home run!");
  }
}

function updateBall() {
  if (!ball) return;

  const slow = slowMoTimer > 0 ? 0.35 : 1;

  ball.x += ball.vx * slow;
  ball.y += ball.vy * slow;

  if (slowMoTimer > 0) slowMoTimer--;

  if (ball.x < strikeZone.x) {
    speakCoach("Strike!");
    ball = null;
  }
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#04152c");
  g.addColorStop(1, "#000");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawBall() {
  if (!ball) return;

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawMiniMap() {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(20, 20, 200, 80);
}

function drawBronxGlow() {
  if (bronxGlow <= 0) return;

  const letters = ["B","R","O","N","X"];

  ctx.font = "bold 40px Arial";

  letters.forEach((l,i)=>{
    ctx.fillStyle = bronxGlow > i*10 ? "#FFD43B" : "#444";
    ctx.fillText(l, 200 + i*40, 80);
  });

  bronxGlow--;
}

function drawTurtle() {
  if (!turtleImg.complete) return;

  const bounce = Math.sin(Date.now()*0.004)*6;

  ctx.drawImage(
    turtleImg,
    canvas.width - 120,
    canvas.height - 120 + bounce,
    90,
    90
  );
}

function loop() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  drawBackground();

  if (gameState === "playing") {
    updateBall();
    drawBall();
  }

  drawMiniMap();
  drawBronxGlow();
  drawTurtle();

  requestAnimationFrame(loop);
}

loop();
