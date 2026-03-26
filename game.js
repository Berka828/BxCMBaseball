const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const miniMapCanvas = document.getElementById("miniMapCanvas");
const miniCtx = miniMapCanvas.getContext("2d");

// UI Elements
const splashScreen = document.getElementById("splashScreen");
const splashStartBtn = document.getElementById("splashStartBtn");
const startBtn = document.getElementById("startBtn");
const instructionChip = document.getElementById("instructionChip");
const scoreEl = document.getElementById("scoreEl");
const pitchesEl = document.getElementById("pitchesEl");
const homeRunsEl = document.getElementById("homeRunsEl");

// Game State
let detector = null;
let animationId = null;
let gameState = "start"; // start | countdown | playing | paused
let score = 0;
let pitchesLeft = 10;
let homeRuns = 0;
let countdownValue = 3;

// Physics & Assets
let ball = null;
let stadiumBg = new Image();
let stadiumBgLoaded = false;
stadiumBg.onload = () => { stadiumBgLoaded = true; };
stadiumBg.src = "./stadium-bg.png";

const BALL_RADIUS = 12;
const GRAVITY = 0.4;
const PITCH_SPEED = 12;

// ---------- INITIALIZATION ----------

async function startOrResumeGame() {
    if (splashScreen) splashScreen.classList.add("hidden");
    if (instructionChip) instructionChip.textContent = "Loading AI & Camera...";

    try {
        if (!detector) {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: 1280, height: 720 },
                audio: false
            });
            video.srcObject = stream;
            await video.play();

            await tf.ready();
            detector = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
            );
        }
        
        resetGame();
        startCountdown();
        if (!animationId) loop();
    } catch (e) {
        console.error(e);
        alert("Startup failed. Please ensure camera access is allowed.");
    }
}

function resetGame() {
    score = 0;
    pitchesLeft = 10;
    homeRuns = 0;
    ball = null;
    updateHud();
}

function updateHud() {
    if (scoreEl) scoreEl.textContent = score;
    if (pitchesEl) pitchesEl.textContent = pitchesLeft;
    if (homeRunsEl) homeRunsEl.textContent = homeRuns;
}

function startCountdown() {
    gameState = "countdown";
    countdownValue = 3;
    const tick = () => {
        if (countdownValue > 0) {
            if (instructionChip) instructionChip.textContent = `Get Ready... ${countdownValue}`;
            countdownValue--;
            setTimeout(tick, 1000);
        } else {
            gameState = "playing";
            if (instructionChip) instructionChip.textContent = "SWING!";
            spawnBall();
        }
    };
    tick();
}

// ---------- GAMEPLAY ----------

function spawnBall() {
    if (pitchesLeft <= 0) {
        gameState = "start";
        if (instructionChip) instructionChip.textContent = "Game Over! Press Start to play again.";
        return;
    }
    ball = {
        x: canvas.width + 50,
        y: canvas.height * 0.6,
        vx: -PITCH_SPEED,
        vy: (Math.random() - 0.5) * 2,
        hit: false
    };
}

function checkHit(points) {
    if (!ball || ball.hit) return;

    // We check the wrists from the MoveNet points
    const wrist = points.right_wrist || points.left_wrist;
    if (!wrist) return;

    const dist = Math.hypot(ball.x - wrist.x, ball.y - wrist.y);
    
    // If "bat" (wrist) is close to ball and moving fast
    if (dist < 80) {
        ball.hit = true;
        ball.vx = 15 + Math.random() * 10;
        ball.vy = -10 - Math.random() * 10;
        
        score += 100;
        if (ball.vy < -15) {
            homeRuns++;
            if (instructionChip) instructionChip.textContent = "HOME RUN!!";
        }
        pitchesLeft--;
        updateHud();
    }
}

// ---------- DRAWING ----------

function drawFieldMap() {
    const w = miniMapCanvas.width;
    const h = miniMapCanvas.height;
    
    miniCtx.clearRect(0, 0, w, h);
    
    // Draw Grass
    miniCtx.fillStyle = "#2d5a27";
    miniCtx.beginPath();
    miniCtx.moveTo(w/2, h - 10); // Home
    miniCtx.lineTo(10, h/2);     // 3rd
    miniCtx.lineTo(w/2, 10);     // Center field
    miniCtx.lineTo(w - 10, h/2); // 1st
    miniCtx.closePath();
    miniCtx.fill();
    miniCtx.strokeStyle = "white";
    miniCtx.stroke();

    // Draw Ball on Map
    if (ball) {
        // Map main X to mini X, main Y to mini Y
        const miniX = (ball.x / canvas.width) * w;
        const miniY = (ball.y / canvas.height) * h;
        
        miniCtx.fillStyle = "white";
        miniCtx.shadowBlur = 5;
        miniCtx.shadowColor = "white";
        miniCtx.beginPath();
        miniCtx.arc(miniX, miniY, 4, 0, Math.PI * 2);
        miniCtx.fill();
        miniCtx.shadowBlur = 0;
    }
}

async function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Background
    if (stadiumBgLoaded) {
        ctx.drawImage(stadiumBg, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = "#333";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. AI Tracking
    if (detector && (gameState === "playing" || gameState === "countdown")) {
        const poses = await detector.estimatePoses(video, { flipHorizontal: true });
        if (poses.length > 0) {
            const p = poses[0].keypoints.reduce((acc, k) => {
                if (k.score > 0.3) acc[k.name] = k;
                return acc;
            }, {});
            
            // Draw simple joints for feedback
            ctx.fillStyle = "cyan";
            for (let name in p) {
                ctx.beginPath();
                ctx.arc(p[name].x, p[name].y, 5, 0, Math.PI*2);
                ctx.fill();
            }
            if (gameState === "playing") checkHit(p);
        }
    }

    // 3. Ball Physics
    if (ball) {
        ball.x += ball.vx;
        ball.y += ball.vy;
        if (ball.hit) ball.vy += GRAVITY;

        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Reset ball if it leaves screen
        if (ball.x < -50 || ball.x > canvas.width + 100 || ball.y > canvas.height + 50) {
            if (!ball.hit) {
                pitchesLeft--;
                updateHud();
            }
            ball = null;
            setTimeout(spawnBall, 1000);
        }
    }

    // 4. Update Minimap
    drawFieldMap();

    animationId = requestAnimationFrame(loop);
}

// ---------- LISTENERS ----------

if (splashStartBtn) splashStartBtn.onclick = startOrResumeGame;
if (startBtn) startBtn.onclick = startOrResumeGame;
