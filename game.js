'use strict';

const canvas = document.getElementById('gameCanvas');

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Game initialization error: <canvas id="gameCanvas"> not found or not a canvas element.');
}

const ctx = canvas.getContext('2d');

if (!ctx) {
  throw new Error('Game initialization error: Failed to acquire 2D rendering context for gameCanvas.');
}

// ── Game dimensions ──────────────────────────────────────────────────────────
const GAME_WIDTH = canvas.width;   // 800
const GAME_HEIGHT = canvas.height; // 600

// ── Ground ───────────────────────────────────────────────────────────────────
const GROUND_Y = GAME_HEIGHT - 60;

// ── Timer ─────────────────────────────────────────────────────────────────────
const TIMER_DURATION = 120; // 2 minutes in seconds

// ── Player settings ──────────────────────────────────────────────────────────
const PLAYER_SPEED = 4;
const STICK_COLOR = '#e0e0e0';

// ── Bat settings ─────────────────────────────────────────────────────────────
const BAT_COLOR = '#c8a26a';      // warm wood / frame colour
const BAT_HANDLE_LEN = 28;        // pixels from hand to base of bat head
const BAT_HEAD_RX = 9;            // semi-minor axis (width across head)
const BAT_HEAD_RY = 14;           // semi-major axis (length along head)
const BAT_REST_ANGLE = 45;        // resting bat angle in degrees (from upward y-axis, toward front)
const BAT_SWING_START = -90;      // swing start angle: behind the player's head
const BAT_SWING_DEGREES_PER_FRAME = PLAYER_SPEED * 3; // angular advance per frame during a swing (degrees)

// ── Math helpers ──────────────────────────────────────────────────────────────
const DEG_TO_RAD = Math.PI / 180;

// ── Player starting positions ─────────────────────────────────────────────────
const PLAYER1_START_X = GAME_WIDTH / 4;
const PLAYER2_START_X = (GAME_WIDTH * 3) / 4;

const player = {
  x: PLAYER1_START_X,  // start on the left-hand side of the court
  y: GROUND_Y,         // feet rest on the ground line
  facingRight: true,
  batAngle: BAT_REST_ANGLE, // current bat angle in degrees
  isSwinging: false,        // true while a swing is in progress
};

const player2 = {
  x: PLAYER2_START_X,  // start on the right-hand side of the court
  y: GROUND_Y,         // feet rest on the ground line
  facingRight: false,  // faces left (mirror of player 1)
  batAngle: BAT_REST_ANGLE,
  isSwinging: false,
};

// Stick-figure proportions (all relative to player.y == feet)
const FIG = {
  legLen: 40,
  bodyLen: 50,
  headR: 12,
  armLen: 30,
};

const PLAYER_LEG_HALF_WIDTH = 10;
const PLAYER_SIDE_REACH = Math.max(FIG.armLen, PLAYER_LEG_HALF_WIDTH, FIG.headR);
// Horizontal half-width of the angled bat head when rotated 45 degrees.
const BAT_HEAD_HALF_WIDTH_AT_45 = Math.hypot(BAT_HEAD_RX, BAT_HEAD_RY) * Math.SQRT1_2;
// Max horizontal reach from the body centre to the frontmost visible bat edge.
const PLAYER_FRONT_REACH = FIG.armLen + Math.SQRT1_2 * (BAT_HANDLE_LEN + BAT_HEAD_RY) + BAT_HEAD_HALF_WIDTH_AT_45;

// ── Game mode & state ─────────────────────────────────────────────────────────
/** @type {'1player' | '2player'} */
let gameMode = '1player';
let gameRunning = false;
let gameOver = false;
let timerSeconds = TIMER_DURATION;
let lastTimestamp = 0;

// ── Input state ──────────────────────────────────────────────────────────────
const keys = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowDown: false,
  x: false,
  z: false,
  c: false,
};

document.addEventListener('keydown', (e) => {
  if (e.key in keys) {
    keys[e.key] = true;
    e.preventDefault();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key in keys) {
    keys[e.key] = false;
  }
});

