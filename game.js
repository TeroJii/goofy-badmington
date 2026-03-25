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

// ── Player settings ──────────────────────────────────────────────────────────
const PLAYER_SPEED = 4;
const STICK_COLOR = '#e0e0e0';

const player = {
  x: GAME_WIDTH / 2,  // horizontal centre of body / hips
  y: GROUND_Y,        // feet rest on the ground line
  width: 60,          // bounding width = 2 × arm length (used for wall clamping)
  facingRight: true,
};

// Stick-figure proportions (all relative to player.y == feet)
const FIG = {
  legLen: 40,
  bodyLen: 50,
  headR: 12,
  armLen: 30,
};

// ── Input state ──────────────────────────────────────────────────────────────
const keys = {
  ArrowLeft: false,
  ArrowRight: false,
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
 * Draw a simple stick figure with its feet at (x, y).
 * @param {number} x  - x position (feet / hip centre)
 * @param {number} y  - y position (feet on ground)
 * @param {boolean} facingRight - direction the player faces
 */
function drawStickFigure(x, y, facingRight) {
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

  // — Head —
  const headCY = shoulderY - FIG.headR;
  ctx.beginPath();
  ctx.arc(x, headCY, FIG.headR, 0, Math.PI * 2);
  ctx.stroke();
}

// ── Update ───────────────────────────────────────────────────────────────────
function update() {
  if (keys.ArrowLeft) {
    player.x -= PLAYER_SPEED;
    player.facingRight = false;
  }
  if (keys.ArrowRight) {
    player.x += PLAYER_SPEED;
    player.facingRight = true;
  }

  // Keep player inside the canvas bounds
  const halfW = player.width / 2;
  if (player.x < halfW) player.x = halfW;
  if (player.x > GAME_WIDTH - halfW) player.x = GAME_WIDTH - halfW;
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawBackground();
  drawStickFigure(player.x, player.y, player.facingRight);
}

// ── Game loop ─────────────────────────────────────────────────────────────────
function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

gameLoop();
