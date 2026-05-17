import { Board } from './board.js';
import { EnemyAI } from './ai.js';
import { Renderer } from './renderer.js';
import { BOARD_COLS, BOARD_ROWS, CELL_SIZE, SKILL_COSTS, BLOCK_TYPES } from './constants.js';

const CANVAS_W = 900;
const CANVAS_H = 700;
const BOARD_TOP = 60;

// Player board left edge, enemy board left edge
const PLAYER_X = 30;
const ENEMY_X = 500;
const BOARD_H = BOARD_ROWS * CELL_SIZE;

export class Game {
  constructor(canvas, aiType = 'balanced') {
    this.canvas = canvas;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    this.renderer = new Renderer(canvas);

    this.playerBoard = new Board(0.08);
    this.enemyBoard = new Board(0.0);

    this.ai = new EnemyAI(aiType);
    this.aiActionTimer = 0;
    this.aiActionInterval = aiType === 'fast' ? 120 : 400;

    this.fallInterval = 800; // ms per auto-drop
    this.fallTimer = 0;

    this.activeSkill = null;
    this.skillTimer = 0;
    this.timeWarpFactor = 1;

    this.gameOver = false;
    this.winner = null;

    this.lastTime = 0;
    this.keys = new Set();
    this.keyRepeat = {};
    this.KEY_REPEAT_DELAY = 150;
    this.KEY_REPEAT_INTERVAL = 50;

    this._bindInput();
  }

