import { Board } from './board.js';
import { EnemyAI } from './ai.js';
import { Renderer } from './renderer.js';
import { BOARD_COLS, BOARD_ROWS, SKILL_COSTS, BLOCK_TYPES } from './constants.js';

// ── Layout constants (all in canvas pixels, CS=27) ──────────────────────────
const CS = 27;
const BW = BOARD_COLS * CS;  // 270
const BH = BOARD_ROWS * CS;  // 540
const CANVAS_W = 900;
const CANVAS_H = 760;
const TOP = 50;               // board top y

// Player side (left)
const P_HOLD_X  = 2;
const P_BOARD_X = P_HOLD_X + CS * 4 + 6;   // 116
const P_GARB_X  = P_BOARD_X + BW + 4;       // 390
const P_NEXT_X  = P_GARB_X + 12;            // 402

// Enemy side (right, mirrored)
const E_NEXT_X  = CANVAS_W - P_NEXT_X - CS * 4;   // 390
const E_GARB_X  = CANVAS_W - P_GARB_X - 12;        // 498
const E_BOARD_X = CANVAS_W - P_BOARD_X - BW;       // 514
const E_HOLD_X  = CANVAS_W - P_HOLD_X - CS * 4 - 6; // 784

const STATUS_Y  = TOP + BH + 10;  // 600

export class Game {
  constructor(canvas, aiType = 'balanced') {
    this.canvas = canvas;
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;

    this.renderer = new Renderer(canvas, CS);

    this.playerBoard = new Board(0.08);
    this.enemyBoard  = new Board(0.0);

    this.ai = new EnemyAI(aiType);
    this.aiInterval = aiType === 'fast' ? 110 : 380;
    this.aiTimer    = 0;

    this.fallInterval = 800;
    this.fallTimer    = 0;

    this.activeSkill  = null;
    this.skillTimer   = 0;
    this.timeFactor   = 1;

    this.gameOver = false;
    this.winner   = null;

    this.keys     = new Set();
    this.keyRepeat = {};
    this.REPEAT_DELAY    = 160;
    this.REPEAT_INTERVAL = 55;

    this._bindKeys();
    this._bindButtons();
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  _bindKeys() {
    window.addEventListener('keydown', e => {
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (this.keys.has(e.code)) return;
      this.keys.add(e.code);
      this.keyRepeat[e.code] = { next: performance.now() + this.REPEAT_DELAY };
      this._key(e.code);
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code);
      delete this.keyRepeat[e.code];
    });
  }

  _bindButtons() {
    const map = {
      'btn-left':    () => this._action('left'),
      'btn-right':   () => this._action('right'),
      'btn-soft':    () => this._action('soft'),
      'btn-drop':    () => this._action('drop'),
      'btn-rot-cw':  () => this._action('rotateCW'),
      'btn-rot-ccw': () => this._action('rotateCCW'),
      'btn-hold':    () => this._action('hold'),
      'btn-skill-tw': () => this._activateSkill('TIME_WARP'),
      'btn-skill-mc': () => this._activateSkill('MAGNETIC_COLLAPSE'),
      'btn-skill-hl': () => this._activateSkill('HOLD_LOCK'),
      'btn-restart':  () => this._restart(),
    };

    for (const [id, fn] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
      el.addEventListener('mousedown',  e => { e.preventDefault(); fn(); });
    }

    // Hold-repeat for left/right/soft
    for (const [id, action] of [['btn-left','left'],['btn-right','right'],['btn-soft','soft']]) {
      const el = document.getElementById(id);
      if (!el) continue;
      let timer = null;
      const start = () => {
        this._action(action);
        timer = setInterval(() => this._action(action), this.REPEAT_INTERVAL);
      };
      const stop = () => { clearInterval(timer); timer = null; };
      el.addEventListener('touchstart', e => { e.preventDefault(); start(); }, { passive: false });
      el.addEventListener('touchend',   e => { e.preventDefault(); stop(); },  { passive: false });
      el.addEventListener('mousedown',  start);
      el.addEventListener('mouseup',    stop);
      el.addEventListener('mouseleave', stop);
    }
  }

