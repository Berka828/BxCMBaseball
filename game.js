// ================================
// GLOBALS
// ================================
let animationId = null;
let gameState = "start";
let ball = null;
let pitchesLeft = 10;

let cameraZoom = 1;
let cameraPan = 0;

// ================================
// AUDIO (FIXED + ANNOUNCER)
// ================================
let audioCtx;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// 🎤 Better announcer voice selection
function getAnnouncerVoice() {
  const voices = speechSynthesis.getVoices();

  return (
    voices.find(v => v.lang === "en-US" && /male|david|mark|alex/i.test(v.name)) ||
    voices.find(v => v.lang === "en-US") ||
    voices[0]
  );
}

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.voice = getAnnouncerVoice();
  utter.rate = 1.05;
  utter.pitch = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

// ================================
// START GAME FIX
// ================================
async function startGame() {
  initAudio();

  // ✅ ANNOUNCER BEFORE GAME START
  speak("Let's play ball!");

  await new Promise(r => setTimeout(r, 1200)); // small pause before pitch

  gameState = "playing";
  createPitch();
}

// ================================
// CAMERA (ZOOM + PAN)
// ================================
function updateCamera() {
  cameraZoom += (1.02 - cameraZoom) * 0.002;
  cameraPan += 0.02;

  ctx.setTransform(
    cameraZoom,
    0,
    0,
    cameraZoom,
    Math.sin(cameraPan) * 10,
    0
  );
}

// ================================
// PITCH (LONGER DISTANCE)
// ================================
const pitchStart = { x: 1200, y: 300 };
const strikeZone = { x: 300, y: 300 };
const pitchSpeed = 8;

function createPitch() {
  ball = {
    x: pitchStart.x,
    y: pitchStart.y,
    vx: -pitchSpeed,
    vy: 0,
    hit: false
  };
}

// ================================
// UPDATE BALL
// ================================
function updateBall() {
  if (!ball) return;

  ball.x += ball.vx;

  if (ball.x < strikeZone.x) {
    miss();
  }
}

// ================================
// MISS
// ================================
function miss() {
  speak("Strike!");
  ball = null;
}

// ================================
// HOMERUN EFFECT (BRONX GLOW)
// ================================
let bronxGlowTimer = 0;

function triggerHomeRun() {
  bronxGlowTimer = 120;
  speak("Home run!");
}

function drawBronxGlow() {
  if (bronxGlowTimer <= 0) return;

  const letters = ["B", "R", "O", "N", "X"];

  letters.forEach((l, i) => {
    if (bronxGlowTimer > i * 10) {
      ctx.fillStyle = "#FFD43B";
    } else {
      ctx.fillStyle = "#555";
    }

    ctx.font = "bold 40px Arial";
    ctx.fillText(l, 200 + i * 40, 80);
  });

  bronxGlowTimer--;
}

// ================================
// MINI MAP (MOVED)
// ================================
function drawMiniMap() {
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(20, 20, 200, 80); // moved TOP LEFT (was top right)
}

// ================================
// END SCREEN (IMPROVED RIBBON)
// ================================
function drawEndScreen() {
  ctx.fillStyle = "#7D4DFF";
  ctx.fillRect(0, 200, canvas.width, 120);

  ctx.fillStyle = "#FFD43B";
  ctx.font = "bold 48px Arial";
  ctx.fillText("GREAT JOB!", canvas.width / 2 - 150, 270);
}

// ================================
// MAIN LOOP
// ================================
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateCamera(); // 🎥 subtle motion

  if (gameState === "playing") {
    updateBall();
  }

  drawMiniMap();
  drawBronxGlow();

  if (gameState === "end") {
    drawEndScreen();
  }

  animationId = requestAnimationFrame(loop);
}

// ================================
// INIT
// ================================
function init() {
  const startBtn = document.getElementById("startBtn");
  if (startBtn) startBtn.onclick = startGame;

  loop();
}

init();

