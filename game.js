// ================================
// DOM REFERENCES
// ================================
const canvas = document.getElementById("canvas");
const ctx = canvas ? canvas.getContext("2d") : null;

const startBtn = document.getElementById("startBtn");
const splashStartBtn = document.getElementById("splashStartBtn");
const splashScreen = document.getElementById("splashScreen");

// ================================
// GLOBALS
// ================================
let animationId = null;
let gameState = "start";
let ball = null;
let pitchesLeft = 10;

let cameraZoom = 1;
let cameraPan = 0;

let audioCtx = null;
let bronxGlowTimer = 0;

// ================================
// SAFETY CHECK
// ================================
if (!canvas || !ctx) {
  console.error("Canvas element or 2D context not found.");
}

// ================================
// CANVAS SIZING
// ================================
function resizeCanvas() {
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width || window.innerWidth;
  canvas.height = rect.height || window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);

// ================================
// AUDIO
// ================================
function initAudio() {
  try {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioCtx = new AudioCtx();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  } catch (err) {
    console.warn("Audio init failed:", err);
  }
}

function getAnnouncerVoice() {
  const voices = speechSynthesis.getVoices();

  return (
    voices.find(v => /en-US/i.test(v.lang) && /david|mark|alex|guy|male/i.test(v.name)) ||
    voices.find(v => /en-US/i.test(v.lang)) ||
    voices[0] ||
    null
  );
}

function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;

    const utter = new SpeechSynthesisUtterance(text);
    const voice = getAnnouncerVoice();

    if (voice) utter.voice = voice;
    utter.rate = 1.05;
    utter.pitch = 0.9;
    utter.volume = 1.0;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn("Speech failed:", err);
  }
}

function playBeep(freq = 440, duration = 0.15, volume = 0.08) {
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "triangle";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// ================================
// START GAME
// ================================
async function startGame(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  try {
    initAudio();

    if (startBtn) startBtn.disabled = true;
    if (splashStartBtn) splashStartBtn.disabled = true;

    // announcer BEFORE first pitch
    speak("Let's play ball!");
    playBeep(740, 0.18, 0.09);

    await new Promise(resolve => setTimeout(resolve, 1200));

    gameState = "playing";
    pitchesLeft = 10;
    createPitch();

    if (splashScreen) {
      splashScreen.classList.add("hidden");
    }
  } catch (err) {
    console.error("Start failed:", err);
    alert("Start failed: " + err.message);
  } finally {
    if (startBtn) startBtn.disabled = false;
    if (splashStartBtn) splashStartBtn.disabled = false;
  }
}

// ================================
// CAMERA
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
// PITCH
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
    radius: 14,
    hit: false
  };
}

// ================================
// UPDATE BALL
// ================================
function updateBall() {
  if (!ball) return;

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < strikeZone.x) {
    miss();
  }
}

// ================================
// MISS
// ================================
function miss() {
  speak("Strike!");
  playBeep(280, 0.16, 0.08);
  ball = null;

  pitchesLeft--;

  if (pitchesLeft > 0) {
    setTimeout(() => {
      if (gameState === "playing" && !ball) createPitch();
    }, 900);
  } else {
    gameState = "end";
  }
}

// ================================
// HOMERUN EFFECT
// ================================
function triggerHomeRun() {
  bronxGlowTimer = 120;
  speak("Home run!");
  playBeep(900, 0.18, 0.09);
  playBeep(1200, 0.22, 0.08);

  ball = null;
  pitchesLeft--;

  if (pitchesLeft <= 0) {
    gameState = "end";
  } else {
    setTimeout(() => {
      if (gameState === "playing" && !ball) createPitch();
    }, 1200);
  }
}

function drawBronxGlow() {
  if (bronxGlowTimer <= 0) return;

  const letters = ["B", "R", "O", "N", "X"];

  letters.forEach((letter, i) => {
    const active = bronxGlowTimer > 120 - (i + 1) * 14;

    ctx.save();
    ctx.font = '900 42px "Arial"';
    ctx.textAlign = "center";
    ctx.fillStyle = active ? "#FFD43B" : "#6b5e1a";
    ctx.shadowBlur = active ? 18 : 0;
    ctx.shadowColor = active ? "#FFD43B" : "transparent";
    ctx.fillText(letter, 220 + i * 42, 78);
    ctx.restore();
  });

  bronxGlowTimer--;
}

// ================================
// DRAW BACKGROUND
// ================================
function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#04152c");
  grad.addColorStop(1, "#000000");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // subtle stars / particles
  for (let i = 0; i < 18; i++) {
    const x = (i * 97 + cameraPan * 8) % (canvas.width + 80);
    const y = 40 + (i * 61) % (canvas.height * 0.7);
    const r = 2 + (i % 3);
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,212,59,0.35)" : "rgba(37,169,255,0.30)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // simple field strip
  ctx.fillStyle = "rgba(46,213,115,0.18)";
  ctx.fillRect(0, canvas.height * 0.72, canvas.width, canvas.height * 0.28);

  // strike lane
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, strikeZone.y);
  ctx.lineTo(canvas.width - 80, strikeZone.y);
  ctx.stroke();
}

// ================================
// DRAW BALL
// ================================
function drawBall() {
  if (!ball) return;

  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#d0d7de";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius - 2, 0.5, 2.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius - 2, 3.7, 5.5);
  ctx.stroke();
  ctx.restore();
}

// ================================
// MINI MAP
// ================================
function drawMiniMap() {
  ctx.save();
  ctx.fillStyle = "rgba(8,18,40,0.75)";
  ctx.fillRect(20, 20, 200, 80);

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.strokeRect(20, 20, 200, 80);

  ctx.fillStyle = "#FFD43B";
  ctx.font = 'bold 14px Arial';
  ctx.fillText("BALL PATH", 34, 44);

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.moveTo(40, 68);
  ctx.lineTo(200, 68);
  ctx.stroke();

  if (ball) {
    const mappedX = 40 + ((pitchStart.x - ball.x) / (pitchStart.x - strikeZone.x)) * 160;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(mappedX, 68, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ================================
// END SCREEN
// ================================
function drawEndScreen() {
  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#7D4DFF";
  ctx.fillRect(0, canvas.height * 0.38, canvas.width, 120);

  ctx.fillStyle = "#FFD43B";
  ctx.font = '900 48px Arial';
  ctx.textAlign = "center";
  ctx.fillText("GREAT JOB!", canvas.width / 2, canvas.height * 0.38 + 74);

  ctx.restore();
}

// ================================
// MAIN LOOP
// ================================
function loop() {
  if (!ctx || !canvas) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateCamera();
  drawBackground();

  if (gameState === "playing") {
    updateBall();
    drawBall();
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
  resizeCanvas();

  if (startBtn) {
    startBtn.onclick = startGame;
    startBtn.addEventListener("click", startGame);
  }

  if (splashStartBtn) {
    splashStartBtn.onclick = startGame;
    splashStartBtn.addEventListener("click", startGame);
  }

  if ("speechSynthesis" in window) {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  }

  loop();
}

init();
