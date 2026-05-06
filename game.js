const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const miniMapCanvas = document.getElementById("miniMapCanvas");
const miniCtx = miniMapCanvas ? miniMapCanvas.getContext("2d") : null;

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const muteBtn = document.getElementById("muteBtn");
const rightHandBtn = document.getElementById("rightHandBtn");
const leftHandBtn = document.getElementById("leftHandBtn");

const easyBtn = document.getElementById("easyBtn");
const mediumBtn = document.getElementById("mediumBtn");
const hardBtn = document.getElementById("hardBtn");

const splashScreen = document.getElementById("splashScreen");
const splashStartBtn = document.getElementById("splashStartBtn");

const scoreEl = document.getElementById("scoreEl");
const pitchesEl = document.getElementById("pitchesEl");
const hitsEl = document.getElementById("hitsEl");
const missesEl = document.getElementById("missesEl");
const veloEl = document.getElementById("veloEl");
const instructionChip = document.getElementById("instructionChip");

const homeRunsEl = document.getElementById("homeRunsEl");
const bestHitEl = document.getElementById("bestHitEl");

const pitchSpeedSlider = document.getElementById("pitchSpeed");
const swingThresholdSlider = document.getElementById("swingThreshold");
const pitchDelaySlider = document.getElementById("pitchDelay");

const pitchSpeedVal = document.getElementById("pitchSpeedVal");
const swingThresholdVal = document.getElementById("swingThresholdVal");
const pitchDelayVal = document.getElementById("pitchDelayVal");

const controlDock = document.getElementById("controlDock");

const DIFFICULTIES = {
  easy: { pitchSpeed: 8.0, swingThreshold: 300, pitchDelay: 4.0, ballScale: 1.45, contactDistance: 88 },
  medium: { pitchSpeed: 8.5, swingThreshold: 400, pitchDelay: 3.7, ballScale: 1.20, contactDistance: 74 },
  hard: { pitchSpeed: 9.5, swingThreshold: 500, pitchDelay: 3.2, ballScale: 1.00, contactDistance: 62 }
};

const MODES = {
  kid: {
    contactBoost: 1.18,
    powerBoost: 1.10,
    gravityBoost: 0.92,
    label: "KID MODE"
  },
  pro: {
    contactBoost: 0.96,
    powerBoost: 1.00,
    gravityBoost: 1.06,
    label: "PRO MODE"
  }
};

let difficulty = "medium";
let detector = null;
let animationId = null;
let gameState = "start";
let battingSide = "right";

let startInProgress = false;

let score = 0;
let hits = 0;
let misses = 0;
let homeRuns = 0;
let pitchesLeft = 10;
const roundPitches = 10;

let bestDistanceFt = 0;
let currentDistanceFt = 0;

let prevBatPoint = null;
let batVelocity = { x: 0, y: 0, speed: 0 };
let lastBatTip = null;
let lastBatSegment = null;

let ball = null;
let hitText = "";
let hitTextTimer = 0;
let flashTimer = 0;
let timingText = "";
let timingTextTimer = 0;
let distanceText = "";
let distanceTextTimer = 0;
let missText = "";
let missTextTimer = 0;

let confetti = [];
let floatingStars = [];
let homerBursts = [];
let homerTrailParticles = [];
let batTrail = [];

let pitchTimer = null;
let countdownTimer = null;
let summaryTimer = null;
let countdownActive = false;
let countdownValue = 5;

let turtleImg = new Image();
turtleImg.src = "./happy-turtle-cartoon-generated-by-ai_942243-2745 (1).png";

let bronxGlowTimer = 0;

let introChimePlayed = false;
let turtleEntranceOffset = 180;
let turtleFloatPhase = 0;
let bronxIntroShimmer = 0;

let roundSummary = null;
let showRoundComplete = false;
let roundCompleteTimer = 0;

let screenShakeTimer = 0;
let screenShakeAmount = 0;

l