  _key(code) {
    if (this.gameOver) { if (code === 'KeyR') this._restart(); return; }
    switch (code) {
      case 'ArrowLeft':  this._action('left');      break;
      case 'ArrowRight': this._action('right');     break;
      case 'ArrowDown':  this._action('soft');      break;
      case 'ArrowUp':    this._action('rotateCW');  break;
      case 'KeyX':       this._action('rotateCW');  break;
      case 'KeyZ':       this._action('rotateCCW'); break;
      case 'KeyC':       this._action('rotateCCW'); break;
      case 'Space':      this._action('drop');      break;
      case 'ShiftLeft':
      case 'ShiftRight': this._action('hold');      break;
      case 'KeyQ':       this._activateSkill('TIME_WARP');         break;
      case 'KeyW':       this._activateSkill('MAGNETIC_COLLAPSE'); break;
      case 'KeyE':       this._activateSkill('HOLD_LOCK');         break;
    }
  }

  _action(type) {
    if (this.gameOver) return;
    const b = this.playerBoard;
    switch (type) {
      case 'left':      b.moveLeft(); break;
      case 'right':     b.moveRight(); break;
      case 'soft':      { const moved = b.moveDown(); if (!moved) this._lock(b, this.enemyBoard); break; }
      case 'rotateCW':  b.rotate(1);  break;
      case 'rotateCCW': b.rotate(-1); break;
      case 'hold':      b.hold();     break;
      case 'drop': {
        const res = b.hardDrop();
        if (res) this._lock2(res, b, this.enemyBoard);
        break;
      }
    }
  }

  _activateSkill(id) {
    if (this.activeSkill || this.gameOver) return;
    if (this.playerBoard.mp < SKILL_COSTS[id]) return;
    this.playerBoard.mp -= SKILL_COSTS[id];
    this.activeSkill = id;
    switch (id) {
      case 'TIME_WARP':
        this.skillTimer = 4000;
        this.timeFactor = 0.3;
        break;
      case 'MAGNETIC_COLLAPSE':
        this.playerBoard.magneticCollapse();
        this.activeSkill = null;
        break;
      case 'HOLD_LOCK':
        this.enemyBoard.holdLocked = true;
        this.enemyBoard.held = BLOCK_TYPES.GARBAGE;
        this.skillTimer = 5000;
        break;
    }
  }

  _lock(board, opponent) {
    const res = board.lock();
    this._lock2(res, board, opponent);
  }

  _lock2(res, attacker, defender) {
    if (attacker.defeated) { this._end(attacker === this.playerBoard ? 'ENEMY' : 'PLAYER'); return; }
    if (res.attack > 0) {
      defender.receiveGarbage(res.attack, defender.hasIceMino() ? 0.5 : 1);
    }
    if (defender.defeated) this._end(attacker === this.playerBoard ? 'PLAYER' : 'ENEMY');
  }

  _end(winner) { this.gameOver = true; this.winner = winner; }
  _restart() { window.location.reload(); }

  // ── Game loop ──────────────────────────────────────────────────────────────
  start() {
    this._last = performance.now();
    requestAnimationFrame(t => this._loop(t));
  }

