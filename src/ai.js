import { BOARD_COLS, BOARD_ROWS, BLOCK_TYPES } from './constants.js';
import { Mino, WALL_KICKS } from './mino.js';

function evalBoard(grid) {
  let totalHeight = 0, holes = 0, bumpiness = 0, completeLines = 0;
  const colHeights = new Array(BOARD_COLS).fill(0);

  for (let c = 0; c < BOARD_COLS; c++) {
    for (let r = 0; r < BOARD_ROWS; r++) {
      if (grid[r][c] !== 0) {
        colHeights[c] = BOARD_ROWS - r;
        break;
      }
    }
  }
  for (let c = 0; c < BOARD_COLS; c++) totalHeight += colHeights[c];
  for (let c = 0; c < BOARD_COLS - 1; c++) bumpiness += Math.abs(colHeights[c] - colHeights[c + 1]);

  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (grid[r][c] === 0) {
        for (let rr = 0; rr < r; rr++) {
          if (grid[rr][c] !== 0) { holes++; break; }
        }
      }
    }
    if (grid[r].every(c => c !== 0)) completeLines++;
  }

  return { totalHeight, holes, bumpiness, completeLines };
}

function simulateDrop(grid, mino) {
  const g = grid.map(r => [...r]);
  let dy = 0;
  const testMino = mino.clone();
  while (true) {
    testMino.y = mino.y + dy + 1;
    const valid = testMino.cells.every(({ x, y }) =>
      x >= 0 && x < BOARD_COLS && y < BOARD_ROWS &&
      (y < 0 || g[y][x] === 0)
    );
    if (!valid) break;
    dy++;
  }
  testMino.y = mino.y + dy;
  for (const { x, y } of testMino.cells) {
    if (y >= 0 && y < BOARD_ROWS) g[y][x] = mino.typeId;
  }
  // clear lines
  let cleared = 0;
  for (let r = BOARD_ROWS - 1; r >= 0; r--) {
    if (g[r].every(c => c !== 0)) { g.splice(r, 1); g.unshift(new Array(BOARD_COLS).fill(0)); cleared++; r++; }
  }
  return { grid: g, cleared, finalY: testMino.y };
}

function isValidPos(grid, mino) {
  return mino.cells.every(({ x, y }) =>
    x >= 0 && x < BOARD_COLS && (y < 0 || (y < BOARD_ROWS && grid[y][x] === 0))
  );
}

export class EnemyAI {
  constructor(type = 'balanced') {
    this.type = type;
    this.tickInterval = type === 'fast' ? 100 : 500;
    this.lastTick = 0;
    this.targetMove = null;
    this.moveQueue = [];

    // Heuristic weights
    if (type === 'fast') {
      this.weights = { height: -0.51, holes: -0.36, bumpiness: -0.18, lines: 0.76 };
    } else if (type === 'tetris') {
      // Obsesses over Tetris (4 lines)
      this.weights = { height: -0.5, holes: -0.5, bumpiness: -0.6, lines: 3.0 };
    } else {
      this.weights = { height: -0.51, holes: -0.36, bumpiness: -0.18, lines: 1.0 };
    }
  }

  tick(board, now) {
    if (now - this.lastTick < this.tickInterval) return;
    this.lastTick = now;
    if (this.moveQueue.length === 0) {
      this._plan(board);
    }
  }

  _plan(board) {
    const grid = board.grid.map(r => [...r]);
    const mino = board.current;
    if (!mino) return;

    let best = null;
    let bestScore = -Infinity;
    const numRotations = 4;

    for (let rot = 0; rot < numRotations; rot++) {
      const testMino = mino.clone();
      testMino.rotation = rot;
      testMino.x = mino.x;
      testMino.y = 0;

      for (let x = -4; x < BOARD_COLS + 4; x++) {
        testMino.x = x;
        if (!isValidPos(grid, testMino)) continue;
        const { grid: newGrid, cleared } = simulateDrop(grid, testMino);
        const ev = evalBoard(newGrid);

        let score =
          ev.totalHeight * this.weights.height +
          ev.holes * this.weights.holes +
          ev.bumpiness * this.weights.bumpiness +
          ev.completeLines * this.weights.lines;

        // Tetris bot: only reward 4-line clears
        if (this.type === 'tetris') {
          score += cleared === 4 ? 50 : cleared > 0 ? -30 : 0;
        }

        if (score > bestScore) {
          bestScore = score;
          best = { x, rot };
        }
      }
    }

    if (best) {
      this.targetMove = best;
      this._buildMoveQueue(mino, best);
    }
  }

  _buildMoveQueue(mino, target) {
    const queue = [];
    const rotDiff = ((target.rot - mino.rotation) % 4 + 4) % 4;
    for (let i = 0; i < rotDiff; i++) queue.push('rotateRight');
    const dx = target.x - mino.x;
    const move = dx > 0 ? 'moveRight' : 'moveLeft';
    for (let i = 0; i < Math.abs(dx); i++) queue.push(move);
    queue.push('hardDrop');
    this.moveQueue = queue;
  }

  executeNextMove(board) {
    if (this.moveQueue.length === 0) return;
    const action = this.moveQueue.shift();
    if (action === 'moveLeft') board.moveLeft();
    else if (action === 'moveRight') board.moveRight();
    else if (action === 'rotateRight') board.rotate(1);
    else if (action === 'hardDrop') return board.hardDrop();
    return null;
  }
}
