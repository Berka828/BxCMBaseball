// --- 1. SETTINGS & SETUP ---
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Layout Constants
const PITCHER_Y = 0.45; // Depth vanishing point
const PLATE_Y = 0.88;   // Where the ball crosses the batter
const PLAYER_SCALE = 0.42;

// State Variables
let detector = null;
let animationId = null;
let gameState = "playing"; 
let ball = null;
let batTip = { x: 0, y: 0 };
let batBase = { x: 0, y: 0 };
let lastBatSegment = null;
let batVelocity = { x: 0, y: 0, speed: 0 };
let prevTip = null;
let playerSilhouette = null;

// Stats
let pitchesLeft = 10;
let hits = 0;
let homeRuns = 0;
let feedback = { text: "", color: "#fff", timer: 0 };

// --- 2. PITCHING & 3D PHYSICS ---

function createPitch() {
  if (pitchesLeft <= 0 || ball) return;

  const speed = parseFloat(document.getElementById("pitchSpeed")?.value || "12");
  
  ball = {
    x: canvas.width / 2, // Mound center
    y: canvas.height * PITCHER_Y,
    z: 0,                // 0 (far) to 1.0 (at batter)
    vz: speed * 0.0014,  // Approach speed
    size: 4,             // Initial scale
    hit: false,
    vx: 0, vy: 0         // Exit velocity
  };
}

function updateBall() {
  if (!ball) return;

  if (!ball.hit) {
    ball.z += ball.vz;
    // Scale ball size and position for 3D depth
    ball.size = 4 + (ball.z * 50); 
    ball.y = (canvas.height * PITCHER_Y) + (ball.z * (canvas.height * (PLATE_Y - PITCHER_Y)));

    // Miss if it goes past the screen
    if (ball.z > 1.15) {
      triggerFeedback("MISS", "#ff4757");
      ball = null;
      pitchesLeft--;
      setTimeout(createPitch, 1500);
    }
  } else {
    // Hit logic: Fly away into the distance
    ball.z -= 0.05;
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vy += 0.4; // Gravity
    ball.size *= 0.96;

    if (ball.z < -0.5 || ball.y > canvas.height + 100) {
      ball = null;
      setTimeout(createPitch, 1500);
    }
  }
}

// --- 3. THE "BAT" & HIT DETECTION ---

function drawBat(wrist, elbow) {
  // Calculate bat direction based on forearm
  const dx = wrist.x - elbow.x;
  const dy = wrist.y - elbow.y;
  const angle = Math.atan2(dy, dx);
  const batLength = 160;

  batBase = { x: wrist.x, y: wrist.y };
  batTip = { 
    x: wrist.x + Math.cos(angle) * batLength, 
    y: wrist.y + Math.sin(angle) * batLength 
  };

  // Draw Bat Barrel
  ctx.save();
  ctx.lineCap = "round";
  
  // Shadow
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 25;
  ctx.beginPath();
  ctx.moveTo(batBase.x, batBase.y + 10);
  ctx.lineTo(batTip.x, batTip.y + 10);
  ctx.stroke();

  // Bat Color Gradient
  const grad = ctx.createLinearGradient(batBase.x, batBase.y, batTip.x, batTip.y);
  grad.addColorStop(0, "#8d6e63"); // Handle
  grad.addColorStop(0.7, "#d7ccc8"); // Barrel
  grad.addColorStop(1, "#a1887f"); // Tip

  ctx.strokeStyle = grad;
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.moveTo(batBase.x, batBase.y);
  ctx.lineTo(batTip.x, batTip.y);
  ctx.stroke();
  ctx.restore();

  // Track velocity for hit power
  if (prevTip) {
    batVelocity = { x: batTip.x - prevTip.x, y: batTip.y - prevTip.y };
  }
  prevTip = { ...batTip };

  checkContact();
}

