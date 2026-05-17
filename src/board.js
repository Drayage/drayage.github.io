import { BOARD_COLS, BOARD_ROWS, BLOCK_TYPES, ATTACK_TABLE, MP_PER_LINE } from './constants.js';
import { Mino, WALL_KICKS } from './mino.js';
import { Deck } from './deck.js';

export class Board {
  constructor(specialChance = 0.1) {
    this.grid = Array.from({ length: BOARD_ROWS }, () => new Array(BOARD_COLS).fill(0));
    this.deck = new Deck(specialChance);
    this.current = null;
    this.held = null;
    this.holdUsed = false;
    this.holdLocked = false; // skill: Hold Lock
    this.nextQueue = [];
    this.garbageQueue = 0; // pending garbage lines
    this.combo = 0;
    this.mp = 0;
    this.defeated = false;
    this.iceRows = new Set(); // rows frozen by Ice mino
    this.infectionMinos = []; // { x, y, timer }
    this.corruptedCells = new Set(); // "row,col"
    this.lastClearLines = 0;
    this.lastAttackSent = 0;
    this._fillNextQueue();
    this.spawnNext();
  }

  _fillNextQueue() {
    while (this.nextQueue.length < 3) {
      this.nextQueue.push(this.deck.draw());
    }
  }

  spawnNext() {
    const typeId = this.nextQueue.shift();
    this._fillNextQueue();
    this.current = new Mino(typeId, 3, 0);
    this.holdUsed = false;

    if (!this._isValid(this.current)) {
      this.defeated = true;
    }

    if (this.current.typeId === BLOCK_TYPES.INFECTION) {
      // timer set after placement, not spawn
    }
  }

  hold() {
    if (this.holdUsed || this.holdLocked) return false;
    if (this.held === null) {
      this.held = this.current.typeId;
      this.spawnNext();
    } else {
      const tmp = this.held;
      this.held = this.current.typeId;
      this.current = new Mino(tmp, 3, 0);
    }
    this.holdUsed = true;
    return true;
  }

  _isValid(mino, dx = 0, dy = 0, rot = null) {
    const m = mino.clone();
    m.x += dx;
    m.y += dy;
    if (rot !== null) m.rotation = rot;
    for (const { x, y } of m.cells) {
      if (x < 0 || x >= BOARD_COLS || y >= BOARD_ROWS) return false;
      if (y < 0) continue;
      if (this.grid[y][x] !== 0) return false;
    }
    return true;
  }

  moveLeft() { if (this._isValid(this.current, -1, 0)) this.current.x--; }
  moveRight() { if (this._isValid(this.current, 1, 0)) this.current.x++; }
  moveDown() {
    if (this._isValid(this.current, 0, 1)) { this.current.y++; return true; }
    return false;
  }

  rotate(dir = 1) {
    const oldRot = this.current.rotation;
    const newRot = (oldRot + (dir > 0 ? 1 : MINO_SHAPES_LEN(this.current.typeId) - 1)) %
      MINO_SHAPES_LEN(this.current.typeId);
    const key = `${oldRot}->${newRot}`;
    const kicks = WALL_KICKS[key] || [[0, 0]];
    for (const [kx, ky] of kicks) {
      if (this._isValid(this.current, kx, -ky, newRot)) {
        this.current.x += kx;
        this.current.y -= ky;
        this.current.rotation = newRot;
        return true;
      }
    }
    return false;
  }

  hardDrop() {
    if (this.current.typeId === BLOCK_TYPES.DRILL) {
      // Drill: force to bottom row
      const cells = this.current.cells;
      const minX = Math.min(...cells.map(c => c.x));
      this.current.y = BOARD_ROWS - this.current.shape.length;
    } else {
      while (this._isValid(this.current, 0, 1)) this.current.y++;
    }
    return this.lock();
  }

  ghostY() {
    let gy = this.current.y;
    while (this._isValid(this.current, 0, gy - this.current.y + 1)) gy++;
    return gy;
  }

