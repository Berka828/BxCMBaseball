// --- 1. SETTINGS & SETUP ---
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const PITCHER_Y = 0.45; 
const PLATE_Y = 0.88;   
const PLAYER_SCALE = 0.35; 

let detector = null;
let ball = null;
let batTip = { x: 0, y: 0 }, batBase = { x: 0, y: 0 };
let batVelocity = { x: 0, y: 0 };
let prevTip = null;

let pitchesLeft = 10;
let hits = 0;
let homeRuns = 0;
let feedback = { text: "", color: "#fff", timer: 0 };

// --- 2. PITCHING & 3D PHYSICS ---

function createPitch() {
  if (pitchesLeft <= 0 || ball) return;
  const speed = parseFloat(document.getElementById("pitchSpeed")?.value || "12");
  ball = {
    x: canvas.width / 2,
    y: canvas.height * PITCHER_Y,
    z: 0,
    vz: speed * 0.0018, // Slightly faster for a snappier feel
    size: 4,
    hit: false,
    vx: 0, vy: 0
  };
}

function updateBall() {
  if (!ball) return;
  if (!ball.hit) {
    ball.z += ball.vz;
    ball.size = 4 + (ball.z * 50); 
    ball.y = (canvas.height * PITCHER_Y) + (ball.z * (canvas.height * (PLATE_Y - PITCHER_Y)));
    if (ball.z > 1.15) {
      triggerFeedback("MISS", "#ff4757");
      ball = null;
      pitchesLeft--;
      setTimeout(createPitch, 1200);
    }
  } else {
    ball.z -= 0.06;
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vy += 0.5;
    ball.size *= 0.95;
    if (ball.z < -0.5 || ball.y > canvas.height + 100) {
      ball = null;
      setTimeout(createPitch, 1200);
    }
  }
}

// --- 3. THE BAT & HIT LOGIC ---

function drawBat(wrist, elbow) {
  const dx = wrist.x - elbow.x;
  const dy = wrist.y - elbow.y;
  const angle = Math.atan2(dy, dx);
  const batLength = 160;

  batBase = { x: wrist.x, y: wrist.y };
  batTip = { 
    x: wrist.x + Math.cos(angle) * batLength, 
    y: wrist.y + Math.sin(angle) * batLength 
  };

  ctx.save();
  const grad = ctx.createLinearGradient(batBase.x, batBase.y, batTip.x, batTip.y);
  grad.addColorStop(0, "#5d4037"); 
  grad.addColorStop(0.8, "#d7ccc8"); 
  
  ctx.shadowBlur = 5;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.strokeStyle = grad;
  ctx.lineWidth = 12; 
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(batBase.x, batBase.y);
  ctx.lineTo(batTip.x, batTip.y);
  ctx.stroke();
  ctx.restore();

  if (prevTip) batVelocity = { x: batTip.x - prevTip.x, y: batTip.y - prevTip.y };
  prevTip = { ...batTip };

  // Hit Check
  if (ball && !ball.hit && ball.z > 0.85 && ball.z < 1.1) {
    if (Math.hypot(ball.x - batTip.x, ball.y - batTip.y) < 90) {
      ball.hit = true;
      hits++;
      pitchesLeft--;
      ball.vx = (batVelocity.x / 10);
      ball.vy = -15 - (Math.abs(batVelocity.y) / 8);
      
      if (Math.abs(ball.vy) > 20) { homeRuns++; triggerFeedback("HOME RUN!", "#ffd32a"); }
      else triggerFeedback("HIT!", "#2ecc71");
      updateHud();
    }
  }
}

// --- 4. PLAYER & MIRRORING ---

function drawPlayer(pose) {
  // CORRECTED MIRRORING: 
  // In the side-view, we flipped X. 
  // In the Catcher's View, X should be direct to feel like a mirror
  const scaleX = (canvas.width / 640); 
  const scaleY = (canvas.height / 480);

  const points = {};
  pose.keypoints.forEach(kp => {
    if (kp.score > 0.4) {
      // Direct mapping for natural mirror feel
      points[kp.name] = { 
        x: kp.x * scaleX, 
        y: kp.y * scaleY 
      };
    }
  });

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 2; 

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

  // Always use the wrist closest to the "front" for the bat
  if (points.right_wrist && points.right_elbow) {
    drawBat(points.right_wrist, points.right_elbow);
  } else if (points.left_wrist && points.left_elbow) {
    drawBat(points.left_wrist, points.left_elbow);
  }
  ctx.restore();
}

// --- 5. VISUALS & LOOP ---

function drawBackground() {
  ctx.fillStyle = "#0a192f"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height * PITCHER_Y);
  ctx.fillStyle = "#112240"; 
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, canvas.height * PITCHER_Y);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.fill();
}

function triggerFeedback(msg, color) { feedback = { text: msg, color: color, timer: 60 }; }
function updateHud() {
  document.getElementById("pitchesEl").textContent = pitchesLeft;
  document.getElementById("hitsEl").textContent = hits;
  document.getElementById("homeRunsEl").textContent = homeRuns;
}

async function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  const poses = await detector.estimatePoses(video, {flipHorizontal: true});
  if (poses.length > 0) drawPlayer(poses[0]);
  updateBall();
  if (ball) {
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fill();
  }
  if (feedback.timer > 0) {
    ctx.fillStyle = feedback.color;
    ctx.font = "900 70px 'Baloo 2'";
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
  detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet);
  createPitch();
  loop();
}

document.getElementById("splashStartBtn").onclick = () => {
  document.getElementById("splashScreen").classList.add("hidden");
  init();
};