  _loop(now) {
    const raw = now - this._last;
    this._last = now;
    if (!this.gameOver) this._update(raw * this.timeFactor, now);
    this._render();
    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt, now) {
    // Key repeat
    for (const code of this.keys) {
      const rep = this.keyRepeat[code];
      if (rep && now >= rep.next) {
        rep.next = now + this.REPEAT_INTERVAL;
        if (code === 'ArrowLeft')  this.playerBoard.moveLeft();
        else if (code === 'ArrowRight') this.playerBoard.moveRight();
        else if (code === 'ArrowDown') {
          if (!this.playerBoard.moveDown()) this._lock(this.playerBoard, this.enemyBoard);
        }
      }
    }

    // Auto fall
    this.fallTimer += dt;
    if (this.fallTimer >= this.fallInterval) {
      this.fallTimer = 0;
      if (!this.playerBoard.moveDown()) this._lock(this.playerBoard, this.enemyBoard);
    }

    // Infection timers
    this.playerBoard.tickInfection(dt);
    this.enemyBoard.tickInfection(dt);

    // Skill timer
    if (this.activeSkill && this.skillTimer > 0) {
      this.skillTimer -= dt;
      if (this.skillTimer <= 0) {
        if (this.activeSkill === 'TIME_WARP')  this.timeFactor = 1;
        if (this.activeSkill === 'HOLD_LOCK') this.enemyBoard.holdLocked = false;
        this.activeSkill = null;
        this.skillTimer = 0;
      }
    }

    // AI
    this.ai.tick(this.enemyBoard, now);
    this.aiTimer += dt;
    if (this.aiTimer >= this.aiInterval) {
      this.aiTimer = 0;
      const res = this.ai.executeNextMove(this.enemyBoard);
      if (res) this._lock2(res, this.enemyBoard, this.playerBoard);
      if (this.enemyBoard.defeated) this._end('PLAYER');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  _render() {
    const r   = this.renderer;
    const ctx = this.canvas.getContext('2d');
    r.clear();

    // Title
    ctx.fillStyle = '#5577cc';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚔  BATTLE BLOCK STAR  ⚔', CANVAS_W / 2, 30);
    ctx.textAlign = 'left';

    // ── Player ─────────────────────────────────────────────────────────────
    r.drawHold(this.playerBoard.held, P_HOLD_X, TOP, this.playerBoard.holdLocked);
    r.drawBoard(this.playerBoard, P_BOARD_X, TOP, 'YOU');
    r.drawGarbage(this.playerBoard.garbageQueue, P_GARB_X, TOP, BH);
    r.drawNext(this.playerBoard.nextQueue, P_NEXT_X, TOP);

    // Player status
    r.drawCombo(this.playerBoard.combo, P_BOARD_X, STATUS_Y - 4);
    r.drawMP(this.playerBoard.mp, P_BOARD_X, STATUS_Y + 12);
    r.drawSkills(this.playerBoard.mp, SKILL_COSTS, this.activeSkill, P_BOARD_X, STATUS_Y + 32);

    // ── Enemy ──────────────────────────────────────────────────────────────
    r.drawNext(this.enemyBoard.nextQueue, E_NEXT_X, TOP);
    r.drawGarbage(this.enemyBoard.garbageQueue, E_GARB_X, TOP, BH);
    r.drawBoard(this.enemyBoard, E_BOARD_X, TOP, 'ENEMY AI');
    r.drawHold(this.enemyBoard.held, E_HOLD_X, TOP, this.enemyBoard.holdLocked);

    ctx.fillStyle = '#556';
    ctx.font = '10px monospace';
    ctx.fillText(`AI: ${this.ai.type}`, E_BOARD_X, STATUS_Y + 10);

    // ── Overlays ───────────────────────────────────────────────────────────
    r.drawSkillOverlay(this.activeSkill, this.skillTimer);
    if (this.playerBoard.defeated) r.drawDefeatOverlay(P_BOARD_X, TOP, BW, BH);
    if (this.enemyBoard.defeated)  r.drawDefeatOverlay(E_BOARD_X, TOP, BW, BH);
    if (this.gameOver) r.drawGameOver(this.winner, CANVAS_W, CANVAS_H);

    // Update skill button states for HTML buttons
    this._syncButtonStates();
  }

  _syncButtonStates() {
    const mp = this.playerBoard.mp;
    const costs = { 'btn-skill-tw': SKILL_COSTS.TIME_WARP, 'btn-skill-mc': SKILL_COSTS.MAGNETIC_COLLAPSE, 'btn-skill-hl': SKILL_COSTS.HOLD_LOCK };
    for (const [id, cost] of Object.entries(costs)) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('disabled', mp < cost || !!this.activeSkill);
    }
    const restart = document.getElementById('btn-restart');
    if (restart) restart.style.display = this.gameOver ? 'block' : 'none';
  }
}