  _bindInput() {
    window.addEventListener('keydown', e => {
      if (this.keys.has(e.code)) return;
      this.keys.add(e.code);
      this.keyRepeat[e.code] = { next: Date.now() + this.KEY_REPEAT_DELAY };
      this._handleKey(e.code);
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code);
      delete this.keyRepeat[e.code];
    });
  }

  _handleKey(code) {
    if (this.gameOver) {
      if (code === 'KeyR') this._restart(); return;
    }
    const b = this.playerBoard;
    switch (code) {
      case 'ArrowLeft': b.moveLeft(); break;
      case 'ArrowRight': b.moveRight(); break;
      case 'ArrowDown': b.moveDown(); break;
      case 'ArrowUp': case 'KeyX': b.rotate(1); break;
      case 'KeyZ': this._activateSkill('TIME_WARP'); break; // overloaded - check
      case 'KeyC': b.rotate(-1); break;
      case 'Space': {
        const result = b.hardDrop();
        if (result) this._processLockResult(result, b, this.enemyBoard);
        break;
      }
      case 'ShiftLeft': case 'ShiftRight': b.hold(); break;
      case 'KeyQ': this._activateSkill('TIME_WARP'); break;
      case 'KeyW': this._activateSkill('MAGNETIC_COLLAPSE'); break;
      case 'KeyE': this._activateSkill('HOLD_LOCK'); break;
    }
  }

  _activateSkill(id) {
    if (this.activeSkill) return;
    const cost = SKILL_COSTS[id];
    if (this.playerBoard.mp < cost) return;
    this.playerBoard.mp -= cost;
    this.activeSkill = id;

    switch (id) {
      case 'TIME_WARP':
        this.skillTimer = 4000;
        this.timeWarpFactor = 0.3;
        break;
      case 'MAGNETIC_COLLAPSE':
        this.playerBoard.magneticCollapse();
        this.activeSkill = null;
        break;
      case 'HOLD_LOCK':
        this.enemyBoard.holdLocked = true;
        // replace enemy held with garbage
        this.enemyBoard.held = BLOCK_TYPES.GARBAGE;
        this.skillTimer = 5000;
        break;
    }
  }

  _processLockResult(result, attacker, defender) {
    if (attacker.defeated) {
      this._endGame(attacker === this.playerBoard ? 'ENEMY' : 'PLAYER');
      return;
    }
    if (result.attack > 0) {
      const iceSlow = defender.hasIceMino() ? 0.5 : 1;
      defender.receiveGarbage(result.attack, iceSlow);
    }
    if (defender.defeated) {
      this._endGame(attacker === this.playerBoard ? 'PLAYER' : 'ENEMY');
    }
  }

  _endGame(winner) {
    this.gameOver = true;
    this.winner = winner;
  }

  _restart() {
    // Reload page for clean state
    window.location.reload();
  }

  start() {
    this.lastTime = performance.now();
    requestAnimationFrame(t => this._loop(t));
  }

  _loop(now) {
    const rawDelta = now - this.lastTime;
    this.lastTime = now;
    const delta = rawDelta * this.timeWarpFactor;

    if (!this.gameOver) {
      this._update(delta, now);
    }

    this._render();
    requestAnimationFrame(t => this._loop(t));
  }

  _update(delta, now) {
    // Key repeat
    for (const code of this.keys) {
      const rep = this.keyRepeat[code];
      if (rep && now >= rep.next) {
        rep.next = now + this.KEY_REPEAT_INTERVAL;
        if (code === 'ArrowLeft') this.playerBoard.moveLeft();
        else if (code === 'ArrowRight') this.playerBoard.moveRight();
        else if (code === 'ArrowDown') {
          const moved = this.playerBoard.moveDown();
          if (!moved) {
            const result = this.playerBoard.lock();
            this._processLockResult(result, this.playerBoard, this.enemyBoard);
          }
        }
      }
    }

    // Player auto-fall
    this.fallTimer += delta;
    if (this.fallTimer >= this.fallInterval) {
      this.fallTimer = 0;
      const moved = this.playerBoard.moveDown();
      if (!moved) {
        const result = this.playerBoard.lock();
        this._processLockResult(result, this.playerBoard, this.enemyBoard);
      }
    }

    // Infection tick
    this.playerBoard.tickInfection(delta);
    this.enemyBoard.tickInfection(delta);

    // Skill timer
    if (this.activeSkill && this.skillTimer > 0) {
      this.skillTimer -= delta;
      if (this.skillTimer <= 0) {
        if (this.activeSkill === 'TIME_WARP') this.timeWarpFactor = 1;
        if (this.activeSkill === 'HOLD_LOCK') this.enemyBoard.holdLocked = false;
        this.activeSkill = null;
        this.skillTimer = 0;
      }
    }

    // AI tick
    this.ai.tick(this.enemyBoard, now);
    this.aiActionTimer += delta;
    if (this.aiActionTimer >= this.aiActionInterval) {
      this.aiActionTimer = 0;
      const result = this.ai.executeNextMove(this.enemyBoard);
      if (result) {
        this._processLockResult(result, this.enemyBoard, this.playerBoard);
      }
      if (this.enemyBoard.defeated) this._endGame('PLAYER');
    }
  }

  _render() {
    const r = this.renderer;
    r.clear();

    const BW = BOARD_COLS * CELL_SIZE;
    const BH = BOARD_ROWS * CELL_SIZE;

    // Title
    const ctx = this.canvas.getContext('2d');
    ctx.fillStyle = '#88aaff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BATTLE BLOCK STAR', CANVAS_W / 2, 30);
    ctx.textAlign = 'left';

    // Player board
    r.drawBoard(this.playerBoard, PLAYER_X + 20, BOARD_TOP, 'PLAYER');
    r.drawHold(this.playerBoard.held, PLAYER_X + 20 + BW + 14, BOARD_TOP, this.playerBoard.holdLocked);
    r.drawNext(this.playerBoard.nextQueue, PLAYER_X + 20 + BW + 14, BOARD_TOP + 5 * CELL_SIZE);
    r.drawMP(this.playerBoard.mp, PLAYER_X + 20, BOARD_TOP + BH + 8);
    r.drawSkillButtons(this.playerBoard.mp, SKILL_COSTS, this.activeSkill, PLAYER_X + 20, BOARD_TOP + BH + 28);
    r.drawCombo(this.playerBoard.combo, PLAYER_X + 20, BOARD_TOP + BH + 6);
    r.drawGarbageQueue(this.playerBoard.garbageQueue, PLAYER_X + 8, BOARD_TOP, BH);

    // Enemy board
    r.drawBoard(this.enemyBoard, ENEMY_X, BOARD_TOP, 'ENEMY AI');
    r.drawHold(this.enemyBoard.held, ENEMY_X - 90, BOARD_TOP, this.enemyBoard.holdLocked);
    r.drawNext(this.enemyBoard.nextQueue, ENEMY_X + BW + 14, BOARD_TOP);
    r.drawGarbageQueue(this.enemyBoard.garbageQueue, ENEMY_X + BW + 8, BOARD_TOP, BH);

    // AI type label
    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.fillText(`AI: ${this.ai.type}`, ENEMY_X, BOARD_TOP + BH + 16);

    // Skill overlay
    if (this.activeSkill && this.skillTimer > 0) {
      r.drawActiveSkillOverlay(this.activeSkill, this.skillTimer, this.canvas);
    }

    // Controls hint
    ctx.fillStyle = '#555';
    ctx.font = '10px monospace';
    const hints = ['← → : Move', '↑/X : Rotate CW', 'C : Rotate CCW', '↓ : Soft Drop', 'Space : Hard Drop', 'Shift : Hold', 'Q: Time Warp (40MP)', 'W: Mag.Collapse (70MP)', 'E: Hold Lock (30MP)'];
    hints.forEach((h, i) => ctx.fillText(h, PLAYER_X + 20 + BW + 80, BOARD_TOP + BH + 30 + i * 14));

    // Defeat overlays
    if (this.playerBoard.defeated) r.drawDefeat('PLAYER', PLAYER_X + 20, BOARD_TOP, BW, BH);
    if (this.enemyBoard.defeated) r.drawDefeat('ENEMY', ENEMY_X, BOARD_TOP, BW, BH);

    // Game over banner
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = this.winner === 'PLAYER' ? '#44ff44' : '#ff4444';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.winner === 'PLAYER' ? 'YOU WIN!' : 'GAME OVER', CANVAS_W / 2, CANVAS_H / 2);
      ctx.fillStyle = '#aaa';
      ctx.font = '20px monospace';
      ctx.fillText('Press R to restart', CANVAS_W / 2, CANVAS_H / 2 + 50);
      ctx.textAlign = 'left';
    }
  }
}