  lock() {
    const mino = this.current;
    const typeId = mino.typeId;
    let events = [];

    // place cells
    for (const { x, y } of mino.cells) {
      if (y < 0) { this.defeated = true; return { events: ['top-out'] }; }
      this.grid[y][x] = typeId;
    }

    // Infection mino timer
    if (typeId === BLOCK_TYPES.INFECTION) {
      this.infectionMinos.push({ cells: mino.cells, timer: 3000, placed: true });
    }

    // Drill mino: already dropped to bottom
    // Ice mino: mark rows
    if (typeId === BLOCK_TYPES.ICE) {
      for (const { y } of mino.cells) this.iceRows.add(y);
    }

    const cleared = this._clearLines(typeId);
    this.lastClearLines = cleared;

    if (cleared > 0) {
      this.combo++;
      const base = ATTACK_TABLE[Math.min(cleared, 4)];
      const comboBonus = this.combo - 1;
      let attack = base + comboBonus;
      if (typeId === BLOCK_TYPES.INFECTION && cleared > 0) attack *= 3; // Infection bonus
      this.mp = Math.min(100, this.mp + cleared * MP_PER_LINE);
      const cancelled = Math.min(attack, this.garbageQueue);
      this.garbageQueue -= cancelled;
      attack -= cancelled;
      this.lastAttackSent = attack;
      events.push('clear');
    } else {
      this.combo = 0;
      this.lastAttackSent = 0;
      // apply pending garbage
      if (this.garbageQueue > 0) {
        this._applyGarbage(this.garbageQueue);
        this.garbageQueue = 0;
      }
    }

    this.spawnNext();
    return { events, cleared, attack: this.lastAttackSent };
  }

  _clearLines(lockedType) {
    let cleared = 0;
    const bombRows = [];
    for (let r = BOARD_ROWS - 1; r >= 0; r--) {
      const full = this.grid[r].every(c => c !== 0 && c !== BLOCK_TYPES.EMPTY);
      if (full && !this.iceRows.has(r)) {
        // check for bomb cells in this row
        const hasBomb = this.grid[r].some(c => c === BLOCK_TYPES.BOMB);
        if (hasBomb) bombRows.push(r);
        this.grid.splice(r, 1);
        this.grid.unshift(new Array(BOARD_COLS).fill(0));
        this.iceRows = new Set([...this.iceRows].map(ir => ir <= r ? ir : ir - 1));
        cleared++;
        r++; // recheck same index
      }
    }
    // Bomb: clear 3x3 around bomb position
    for (const br of bombRows) {
      this._bombClear(br);
    }
    return cleared;
  }

  _bombClear(row) {
    for (let r = Math.max(0, row - 1); r <= Math.min(BOARD_ROWS - 1, row + 1); r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (this.grid[r][c] === BLOCK_TYPES.GARBAGE || this.grid[r][c] < 0) {
          this.grid[r][c] = 0;
        }
      }
    }
  }

  _applyGarbage(lines) {
    const hole = Math.floor(Math.random() * BOARD_COLS);
    for (let i = 0; i < lines; i++) {
      if (this.grid[0].some(c => c !== 0)) {
        this.defeated = true;
        return;
      }
      this.grid.shift();
      const garbageLine = new Array(BOARD_COLS).fill(BLOCK_TYPES.GARBAGE);
      garbageLine[hole] = 0;
      this.grid.push(garbageLine);
    }
  }

  receiveGarbage(lines, iceSlowFactor = 1) {
    const adjusted = Math.ceil(lines * iceSlowFactor);
    this.garbageQueue += adjusted;
  }

  // Skill: Magnetic Collapse - move holes up, blocks down
  magneticCollapse() {
    for (let c = 0; c < BOARD_COLS; c++) {
      const blocks = [];
      for (let r = 0; r < BOARD_ROWS; r++) {
        if (this.grid[r][c] !== 0) blocks.push(this.grid[r][c]);
      }
      for (let r = 0; r < BOARD_ROWS; r++) {
        const fromBottom = BOARD_ROWS - 1 - r;
        this.grid[fromBottom][c] = r < blocks.length ? blocks[blocks.length - 1 - r] : 0;
      }
    }
    this.iceRows.clear();
  }

  // Tick infection timers (call every frame with deltaMs)
  tickInfection(deltaMs) {
    for (let i = this.infectionMinos.length - 1; i >= 0; i--) {
      const inf = this.infectionMinos[i];
      inf.timer -= deltaMs;
      if (inf.timer <= 0) {
        // Spread corruption to orthogonal neighbors
        for (const { x, y } of inf.cells) {
          const neighbors = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < BOARD_COLS && ny >= 0 && ny < BOARD_ROWS) {
              const cell = this.grid[ny][nx];
              if (cell > 0 && cell !== BLOCK_TYPES.INFECTION) {
                this.grid[ny][nx] = BLOCK_TYPES.CORRUPTED;
              }
            }
          }
        }
        this.infectionMinos.splice(i, 1);
      }
    }
  }

  // Has Ice mino on board?
  hasIceMino() {
    return this.iceRows.size > 0 || this.grid.some(row => row.some(c => c === BLOCK_TYPES.ICE));
  }
}

function MINO_SHAPES_LEN(typeId) {
  // All minos have 4 rotation states
  return 4;
}
