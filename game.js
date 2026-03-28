window.addEventListener("DOMContentLoaded", () => {
  const splash = document.getElementById("splash");
  const startBtn = document.getElementById("startBtn");
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  if (!splash || !startBtn || !canvas) {
    console.error("Missing required DOM elements.");
    return;
  }

  let width = 0;
  let height = 0;

  function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  const TOTAL_PITCHES = 5;

  let gameStarted = false;
  let gameOver = false;
  let paused = false;
  let countdownActive = false;
  let countdownValue = 5;

  let score = 0;
  let hits = 0;
  let misses = 0;
  let homeRuns = 0;
  let pitchesLeft = TOTAL_PITCHES;

  let currentMessage = "";
  let currentSubMessage = "";
  let messageUntil = 0;

  let ball = null;
  let nextPitchTimer = null;
  let summaryReady = false;

  let displayDistance = 0;
  let targetDistance = 0;
  let bestDistance = 0;

  let swingFlash = 0;
  let particles = [];
  let homeRunGlow = 0;

  const PLAYER_X = () => width * 0.20;
  const PLAYER_Y = () => height * 0.76;
  const PLAYER_SCALE = () => Math.min(width, height) * 0.00115;
  const CONTACT_X = () => width * 0.33;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clearNextPitchTimer() {
    if (nextPitchTimer) {
      clearTimeout(nextPitchTimer);
      nextPitchTimer = null;
    }
  }

  function showMessage(title, subtitle = "", duration = 3200) {
    currentMessage = title;
    currentSubMessage = subtitle;
    messageUntil = performance.now() + duration;
  }

  function isMessageVisible(now) {
    return now < messageUntil;
  }

  function getPitchZoneTop() {
    return height * 0.58;
  }

  function getPitchZoneBottom() {
    return height * 0.72;
  }

  function getRandomPitchY() {
    return getPitchZoneTop() + Math.random() * (getPitchZoneBottom() - getPitchZoneTop());
  }

  function resetRound() {
    clearNextPitchTimer();

    score = 0;
    hits = 0;
    misses = 0;
    homeRuns = 0;
    pitchesLeft = TOTAL_PITCHES;

    currentMessage = "";
    currentSubMessage = "";
    messageUntil = 0;

    ball = null;
    summaryReady = false;
    displayDistance = 0;
    targetDistance = 0;
    bestDistance = 0;

    particles = [];
    homeRunGlow = 0;
    countdownActive = false;
    countdownValue = 5;
    paused = false;
    gameOver = false;
  }

  function startGame() {
    resetRound();
    gameStarted = true;
    splash.style.display = "none";
    startCountdown();
  }

  function returnToSplash() {
    resetRound();
    gameStarted = false;
    splash.style.display = "flex";
  }

  startBtn.addEventListener("click", startGame);

  function startCountdown() {
    countdownActive = true;
    countdownValue = 5;
    ball = null;

    const tick = () => {
      if (!countdownActive) return;

      if (countdownValue > 0) {
        showMessage(String(countdownValue), "Get ready...", 700);
        countdownValue--;
        setTimeout(tick, 850);
      } else {
        countdownActive = false;
        showMessage("LET'S PLAY BALL!", "", 1100);
        setTimeout(() => {
          createPitch();
        }, 900);
      }
    };

    tick();
  }

  function createPitch() {
    if (!gameStarted || gameOver || paused) return;
    if (pitchesLeft <= 0) {
      endGame();
      return;
    }

    targetDistance = 0;
    displayDistance = 0;

    ball = {
      x: width * 0.90,
      y: getRandomPitchY(),
      vx: -10.2,
      vy: rand(-0.10, 0.10),
      radius: 14,
      hit: false,
      result: "",
      finalDistance: 0
    };

    pitchesLeft--;
  }

  function scheduleNextPitch(delay = 1800) {
    clearNextPitchTimer();
    nextPitchTimer = setTimeout(() => {
      if (!gameOver && !paused) {
        createPitch();
      }
    }, delay);
  }

  function resolveMiss(reason) {
    misses++;
    ball = null;
    targetDistance = 0;
    showMessage("MISS!", reason, 3200);

    if (pitchesLeft <= 0) {
      setTimeout(endGame, 2200);
    } else {
      scheduleNextPitch(2200);
    }
  }

  function resolveHit(kind, distance) {
    hits++;
    targetDistance = distance;
    bestDistance = Math.max(bestDistance, distance);

    let points = 0;
    let title = "";
    let subtitle = `${distance} FT`;

    if (kind === "home_run") {
      homeRuns++;
      points = 100;
      title = "HOME RUN!";
      homeRunGlow = 1;
      spawnCelebration(ball.x, ball.y, 80);
      scheduleNextPitch(4200);
    } else if (kind === "big_hit") {
      points = 60;
      title = "BIG HIT!";
      spawnCelebration(ball.x, ball.y, 36);
      scheduleNextPitch(3200);
    } else {
      points = 30;
      title = "NICE HIT!";
      spawnCelebration(ball.x, ball.y, 18);
      scheduleNextPitch(2500);
    }

    score += points;
    ball.result = kind;
    ball.finalDistance = distance;

    showMessage(title, subtitle, kind === "home_run" ? 4300 : 3000);

    if (pitchesLeft <= 0) {
      clearNextPitchTimer();
      setTimeout(endGame, kind === "home_run" ? 4500 : 3000);
    }
  }

  function swing() {
    if (!gameStarted || gameOver || paused || countdownActive) return;

    swingFlash = 1;

    if (!ball || ball.hit) return;

    const dx = Math.abs(ball.x - CONTACT_X());
    const dy = ball.y - (PLAYER_Y() - 65);

    if (ball.x < PLAYER_X() + 65) {
      resolveMiss("Too late");
      return;
    }

    if (Math.abs(dy) > 120) {
      if (dy < 0) resolveMiss("Swing too high");
      else resolveMiss("Swing too low");
      return;
    }

    if (dx < 24) {
      ball.hit = true;
      ball.vx = rand(10, 13);
      ball.vy = rand(-11, -8.3);
      resolveHit("home_run", Math.round(rand(170, 235)));
      return;
    }

    if (dx < 56) {
      ball.hit = true;
      ball.vx = rand(8.2, 10.2);
      ball.vy = rand(-8.2, -6.1);
      resolveHit("big_hit", Math.round(rand(105, 165)));
      return;
    }

    if (dx < 92) {
      ball.hit = true;
      ball.vx = rand(6.3, 8.0);
      ball.vy = rand(-5.4, -4.0);
      resolveHit("single", Math.round(rand(60, 105)));
      return;
    }

    if (ball.x > CONTACT_X()) {
      resolveMiss("Too early");
    } else {
      resolveMiss("Too late");
    }
  }

  window.addEventListener("click", swing);
  window.addEventListener("touchstart", swing, { passive: true });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();

      if (!gameStarted) return;
      if (gameOver) return;
      if (countdownActive) return;

      paused = !paused;

      if (!paused && !ball && pitchesLeft > 0) {
        scheduleNextPitch(500);
      }
    }

    if (e.code === "Enter") {
      if (!gameStarted) startGame();
    }

    if (e.code === "KeyR") {
      if (gameOver) returnToSplash();
    }
  });

  function endGame() {
    gameOver = true;
    paused = false;
    ball = null;
    summaryReady = true;

    let title = "Great Job!";
    let subtitle = `Hits: ${hits} • Home Runs: ${homeRuns} • Best: ${Math.round(bestDistance)} FT`;

    if (homeRuns >= 2) title = "Home Run Hero!";
    else if (bestDistance >= 160) title = "Rocket Hitter!";
    else if (hits >= 3) title = "Nice Swinging!";
    else if (hits === 0) title = "Keep Practicing!";

    showMessage(title, subtitle, 999999);
  }

  function spawnCelebration(x, y, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: rand(-5, 5),
        vy: rand(-8, -1),
        size: rand(4, 10),
        life: rand(35, 70),
        color: ["#FFD43B", "#25A9FF", "#7D4DFF", "#2ED573", "#FF8A00"][Math.floor(rand(0, 5))]
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.life--;

      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / 70, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.restore();
    }
  }

  function update() {
    if (!gameStarted || paused || gameOver || countdownActive) {
      updateParticles();
      displayDistance += (targetDistance - displayDistance) * 0.08;
      homeRunGlow *= 0.96;
      swingFlash *= 0.90;
      return;
    }

    updateParticles();

    if (ball) {
      if (!ball.hit) {
        ball.x += ball.vx;
        ball.y += ball.vy;

        if (ball.x < PLAYER_X() + 20) {
          resolveMiss("Too late");
        }
      } else {
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.vy += 0.25;

        if (ball.y > height + 50 || ball.x > width + 80) {
          ball = null;
        }
      }
    }

    displayDistance += (targetDistance - displayDistance) * 0.08;
    homeRunGlow *= 0.96;
    swingFlash *= 0.90;
  }

  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#08182f");
    bg.addColorStop(0.45, "#06214a");
    bg.addColorStop(1, "#04101f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#ffd43b";
    ctx.beginPath();
    ctx.arc(width * 0.10, height * 0.18, 130, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#25a9ff";
    ctx.beginPath();
    ctx.arc(width * 0.84, height * 0.22, 150, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#7d4dff";
    ctx.beginPath();
    ctx.arc(width * 0.73, height * 0.79, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (homeRunGlow > 0.02) {
      ctx.save();
      ctx.globalAlpha = homeRunGlow * 0.30;
      const glow = ctx.createLinearGradient(0, 0, width, height);
      glow.addColorStop(0, "#7D4DFF");
      glow.addColorStop(0.5, "#25A9FF");
      glow.addColorStop(1, "#FFD43B");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.04, height * 0.68);
    ctx.lineTo(width * 0.96, height * 0.68);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    const px = PLAYER_X();
    const py = PLAYER_Y();
    const s = PLAYER_SCALE();

    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = "#25A9FF";

    const torsoGrad = ctx.createLinearGradient(px, py - 140 * s, px, py + 40 * s);
    torsoGrad.addColorStop(0, "#7CF3FF");
    torsoGrad.addColorStop(1, "#00A6FF");
    ctx.fillStyle = torsoGrad;
    roundRect(ctx, px - 30 * s, py - 140 * s, 60 * s, 108 * s, 24 * s, true, false);

    ctx.fillStyle = "#A66CFF";
    ctx.beginPath();
    ctx.arc(px, py - 175 * s, 28 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#39FF88";
    ctx.lineWidth = 16 * s;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(px - 8 * s, py - 112 * s);
    ctx.lineTo(px + 32 * s, py - 88 * s);
    ctx.lineTo(px + 72 * s, py - 50 * s);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px - 12 * s, py - 112 * s);
    ctx.lineTo(px - 40 * s, py - 82 * s);
    ctx.lineTo(px - 64 * s, py - 44 * s);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px - 8 * s, py - 32 * s);
    ctx.lineTo(px - 18 * s, py + 34 * s);
    ctx.lineTo(px - 30 * s, py + 108 * s);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px + 8 * s, py - 32 * s);
    ctx.lineTo(px + 22 * s, py + 34 * s);
    ctx.lineTo(px + 38 * s, py + 108 * s);
    ctx.stroke();

    ctx.shadowBlur = 14;
    ctx.shadowColor = "#FFD43B";
    ctx.strokeStyle = "#FFD43B";
    ctx.lineWidth = 9 * s;
    ctx.beginPath();
    ctx.moveTo(px + 74 * s, py - 52 * s);
    ctx.lineTo(px + 136 * s, py - 102 * s);
    ctx.stroke();

    ctx.restore();

    if (swingFlash > 0.05) {
      ctx.save();
      ctx.globalAlpha = swingFlash * 0.30;
      ctx.strokeStyle = "#FFD43B";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(px + 64 * s, py - 62 * s, 64 * s, -1.2, 0.3);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBall() {
    if (!ball) return;

    ctx.save();

    if (ball.hit) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = ball.result === "home_run" ? "#FFD43B" : "#ffffff";
      ctx.beginPath();
      ctx.arc(ball.x - 18, ball.y + 8, ball.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ball.x - 36, ball.y + 16, ball.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = ball.result === "home_run" ? 22 : 10;
    ctx.shadowColor = ball.result === "home_run" ? "#FFD43B" : "#ffffff";

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#d7d7d7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius - 2, 0.45, 2.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius - 2, 3.7, 5.8);
    ctx.stroke();

    ctx.restore();
  }

  function drawTopTitle() {
    ctx.save();
    ctx.fillStyle = "rgba(8,18,40,0.82)";
    roundRect(ctx, 18, 16, 360, 62, 18, true, false);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 24px Arial";
    ctx.fillText("BxCM JR. SLUGGERS", 30, 42);

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "800 14px Arial";
    ctx.fillText("Swing big. Make contact. Chase the high score.", 30, 60);
    ctx.restore();
  }

  function drawBottomStats() {
    const cards = [
      { label: "Pitches", value: pitchesLeft, c1: "#FFD43B", c2: "#FFB300", dark: true },
      { label: "Hits", value: hits, c1: "#25A9FF", c2: "#007AFF", dark: false },
      { label: "Home Runs", value: homeRuns, c1: "#7D4DFF", c2: "#5F33FF", dark: false },
      { label: "Best Hit", value: `${Math.round(bestDistance)} FT`, c1: "#2ED573", c2: "#14B45A", dark: true }
    ];

    const totalWidth = Math.min(width * 0.84, 820);
    const gap = 12;
    const cardW = (totalWidth - gap * 3) / 4;
    const cardH = 82;
    const startX = (width - totalWidth) / 2;
    const y = height - 104;

    ctx.save();

    cards.forEach((c, i) => {
      const x = startX + i * (cardW + gap);
      const grad = ctx.createLinearGradient(x, y, x, y + cardH);
      grad.addColorStop(0, c.c1);
      grad.addColorStop(1, c.c2);

      ctx.fillStyle = grad;
      roundRect(ctx, x, y, cardW, cardH, 20, true, false);

      ctx.fillStyle = c.dark ? "#11213d" : "#ffffff";
      ctx.font = "800 13px Arial";
      ctx.fillText(c.label.toUpperCase(), x + 16, y + 24);

      ctx.font = "800 30px Arial";
      ctx.fillText(String(c.value), x + 16, y + 58);
    });

    ctx.restore();
  }

  function drawPitchIcons() {
    const gap = 20;
    const r = 7;
    const totalW = (TOTAL_PITCHES - 1) * gap;
    const startX = width / 2 - totalW / 2;
    const y = height - 128;

    for (let i = 0; i < TOTAL_PITCHES; i++) {
      const active = i < pitchesLeft;
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.24;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(startX + i * gap, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#d64545";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(startX + i * gap - 2.5, y, r - 3.5, -1.1, 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(startX + i * gap + 2.5, y, r - 3.5, 2.0, 4.2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawInstructionChip() {
    const text = paused
      ? "Paused — press Space to continue"
      : gameOver
        ? "Press R to return to splash"
        : "Click / tap to swing • Space to pause";

    ctx.save();
    ctx.font = "800 16px Arial";
    const tw = ctx.measureText(text).width + 34;
    const th = 36;
    const x = width / 2 - tw / 2;
    const y = height - 30;

    ctx.fillStyle = "rgba(8,18,40,0.86)";
    roundRect(ctx, x, y, tw, th, 999, true, false);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x + 17, y + 24);
    ctx.restore();
  }

  function drawThermometer() {
    const x = width - 58;
    const y = height * 0.22;
    const w = 20;
    const h = 190;
    const bulbR = 14;

    const ratio = clamp(displayDistance / 240, 0, 1);
    const fillH = h * ratio;
    const fillY = y + h - fillH;

    ctx.save();

    ctx.fillStyle = "rgba(10,20,40,0.72)";
    roundRect(ctx, x, y, w, h, 12, true, false);

    const grad = ctx.createLinearGradient(0, y + h, 0, y);
    grad.addColorStop(0, "#25A9FF");
    grad.addColorStop(0.55, "#7D4DFF");
    grad.addColorStop(1, "#FFD43B");

    ctx.fillStyle = grad;
    roundRect(ctx, x + 3, fillY, w - 6, fillH, 10, true, false);

    ctx.beginPath();
    ctx.arc(x + w / 2, y + h + 14, bulbR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 12, false, true);
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h + 14, bulbR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 10px Arial";
    ctx.textAlign = "center";
    ctx.fillText("HIT", x + w / 2, y - 10);
    ctx.fillText("DIST", x + w / 2, y + h + 34);

    ctx.restore();
  }

  function drawMessages(now) {
    if (!isMessageVisible(now)) return;

    ctx.save();
    ctx.textAlign = "center";

    let alpha = 1;
    const remaining = messageUntil - now;
    if (remaining < 600) alpha = remaining / 600;

    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#14304b";

    ctx.fillStyle = currentMessage.includes("HOME RUN") ? "#FFD43B" : "#ffffff";
    ctx.font = "800 54px Arial";
    ctx.strokeText(currentMessage, width / 2, height * 0.18);
    ctx.fillText(currentMessage, width / 2, height * 0.18);

    if (currentSubMessage) {
      ctx.fillStyle = "#25A9FF";
      ctx.font = "800 28px Arial";
      ctx.strokeText(currentSubMessage, width / 2, height * 0.25);
      ctx.fillText(currentSubMessage, width / 2, height * 0.25);
    }

    ctx.restore();
  }

  function drawSummary() {
    if (!summaryReady) return;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#FFD43B";
    ctx.font = "800 56px Arial";
    ctx.fillText(currentMessage, width / 2, height * 0.36);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 22px Arial";
    ctx.fillText(`Score: ${score}`, width / 2, height * 0.48);
    ctx.fillText(`Hits: ${hits}`, width / 2, height * 0.54);
    ctx.fillText(`Home Runs: ${homeRuns}`, width / 2, height * 0.60);
    ctx.fillText(`Best Hit: ${Math.round(bestDistance)} FT`, width / 2, height * 0.66);

    ctx.fillStyle = "#25A9FF";
    ctx.font = "800 18px Arial";
    ctx.fillText("Press R to return to splash", width / 2, height * 0.78);

    ctx.restore();
  }

  function render(now) {
    update();
    drawBackground();

    if (gameStarted) {
      drawPlayer();
      drawBall();
      drawParticles();
      drawTopTitle();
      drawThermometer();
      drawBottomStats();
      drawPitchIcons();
      drawInstructionChip();
      drawMessages(now);

      if (paused && !gameOver) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.30)";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#FFD43B";
        ctx.font = "800 66px Arial";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", width / 2, height * 0.42);
        ctx.restore();
      }

      if (gameOver) drawSummary();
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  function roundRect(context, x, y, w, h, r, fill, stroke) {
    if (w <= 0 || h <= 0) return;
    const radius = Math.min(r, w / 2, h / 2);

    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + w - radius, y);
    context.quadraticCurveTo(x + w, y, x + w, y + radius);
    context.lineTo(x + w, y + h - radius);
    context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    context.lineTo(x + radius, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();

    if (fill) context.fill();
    if (stroke) context.stroke();
  }
});
