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

// ── Jump settings ─────────────────────────────────────────────────────────────
const PLAYER_JUMP_HEIGHT = NET_HEIGHT / 2;  // peak rise above ground (px) — half the net height
const PLAYER_GRAVITY = 0.5;                 // downward acceleration (px/frame²)
const PLAYER_JUMP_VY = -Math.sqrt(2 * PLAYER_GRAVITY * PLAYER_JUMP_HEIGHT); // initial upward velocity

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

// ── Net dimensions (must match the background drawing) ────────────────────────
const NET_HEIGHT = 80;  // pixels from ground to net top

// ── Player starting positions ─────────────────────────────────────────────────
const PLAYER1_START_X = GAME_WIDTH / 4;
const PLAYER2_START_X = (GAME_WIDTH * 3) / 4;

const player = {
  x: PLAYER1_START_X,  // start on the left-hand side of the court
  y: GROUND_Y,         // feet rest on the ground line
  facingRight: true,
  batAngle: BAT_REST_ANGLE, // current bat angle in degrees
  isSwinging: false,        // true while a swing is in progress
  vy: 0,                    // vertical velocity (px/frame); negative = upward
  isJumping: false,         // true while airborne
};

const player2 = {
  x: PLAYER2_START_X,  // start on the right-hand side of the court
  y: GROUND_Y,         // feet rest on the ground line
  facingRight: false,  // faces left (mirror of player 1)
  batAngle: BAT_REST_ANGLE,
  isSwinging: false,
  vy: 0,
  isJumping: false,
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

// ── Ball settings ─────────────────────────────────────────────────────────────
// Diameter = 1.5× the head diameter → radius = 1.5× head radius.
const BALL_RADIUS = Math.round(FIG.headR * 1.5);             // 18 px
const BALL_SPEED  = PLAYER_SPEED;                            // horiz. speed matches walking
const BALL_ARC_HEIGHT = GROUND_Y * 0.75;                     // peak rise above ground (¾ of play area)
// Derive gravity & launch-vy so a standard pitch travels exactly GAME_WIDTH/2 horizontally.
const _HALF_FLIGHT_FRAMES = (GAME_WIDTH / 2) / BALL_SPEED / 2;  // 50 frames
const BALL_GRAVITY    = (2 * BALL_ARC_HEIGHT) / (_HALF_FLIGHT_FRAMES * _HALF_FLIGHT_FRAMES);
const BALL_LAUNCH_VY  = -(BALL_GRAVITY * _HALF_FLIGHT_FRAMES);   // initial upward vy (~−16.2)
const BALL_WALK_BOOST    = BALL_SPEED * 0.5;  // extra vx when walking toward opponent during a swing
const BALL_HIT_COOLDOWN  = 15;               // frames before the same player may re-hit the ball
const BALL_AUTO_SERVE_DELAY = 90;            // frames AI waits before auto-serving in 1-player mode

// ── Ball state ────────────────────────────────────────────────────────────────
const ball = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  inFlight: false,
  servingPlayer: 1,  // 1 = player1 serves next, 2 = player2 serves next
  lastHitBy: 0,      // 1 or 2 — who last struck the ball (used for net-scoring)
  hitCooldown: 0,    // frames until the same player may hit again
  autoServeTimer: 0, // countdown to AI auto-serve (1-player mode only)
};

// ── Scores ────────────────────────────────────────────────────────────────────
let score1 = 0;
let score2 = 0;

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
  ArrowUp: false,
  ArrowDown: false,
  x: false,
  z: false,
  c: false,
  s: false,
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
  if (controlsHint) controlsHint.textContent = 'Use ← → to move, ↑ to jump, ↓ to swing';
});

btn2Player.addEventListener('click', () => {
  gameMode = '2player';
  btn2Player.classList.add('active');
  btn1Player.classList.remove('active');
  if (controlsHint) controlsHint.textContent = 'Player 1: Z / C to move, S to jump, X to swing  |  Player 2: ← → to move, ↑ to jump, ↓ to swing';
});

btnStart.addEventListener('click', () => {
  if (!gameRunning) {
    timerSeconds = TIMER_DURATION;
    gameOver = false;
    lastTimestamp = 0;
    score1 = 0;
    score2 = 0;
    player.x = PLAYER1_START_X;
    player.y = GROUND_Y;
    player.facingRight = true;
    player.batAngle = BAT_REST_ANGLE;
    player.isSwinging = false;
    player.vy = 0;
    player.isJumping = false;
    player2.x = PLAYER2_START_X;
    player2.y = GROUND_Y;
    player2.facingRight = false;
    player2.batAngle = BAT_REST_ANGLE;
    player2.isSwinging = false;
    player2.vy = 0;
    player2.isJumping = false;
    resetBall(1);
    gameRunning = true;
    requestAnimationFrame(gameLoop);
  }
});