function checkContact() {
  if (!ball || ball.hit) return;

  // Depth Check: Must be in the hitting zone
  const inZone = ball.z > 0.88 && ball.z < 1.08;
  if (!inZone) return;

  // Collision: Distance from bat tip to ball
  const dist = Math.hypot(ball.x - batTip.x, ball.y - batTip.y);
  
  if (dist < 90) { // Forgiving hit box
    ball.hit = true;
    hits++;
    pitchesLeft--;

    // Exit Physics
    ball.vx = (batVelocity.x / 15);
    ball.vy = -12 - (Math.abs(batVelocity.y) / 10);

    if (Math.abs(ball.vy) > 18) {
      homeRuns++;
      triggerFeedback("HOME RUN!", "#ffd32a");
    } else {
      triggerFeedback("HIT!", "#2ecc71");
    }
    updateHud();
  }
}

// --- 4. PLAYER VISUALS & VIDEO ---

function drawPlayer(pose) {
  // Mirroring the MoveNet coordinates
  const scaleX = canvas.width / 640;
  const scaleY = canvas.height / 480;

  const points = {};
  pose.keypoints.forEach(kp => {
    if (kp.score > 0.3) {
      points[kp.name] = { x: (640 - kp.x) * scaleX, y: kp.y * scaleY };
    }
  });

  // Draw Silhouette Glow
  ctx.strokeStyle = "rgba(0, 255, 255, 0.4)";
  ctx.lineWidth = 8;
  ctx.shadowBlur = 15;
  ctx.shadowColor = "cyan";

  // Simple skeleton logic
  const bones = [
    ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_elbow"],
    ["left_elbow", "left_wrist"], ["right_shoulder", "right_elbow"],
    ["right_elbow", "right_wrist"], ["left_shoulder", "left_hip"],
    ["right_shoulder", "right_hip"], ["left_hip", "right_hip"]
  ];

  bones.forEach(([a, b]) => {
    if (points[a] && points[b]) {
      ctx.beginPath();
      ctx.moveTo(points[a].x, points[a].y);
      ctx.lineTo(points[b].x, points[b].y);
      ctx.stroke();
    }
  });

  // Attach Bat to Wrist
  if (points.right_wrist && points.right_elbow) {
    drawBat(points.right_wrist, points.right_elbow);
  }
}

function drawBackground() {
  // Sky
  ctx.fillStyle = "#0c2461";
  ctx.fillRect(0, 0, canvas.width, canvas.height * PITCHER_Y);
  
  // Field Depth
  ctx.fillStyle = "#0a3d62";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, canvas.height * PITCHER_Y);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.fill();

  // Plate
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 40, canvas.height * PLATE_Y);
  ctx.lineTo(canvas.width / 2 + 40, canvas.height * PLATE_Y);
  ctx.lineTo(canvas.width / 2 + 60, canvas.height * PLATE_Y + 30);
  ctx.lineTo(canvas.width / 2 - 60, canvas.height * PLATE_Y + 30);
  ctx.fill();
}

// --- 5. LOOP & INIT ---

function triggerFeedback(msg, color) {
  feedback = { text: msg, color: color, timer: 60 };
}

function updateHud() {
  document.getElementById("pitchesEl").textContent = pitchesLeft;
  document.getElementById("hitsEl").textContent = hits;
  document.getElementById("homeRunsEl").textContent = homeRuns;
}

async function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  const poses = await detector.estimatePoses(video);
  if (poses.length > 0) drawPlayer(poses[0]);

  updateBall();

  // Draw Ball
  if (ball) {
    ctx.save();
    ctx.fillStyle = "white";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "white";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw Feedback
  if (feedback.timer > 0) {
    ctx.fillStyle = feedback.color;
    ctx.font = "900 80px 'Baloo 2'";
    ctx.textAlign = "center";
    ctx.fillText(feedback.text, canvas.width / 2, canvas.height / 3);
    feedback.timer--;
  }

  requestAnimationFrame(loop);
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

  createPitch();
  loop();
}

document.getElementById("splashStartBtn").onclick = () => {
    document.getElementById("splashScreen").classList.add("hidden");
    init();
};
