'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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
  width: 30,          // rough bounding width (used for wall clamping)
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
function drawBackground() {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#0f3460');
  sky.addColorStop(1, '#16213e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GAME_WIDTH, GROUND_Y);

  // Ground strip
  ctx.fillStyle = '#2a5c2a';
  ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);

  // Net (centred, simple placeholder)
  const netX = GAME_WIDTH / 2;
  ctx.strokeStyle = '#ffffff55';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(netX, GROUND_Y);
  ctx.lineTo(netX, GROUND_Y - 80);
  ctx.stroke();

  // Net crossbar
  ctx.beginPath();
  ctx.moveTo(netX - 5, GROUND_Y - 80);
  ctx.lineTo(netX + 5, GROUND_Y - 80);
  ctx.stroke();
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
  // Left leg
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 10, y - FIG.legLen);
  ctx.stroke();
  // Right leg
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 10, y - FIG.legLen);
  ctx.stroke();

  // — Body —
  const hipY = y - FIG.legLen;
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