btnReset.addEventListener('click', () => {
  gameRunning = false;
  gameOver = false;
  timerSeconds = TIMER_DURATION;
  lastTimestamp = 0;
  score1 = 0;
  score2 = 0;
  player.x = PLAYER1_START_X;
  player.y = GROUND_Y;
  player.facingRight = true;
  player.batAngle = BAT_REST_ANGLE;
  player.isSwinging = false;
  player.vy = 0;
  player.isJumping = false;
  player2.x = PLAYER2_START_X;
  player2.y = GROUND_Y;
  player2.facingRight = false;
  player2.batAngle = BAT_REST_ANGLE;
  player2.isSwinging = false;
  player2.vy = 0;
  player2.isJumping = false;
  resetBall(1);
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

// ── Ball helpers ──────────────────────────────────────────────────────────────

/**
 * Return the position at which the ball hovers while waiting to be served.
 * The ball floats in front of the serving player's forehead.
 * @param {number} who - 1 = player 1, 2 = player 2
 * @returns {{ x: number, y: number }}
 */
function getBallWaitPosition(who) {
  const p = who === 1 ? player : player2;
  const dir = p.facingRight ? 1 : -1;
  const headCY = p.y - FIG.legLen - FIG.bodyLen - FIG.headR;
  return {
    x: p.x + dir * (FIG.headR + BALL_RADIUS),
    y: headCY,
  };
}

/**
 * Compute the centre of the bat-head ellipse for a given player's current state.
 * @param {{ x: number, y: number, facingRight: boolean, batAngle: number }} p
 * @returns {{ x: number, y: number }}
 */
function getBatHeadCenter(p) {
  const dir = p.facingRight ? 1 : -1;
  const angleRad = p.batAngle * DEG_TO_RAD;
  const bdx = dir * Math.sin(angleRad);
  const bdy = -Math.cos(angleRad);
  const shoulderY = p.y - FIG.legLen - FIG.bodyLen;
  const handX = p.x + dir * FIG.armLen;
  const handY = shoulderY - 10;
  return {
    x: handX + bdx * (BAT_HANDLE_LEN + BAT_HEAD_RY),
    y: handY + bdy * (BAT_HANDLE_LEN + BAT_HEAD_RY),
  };
}

/**
 * Returns true if the given player is walking toward the opponent
 * (i.e., toward the net), which boosts the ball's launch speed.
 * @param {number} playerNum - 1 or 2
 * @returns {boolean}
 */
function isMovingTowardOpponent(playerNum) {
  if (playerNum === 1) {
    return gameMode === '1player' ? keys.ArrowRight : keys.c;
  }
  return keys.ArrowLeft; // Player 2 moves left to approach player 1
}

/**
 * Launch the ball from the serving player's position.
 * @param {number} who - 1 or 2
 */
function launchBall(who) {
  const dir = who === 1 ? 1 : -1;  // P1 hits right; P2 hits left
  let vx = dir * BALL_SPEED;
  if (isMovingTowardOpponent(who)) vx += dir * BALL_WALK_BOOST;
  ball.vx = vx;
  ball.vy = BALL_LAUNCH_VY;
  ball.inFlight = true;
  ball.lastHitBy = who;
  ball.hitCooldown = BALL_HIT_COOLDOWN;
}

/**
 * Reset (or initialise) the ball to the serving position of the given player.
 * @param {number} who - 1 or 2
 */
function resetBall(who) {
  ball.servingPlayer = who;
  ball.inFlight = false;
  ball.vx = 0;
  ball.vy = 0;
  ball.hitCooldown = 0;
  ball.lastHitBy = 0;
  // In 1-player mode player 2 auto-serves after a short delay.
  ball.autoServeTimer = (who === 2 && gameMode === '1player') ? BALL_AUTO_SERVE_DELAY : 0;
  const pos = getBallWaitPosition(who);
  ball.x = pos.x;
  ball.y = pos.y;
}

/**
 * Award a point to the scoring player and reset the ball for the next serve.
 * @param {number} scorer - 1 or 2 (the player who won the point)
 */
function awardPoint(scorer) {
  if (scorer === 1) {
    score1++;
  } else {
    score2++;
  }
  // The player who was scored *against* (the loser of this rally) serves next.
  const loser = scorer === 1 ? 2 : 1;
  resetBall(loser);
}

/**
 * Check whether the ball collides with a player's bat; apply appropriate
 * velocity change (powered return if swinging, drop otherwise).
 * @param {{ x:number, y:number, facingRight:boolean, batAngle:number, isSwinging:boolean }} p
 * @param {number} playerNum - 1 or 2
 * @returns {boolean} true if a collision was handled
 */
function checkBatCollision(p, playerNum) {
  // Prevent the same player from immediately re-hitting the ball.
  if (ball.hitCooldown > 0 && ball.lastHitBy === playerNum) return false;

  const batHead = getBatHeadCenter(p);
  const dist = Math.hypot(ball.x - batHead.x, ball.y - batHead.y);
  if (dist > BALL_RADIUS + BAT_HEAD_RY) return false;

  if (p.isSwinging) {
    // Powered return — mirror the horizontal direction.
    const dir = playerNum === 1 ? 1 : -1;
    let vx = dir * BALL_SPEED;
    if (isMovingTowardOpponent(playerNum)) vx += dir * BALL_WALK_BOOST;
    ball.vx = vx;
    ball.vy = BALL_LAUNCH_VY;
  } else {
    // Bat in the way but player not swinging — ball drops straight down.
    ball.vx = 0;
    ball.vy = Math.abs(ball.vy) + 1; // ensure downward motion
  }
  ball.lastHitBy = playerNum;
  ball.hitCooldown = BALL_HIT_COOLDOWN;
  return true;
}

/**
 * Update ball position, physics, and all collision/scoring logic each frame.
 */
function updateBall() {
  if (!ball.inFlight) {
    // ── Waiting / serving state ──
    if (ball.autoServeTimer > 0) {
      ball.autoServeTimer--;
      if (ball.autoServeTimer === 0) {
        launchBall(ball.servingPlayer);
        return;
      }
    }
    // Ball follows the serving player's forehead position.
    const pos = getBallWaitPosition(ball.servingPlayer);
    ball.x = pos.x;
    ball.y = pos.y;

    // Launch when the serving player initiates a swing.
    const servingP = ball.servingPlayer === 1 ? player : player2;
    if (servingP.isSwinging) {
      launchBall(ball.servingPlayer);
    }
    return;
  }

  // ── In-flight physics ──
  if (ball.hitCooldown > 0) ball.hitCooldown--;

  ball.vy += BALL_GRAVITY;
  ball.x  += ball.vx;
  ball.y  += ball.vy;

  // ── Wall & ceiling bounces ──
  if (ball.x - BALL_RADIUS < 0) {
    ball.x  = BALL_RADIUS;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + BALL_RADIUS > GAME_WIDTH) {
    ball.x  = GAME_WIDTH - BALL_RADIUS;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y - BALL_RADIUS < 0) {
    ball.y  = BALL_RADIUS;
    ball.vy = Math.abs(ball.vy);
  }

  // ── Net collision ──
  const netX    = GAME_WIDTH / 2;
  const netTopY = GROUND_Y - NET_HEIGHT;
  if (Math.abs(ball.x - netX) < BALL_RADIUS && ball.y + BALL_RADIUS >= netTopY) {
    // Whoever hit it last sent it into the net — the other player scores.
    awardPoint(ball.lastHitBy === 1 ? 2 : 1);
    return;
  }

  // ── Ground landing ──
  if (ball.y + BALL_RADIUS >= GROUND_Y) {
    // Left half → player 2 scores; right half → player 1 scores.
    awardPoint(ball.x < GAME_WIDTH / 2 ? 2 : 1);
    return;
  }

  // ── Bat collision checks ──
  if (checkBatCollision(player, 1)) return;
  checkBatCollision(player2, 2);
}

/**
 * Simple AI that moves player 2 and swings the bat in 1-player mode.
 */
function updateAI() {
  if (gameMode !== '1player') return;

  // Advance any ongoing swing.
  if (player2.isSwinging) {
    player2.batAngle += BAT_SWING_DEGREES_PER_FRAME;
    if (player2.batAngle >= BAT_REST_ANGLE) {
      player2.batAngle = BAT_REST_ANGLE;
      player2.isSwinging = false;
    }
  }

  if (!ball.inFlight || ball.x <= GAME_WIDTH / 2) {
    // Ball not on AI's side — drift back to the default starting position.
    if (Math.abs(player2.x - PLAYER2_START_X) > PLAYER_SPEED) {
      player2.x += player2.x < PLAYER2_START_X ? PLAYER_SPEED : -PLAYER_SPEED;
    }
    player2.facingRight = false;
    return;
  }

  // Move toward the ball's current x position.
  if (Math.abs(player2.x - ball.x) > PLAYER_SPEED) {
    if (player2.x < ball.x) {
      player2.x += PLAYER_SPEED;
      player2.facingRight = true;
    } else {
      player2.x -= PLAYER_SPEED;
      player2.facingRight = false;
    }
  }

  // Enforce right-side boundary.
  const minX2 = player2.facingRight
    ? GAME_WIDTH / 2 + PLAYER_SIDE_REACH
    : GAME_WIDTH / 2 + PLAYER_FRONT_REACH;
  const maxX2 = player2.facingRight
    ? GAME_WIDTH - PLAYER_FRONT_REACH
    : GAME_WIDTH - PLAYER_SIDE_REACH;
  if (player2.x < minX2) player2.x = minX2;
  if (player2.x > maxX2) player2.x = maxX2;

  // Swing when the bat head could reach the ball.
  if (!player2.isSwinging) {
    const batHead = getBatHeadCenter(player2);
    const dist = Math.hypot(ball.x - batHead.x, ball.y - batHead.y);
    if (dist <= BALL_RADIUS + BAT_HEAD_RY * 3.5) {
      player2.isSwinging = true;
      player2.batAngle   = BAT_SWING_START;
    }
  }
}

// ── Ball drawing ──────────────────────────────────────────────────────────────

/**
 * Draw the beach ball as a striped circle at its current position.
 */
function drawBall() {
  const { x, y } = ball;
  const r = BALL_RADIUS;
  const stripeCount = 6;

  ctx.save();
  // Clip to the ball circle so wedges don't bleed outside.
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  // Alternating coloured wedges (beach-ball stripes).
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ff6b6b' : '#fffbe6';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, (i / stripeCount) * Math.PI * 2, ((i + 1) / stripeCount) * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  // Outline.
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw the scoreboard — P1 score on the left, P2 score on the right.
 */
function drawScoreboard() {
  ctx.save();
  ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
  ctx.textBaseline = 'top';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#ffffff';

  ctx.textAlign = 'left';
  ctx.fillText(`P1: ${score1}`, 12, 12);

  ctx.textAlign = 'right';
  ctx.fillText(`P2: ${score2}`, GAME_WIDTH - 12, 12);

  ctx.restore();
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
 * Draw a semi-transparent overlay with "GAME OVER" and the winner announcement.
 */
function drawGameOver() {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 10;

  // "GAME OVER" heading.
  ctx.font = 'bold 72px Arial, Helvetica, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff4444';
  ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 48);

  // Winner / tie announcement.
  let resultText;
  if (score1 > score2) {
    resultText = 'Player 1 wins!';
  } else if (score2 > score1) {
    resultText = 'Player 2 wins!';
  } else {
    resultText = "It's a tie!";
  }
  ctx.font = 'bold 36px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(resultText, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 36);

  ctx.restore();
}

// ── Update ───────────────────────────────────────────────────────────────────

/**
 * Apply gravity and ground-landing physics to a player each frame.
 * @param {{ y: number, vy: number, isJumping: boolean }} p
 */
function applyPlayerGravity(p) {
  if (p.isJumping) {
    p.vy += PLAYER_GRAVITY;
    p.y  += p.vy;
    if (p.y >= GROUND_Y) {
      p.y = GROUND_Y;
      p.vy = 0;
      p.isJumping = false;
    }
  }
}

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

  // ── Player 1 jump ──
  // In 1-player mode ArrowUp triggers the jump; in 2-player mode the S key is used.
  const jumpKeyP1 = gameMode === '1player' ? keys.ArrowUp : keys.s;
  if (jumpKeyP1 && !player.isJumping) {
    player.isJumping = true;
    player.vy = PLAYER_JUMP_VY;
  }
  applyPlayerGravity(player);

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

    // ── Player 2 jump ──
    if (keys.ArrowUp && !player2.isJumping) {
      player2.isJumping = true;
      player2.vy = PLAYER_JUMP_VY;
    }
    applyPlayerGravity(player2);

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

  updateAI();
  updateBall();
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawBackground();
  drawStickFigure(player.x, player.y, player.facingRight, player.batAngle);
  // Player 2 is always drawn — a human opponent in 2-player mode, AI in 1-player mode.
  drawStickFigure(player2.x, player2.y, player2.facingRight, player2.batAngle);
  drawBall();
  if (!gameOver) {
    drawTimer();
    drawScoreboard();
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

// Initialise ball and draw the opening scene (players + ball visible before Start is pressed).
resetBall(1);
render();
