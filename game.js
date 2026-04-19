// --- 1. CORE CONFIG & GLOBALS ---
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Game Constants
const BALL_RADIUS = 15;
const PITCHER_Y = 0.45; // Vanishing point (mound)
const BATTER_Y = 0.85;  // Impact point (plate)
const PLAYER_SCALE = 0.45;

// Game State
let detector = null;
let animationId = null;
let gameState = "playing"; // start, playing, countdown
let pitchesLeft = 10;
let hits = 0;
let homeRuns = 0;
let bestDistance = 0;

let ball = null;
let batTip = { x: 0, y: 0 };
let lastBatSegment = null;
let batVelocity = { x: 0, y: 0, speed: 0 };
let prevBatPoint = null;

// UI Feedback
let feedbackText = "";
let feedbackTimer = 0;
let feedbackColor = "#fff";

// --- 2. THE 3D PHYSICS ENGINE ---

function createPitch() {
  if (pitchesLeft <= 0 || ball) return;

  const speed = parseFloat(document.getElementById("pitchSpeed")?.value || "10");
  
  ball = {
    x: canvas.width / 2, // Starts at center mound
    y: canvas.height * PITCHER_Y,
    z: 0,                // 0 = far away, 1 = at the batter
    vz: speed * 0.0012,  // Slower, manageable speed for kids
    size: 4,             // Starts tiny
    active: true,
    hit: false,
    vx: 0,               // Horizontal movement after hit
    vy: 0                // Vertical movement after hit
  };
}

function updateBall() {
  if (!ball) return;

  if (!ball.hit) {
    // APPROACHING THE PLATE
    ball.z += ball.vz;
    
    // As Z grows, X and Y expand toward the foreground
    ball.size = 4 + (ball.z * 40); 
    ball.y = (canvas.height * PITCHER_Y) + (ball.z * (canvas.height * (BATTER_Y - PITCHER_Y)));

    // Miss detection
    if (ball.z > 1.2) {
      showFeedback("MISS!", "#ff4757");
      ball = null;
      pitchesLeft--;
      setTimeout(createPitch, 1500);
    }
  } else {
    // BALL WAS HIT (Flipping back into the field)
    ball.z -= 0.04;
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vy += 0.5; // Gravity
    ball.size *= 0.97;

    if (ball.z < -0.5 || ball.y > canvas.height + 100) {
      ball = null;
      setTimeout(createPitch, 1500);
    }
  }
}

// --- 3. HIT DETECTION & MIRRORING ---

function tryHit(currentBatTip) {
  if (!ball || ball.hit) return;

  // TIMING CHECK: Ball must be at the plate (Z between 0.85 and 1.05)
  const inHittingZone = ball.z > 0.85 && ball.z < 1.1;
  if (!inHittingZone) return;

  // DISTANCE CHECK: Is the bat tip near the ball's center?
  const dist = Math.hypot(ball.x - currentBatTip.x, ball.y - currentBatTip.y);
  
  if (dist < 100) { // Forgiving hit box for kids
    ball.hit = true;
    hits++;
    pitchesLeft--;
    
    // Physics of the hit
    ball.vx = (batVelocity.x / 40);
    ball.vy = -15 - (Math.abs(batVelocity.y) / 20);
    
    const isHomeRun = Math.abs(ball.vy) > 20;
    if (isHomeRun) {
        homeRuns++;
        showFeedback("HOME RUN!", "#ffd32a");
    } else {
        showFeedback("HIT!", "#2ecc71");
    }
    updateHud();
  }
}

// --- 4. POSE & DRAWING ---

function transformPose(pose) {
  // 1. Get keypoints
  const rw = pose.keypoints.find(k => k.name === "right_wrist");
  const re = pose.keypoints.find(k => k.name === "right_elbow");
  
  if (!rw || rw.score < 0.3) return;

  // 2. Mirror and Scale
  // We mirror by subtracting X from video width
  const mirroredX = (640 - rw.x) * (canvas.width / 640);
  const mirroredY = rw.y * (canvas.height / 480);

  // 3. Center the player
  const centerX = canvas.width / 2;
  const centerY = canvas.height * BATTER_Y;

  batTip = { x: mirroredX, y: mirroredY };
  
  // Calculate Velocity
  if (prevBatPoint) {
    batVelocity = {
        x: batTip.x - prevBatPoint.x,
        y: batTip.y - prevBatPoint.y,
        speed: Math.hypot(batTip.x - prevBatPoint.x, batTip.y - prevBatPoint.y)
    };
  }
  prevBatPoint = { ...batTip };

  tryHit(batTip);
}

function draw() {
  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw 3D Field (Catcher's View)
  // Sky
  ctx.fillStyle = "#1e3799";
  ctx.fillRect(0, 0, canvas.width, canvas.height * PITCHER_Y);
  
  // Grass (Tapered for depth)
  ctx.fillStyle = "#27ae60";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, canvas.height * PITCHER_Y);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();

  // Mound
  ctx.fillStyle = "#a4b0be";
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height * PITCHER_Y, 40, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw Ball
  if (ball) {
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fill();
    // Stitching
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size * 0.8, 0.5, 2.5);
    ctx.stroke();
  }

  // Draw Bat (Your Hand Position)
  ctx.fillStyle = "#f39c12";
  ctx.beginPath();
  ctx.arc(batTip.x, batTip.y, 20, 0, Math.PI * 2);
  ctx.fill();

  // Feedback Text
  if (feedbackTimer > 0) {
    ctx.fillStyle = feedbackColor;
    ctx.font = "900 60px 'Baloo 2'";
    ctx.textAlign = "center";
    ctx.fillText(feedbackText, canvas.width / 2, canvas.height / 3);
    feedbackTimer--;
  }

  updateBall();
  requestAnimationFrame(draw);
}

// --- 5. INITIALIZATION ---

function showFeedback(text, color) {
    feedbackText = text;
    feedbackColor = color;
    feedbackTimer = 60;
}

function updateHud() {
    document.getElementById("pitchesEl").textContent = pitchesLeft;
    document.getElementById("hitsEl").textContent = hits;
    document.getElementById("homeRunsEl").textContent = homeRuns;
}

async function init() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  await tf.ready();
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );

  setInterval(async () => {
    const poses = await detector.estimatePoses(video);
    if (poses.length > 0) transformPose(poses[0]);
  }, 30);

  createPitch();
  draw();
}

document.getElementById("splashStartBtn").onclick = () => {
    document.getElementById("splashScreen").classList.add("hidden");
    init();
};