// ── Button handlers ───────────────────────────────────────────────────────────
const btn1Player = document.getElementById('btn-1player');
const btn2Player = document.getElementById('btn-2player');
const btnStart   = document.getElementById('btn-start');
const btnReset   = document.getElementById('btn-reset');
const controlsHint = document.getElementById('controls-hint');

if (!(btn1Player instanceof HTMLButtonElement) ||
    !(btn2Player instanceof HTMLButtonElement) ||
    !(btnStart   instanceof HTMLButtonElement) ||
    !(btnReset   instanceof HTMLButtonElement)) {
  throw new Error('Game initialization error: Required button elements not found.');
}

btn1Player.addEventListener('click', () => {
  gameMode = '1player';
  btn1Player.classList.add('active');
  btn2Player.classList.remove('active');
  if (controlsHint) controlsHint.textContent = 'Use ← → to move, ↓ to swing';
});

btn2Player.addEventListener('click', () => {
  gameMode = '2player';
  btn2Player.classList.add('active');
  btn1Player.classList.remove('active');
  if (controlsHint) controlsHint.textContent = 'Player 1: Z / C to move, X to swing  |  Player 2: ← → to move, ↓ to swing';
});

btnStart.addEventListener('click', () => {
  if (!gameRunning) {
    timerSeconds = TIMER_DURATION;
    gameOver = false;
    lastTimestamp = 0;
    gameRunning = true;
    requestAnimationFrame(gameLoop);
  }
});

btnReset.addEventListener('click', () => {
  gameRunning = false;
  gameOver = false;
  timerSeconds = TIMER_DURATION;
  lastTimestamp = 0;
  player.x = PLAYER1_START_X;
  player.y = GROUND_Y;
  player.facingRight = true;
  player.batAngle = BAT_REST_ANGLE;
  player.isSwinging = false;
  player2.x = PLAYER2_START_X;
  player2.y = GROUND_Y;
  player2.facingRight = false;
  player2.batAngle = BAT_REST_ANGLE;
  player2.isSwinging = false;
  render();
});

// ── Drawing helpers ──────────────────────────────────────────────────────────

// Pre-render the static background (court + net) to an offscreen canvas once,
// then blit it each frame to avoid per-frame allocations and canvas API calls.
const bgCanvas = document.createElement('canvas');
bgCanvas.width = GAME_WIDTH;
bgCanvas.height = GAME_HEIGHT;
const bgCtx = bgCanvas.getContext('2d');

if (!bgCtx) {
  throw new Error('Game initialization error: Failed to acquire 2D rendering context for background canvas.');
}

(function initBackground() {
  // Sky gradient
  const sky = bgCtx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#0f3460');
  sky.addColorStop(1, '#16213e');
  bgCtx.fillStyle = sky;
  bgCtx.fillRect(0, 0, GAME_WIDTH, GROUND_Y);

  // Ground strip
  bgCtx.fillStyle = '#2a5c2a';
  bgCtx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);

  // Net (centred, simple placeholder)
  const netX = GAME_WIDTH / 2;
  bgCtx.strokeStyle = '#ffffff55';
  bgCtx.lineWidth = 2;
  bgCtx.beginPath();
  bgCtx.moveTo(netX, GROUND_Y);
  bgCtx.lineTo(netX, GROUND_Y - 80);
  bgCtx.stroke();

  // Net crossbar
  bgCtx.beginPath();
  bgCtx.moveTo(netX - 5, GROUND_Y - 80);
  bgCtx.lineTo(netX + 5, GROUND_Y - 80);
  bgCtx.stroke();
}());

function drawBackground() {
  ctx.drawImage(bgCanvas, 0, 0);
}

/**
 * Draw a badminton bat held at the given angle.
 * The grip of the bat starts at (handX, handY) and the head extends in the
 * direction determined by batAngle (degrees from the upward y-axis, positive
 * values tilt toward the front of the player).
 * @param {number} handX - x position of the hand (front arm tip)
 * @param {number} handY - y position of the hand
 * @param {boolean} facingRight - direction the player faces
 * @param {number} batAngle - bat angle in degrees from the upward y-axis
 */
function drawBat(handX, handY, facingRight, batAngle) {
  const dir = facingRight ? 1 : -1;
  const angleRad = batAngle * DEG_TO_RAD;

  // Bat direction vector: forward component (dir * sin) and upward component (-cos)
  const bdx = dir * Math.sin(angleRad);
  const bdy = -Math.cos(angleRad);

  // End of handle (start of bat head)
  const tipX = handX + bdx * BAT_HANDLE_LEN;
  const tipY = handY + bdy * BAT_HANDLE_LEN;

  // Centre of the elliptical bat head (one head-radius further along bat)
  const headCX = handX + bdx * (BAT_HANDLE_LEN + BAT_HEAD_RY);
  const headCY = handY + bdy * (BAT_HANDLE_LEN + BAT_HEAD_RY);

  // Ellipse rotation: align the long axis (ry) with the bat direction vector.
  // In canvas coords, the ry axis direction at rotation r is (-sin r, cos r).
  // Solving for (bdx, bdy) gives headRot = atan2(bdx, -bdy).
  const headRot = Math.atan2(bdx, -bdy);

  ctx.save();
  ctx.strokeStyle = BAT_COLOR;
  ctx.lineCap = 'round';

  // Handle
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Bat head
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(headCX, headCY, BAT_HEAD_RX, BAT_HEAD_RY, headRot, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a simple stick figure with its feet at (x, y).
 * @param {number} x  - x position (feet / hip centre)
 * @param {number} y  - y position (feet on ground)
 * @param {boolean} facingRight - direction the player faces
 * @param {number} batAngle - current bat angle in degrees (see drawBat)
 */
function drawStickFigure(x, y, facingRight, batAngle) {
  ctx.strokeStyle = STICK_COLOR;
  ctx.fillStyle = STICK_COLOR;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  const dir = facingRight ? 1 : -1;

  // — Legs —
  const hipY = y - FIG.legLen;
  // Left leg
  ctx.beginPath();
  ctx.moveTo(x, hipY);
  ctx.lineTo(x - 10, y);
  ctx.stroke();
  // Right leg
  ctx.beginPath();
  ctx.moveTo(x, hipY);
  ctx.lineTo(x + 10, y);
  ctx.stroke();

  // — Body —
  const shoulderY = hipY - FIG.bodyLen;
  ctx.beginPath();
  ctx.moveTo(x, hipY);
  ctx.lineTo(x, shoulderY);
  ctx.stroke();

  // — Arms —
  // Back arm (raised slightly)
  ctx.beginPath();
  ctx.moveTo(x, shoulderY);
  ctx.lineTo(x - dir * FIG.armLen, shoulderY + 10);
  ctx.stroke();
  // Front arm (forward, slightly raised — ready to swing)
  ctx.beginPath();
  ctx.moveTo(x, shoulderY);
  ctx.lineTo(x + dir * FIG.armLen, shoulderY - 10);
  ctx.stroke();

  // Bat held in the front hand at the current swing angle
  drawBat(x + dir * FIG.armLen, shoulderY - 10, facingRight, batAngle);

  // — Head —
  const headCY = shoulderY - FIG.headR;
  ctx.beginPath();
  ctx.arc(x, headCY, FIG.headR, 0, Math.PI * 2);
  ctx.stroke();
}

// ── Timer helpers ─────────────────────────────────────────────────────────────

/**
 * Format a number of seconds as "M:SS".
 * @param {number} seconds - Total seconds remaining
 * @returns {string} Formatted time string (e.g. "2:00", "1:05")
 */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Draw the countdown timer centred at the top of the canvas.
 */
function drawTimer() {
  ctx.save();
  ctx.font = 'bold 24px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(formatTime(timerSeconds), GAME_WIDTH / 2, 12);
  ctx.restore();
}

/**
 * Draw a semi-transparent overlay with "GAME OVER" text.
 */
function drawGameOver() {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.font = 'bold 72px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ff4444';
  ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2);
  ctx.restore();
}

// ── Update ───────────────────────────────────────────────────────────────────
function update() {
  // ── Player 1 movement ──
  if (gameMode === '1player') {
    // Arrow keys control player 1 in single-player mode
    if (keys.ArrowLeft) {
      player.x -= PLAYER_SPEED;
      player.facingRight = false;
    }
    if (keys.ArrowRight) {
      player.x += PLAYER_SPEED;
      player.facingRight = true;
    }
  } else {
    // Z/C keys control player 1 in two-player mode
    if (keys.z) {
      player.x -= PLAYER_SPEED;
      player.facingRight = false;
    }
    if (keys.c) {
      player.x += PLAYER_SPEED;
      player.facingRight = true;
    }
  }

  // Keep player 1 on the left-hand side of the court (cannot cross the net)
  const minX = player.facingRight ? PLAYER_SIDE_REACH : PLAYER_FRONT_REACH;
  const maxX = player.facingRight ? GAME_WIDTH / 2 - PLAYER_FRONT_REACH : GAME_WIDTH / 2 - PLAYER_SIDE_REACH;
  if (player.x < minX) player.x = minX;
  if (player.x > maxX) player.x = maxX;

  // ── Player 1 swing ──
  // In 1-player mode ArrowDown triggers the swing; in 2-player mode the X key is used.
  const swingKeyP1 = gameMode === '1player' ? keys.ArrowDown : keys.x;
  if (swingKeyP1 && !player.isSwinging) {
    player.isSwinging = true;
    player.batAngle = BAT_SWING_START;
  }
  if (player.isSwinging) {
    player.batAngle += BAT_SWING_DEGREES_PER_FRAME;
    if (player.batAngle >= BAT_REST_ANGLE) {
      player.batAngle = BAT_REST_ANGLE;
      player.isSwinging = false;
    }
  }

  // ── Player 2 movement (two-player mode only) ──
  if (gameMode === '2player') {
    if (keys.ArrowLeft) {
      player2.x -= PLAYER_SPEED;
      player2.facingRight = false;
    }
    if (keys.ArrowRight) {
      player2.x += PLAYER_SPEED;
      player2.facingRight = true;
    }

    // Keep player 2 on the right-hand side of the court (cannot cross the net)
    const minX2 = player2.facingRight ? GAME_WIDTH / 2 + PLAYER_SIDE_REACH : GAME_WIDTH / 2 + PLAYER_FRONT_REACH;
    const maxX2 = player2.facingRight ? GAME_WIDTH - PLAYER_FRONT_REACH : GAME_WIDTH - PLAYER_SIDE_REACH;
    if (player2.x < minX2) player2.x = minX2;
    if (player2.x > maxX2) player2.x = maxX2;

    // ── Player 2 swing ──
    if (keys.ArrowDown && !player2.isSwinging) {
      player2.isSwinging = true;
      player2.batAngle = BAT_SWING_START;
    }
    if (player2.isSwinging) {
      player2.batAngle += BAT_SWING_DEGREES_PER_FRAME;
      if (player2.batAngle >= BAT_REST_ANGLE) {
        player2.batAngle = BAT_REST_ANGLE;
        player2.isSwinging = false;
      }
    }
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawBackground();
  drawStickFigure(player.x, player.y, player.facingRight, player.batAngle);
  if (gameMode === '2player') {
    drawStickFigure(player2.x, player2.y, player2.facingRight, player2.batAngle);
  }
  if (!gameOver) {
    drawTimer();
  } else {
    drawGameOver();
  }
}

// ── Game loop ─────────────────────────────────────────────────────────────────
/**
 * @param {DOMHighResTimeStamp} timestamp - Provided by requestAnimationFrame
 */
function gameLoop(timestamp) {
  if (!gameRunning) return;

  if (lastTimestamp === 0) lastTimestamp = timestamp;
  const delta = (timestamp - lastTimestamp) / 1000; // seconds elapsed this frame
  lastTimestamp = timestamp;

  timerSeconds -= delta;
  if (timerSeconds <= 0) {
    timerSeconds = 0;
    gameRunning = false;
    gameOver = true;
    render();
    return;
  }

  update();
  render();
  requestAnimationFrame(gameLoop);
}

// Draw the initial scene so players are visible before "Start game" is pressed
render();
