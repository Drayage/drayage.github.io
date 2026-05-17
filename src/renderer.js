import { BOARD_COLS, BOARD_ROWS, CELL_SIZE, COLORS, BLOCK_TYPES, MINO_SHAPES } from './constants.js';

const PADDING = 2;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  clear() {
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBoard(board, offsetX, offsetY, label = '') {
    const ctx = this.ctx;
    const W = BOARD_COLS * CELL_SIZE;
    const H = BOARD_ROWS * CELL_SIZE;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(offsetX, offsetY, W, H);

    // Grid lines
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= BOARD_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + r * CELL_SIZE);
      ctx.lineTo(offsetX + W, offsetY + r * CELL_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= BOARD_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + c * CELL_SIZE, offsetY);
      ctx.lineTo(offsetX + c * CELL_SIZE, offsetY + H);
      ctx.stroke();
    }

    // Placed cells
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const cell = board.grid[r][c];
        if (cell !== 0) this._drawCell(ctx, offsetX + c * CELL_SIZE, offsetY + r * CELL_SIZE, cell);
      }
    }

    // Infection countdown overlays
    for (const inf of board.infectionMinos) {
      for (const { x, y } of inf.cells) {
        ctx.fillStyle = `rgba(255, 0, 255, ${0.3 + 0.7 * (1 - inf.timer / 3000)})`;
        ctx.fillRect(offsetX + x * CELL_SIZE, offsetY + y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText((inf.timer / 1000).toFixed(1), offsetX + x * CELL_SIZE + 2, offsetY + y * CELL_SIZE + 14);
      }
    }

    // Ghost piece
    if (board.current && !board.defeated) {
      const gy = board.ghostY();
      const ghost = board.current.clone();
      ghost.y = gy;
      for (const { x, y } of ghost.cells) {
        if (y >= 0) {
          ctx.strokeStyle = COLORS[board.current.typeId] || '#fff';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(
            offsetX + x * CELL_SIZE + PADDING,
            offsetY + y * CELL_SIZE + PADDING,
            CELL_SIZE - PADDING * 2,
            CELL_SIZE - PADDING * 2
          );
        }
      }
    }

    // Current piece
    if (board.current && !board.defeated) {
      for (const { x, y } of board.current.cells) {
        if (y >= 0) this._drawCell(ctx, offsetX + x * CELL_SIZE, offsetY + y * CELL_SIZE, board.current.typeId);
      }
    }

    // Border
    ctx.strokeStyle = board.defeated ? '#ff0000' : '#4444aa';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, W, H);

    // Label
    ctx.fillStyle = '#ccc';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(label, offsetX, offsetY - 6);
  }

  _drawCell(ctx, px, py, typeId) {
    const color = COLORS[typeId] || COLORS[String(typeId)] || '#888';
    ctx.fillStyle = color;
    ctx.fillRect(px + PADDING, py + PADDING, CELL_SIZE - PADDING * 2, CELL_SIZE - PADDING * 2);

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(px + PADDING, py + PADDING, CELL_SIZE - PADDING * 2, 4);

    // Special overlays
    if (typeId === BLOCK_TYPES.BOMB) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('💣', px + 2, py + CELL_SIZE - 4);
    } else if (typeId === BLOCK_TYPES.ICE) {
      ctx.fillStyle = 'rgba(180,240,255,0.4)';
      ctx.fillRect(px + PADDING, py + PADDING, CELL_SIZE - PADDING * 2, CELL_SIZE - PADDING * 2);
    } else if (typeId === BLOCK_TYPES.INFECTION) {
      ctx.fillStyle = 'rgba(255,0,255,0.3)';
      ctx.fillRect(px + PADDING, py + PADDING, CELL_SIZE - PADDING * 2, CELL_SIZE - PADDING * 2);
    } else if (typeId === BLOCK_TYPES.CORRUPTED) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + PADDING, py + PADDING, CELL_SIZE - PADDING * 2, CELL_SIZE - PADDING * 2);
    }
  }

  drawHold(typeId, offsetX, offsetY, locked = false) {
    const ctx = this.ctx;
    ctx.fillStyle = '#222';
    ctx.fillRect(offsetX, offsetY, 5 * CELL_SIZE, 4 * CELL_SIZE);
    ctx.strokeStyle = locked ? '#ff4444' : '#4444aa';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, 5 * CELL_SIZE, 4 * CELL_SIZE);
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText('HOLD' + (locked ? ' 🔒' : ''), offsetX + 4, offsetY - 4);
    if (typeId !== null) this._drawMinoPreview(typeId, offsetX + CELL_SIZE, offsetY + CELL_SIZE);
  }

  drawNext(queue, offsetX, offsetY) {
    const ctx = this.ctx;
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText('NEXT', offsetX + 4, offsetY - 4);
    for (let i = 0; i < queue.length; i++) {
      this._drawMinoPreview(queue[i], offsetX + CELL_SIZE, offsetY + i * 3 * CELL_SIZE + CELL_SIZE);
    }
  }

  _drawMinoPreview(typeId, px, py) {
    const shape = MINO_SHAPES[typeId]?.[0];
    if (!shape) return;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          this._drawCell(this.ctx, px + c * CELL_SIZE, py + r * CELL_SIZE, typeId);
        }
      }
    }
  }

  drawGarbageQueue(lines, offsetX, offsetY, height) {
    const ctx = this.ctx;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(offsetX, offsetY, 12, height);
    if (lines > 0) {
      const fillH = Math.min((lines / 20) * height, height);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(offsetX, offsetY + height - fillH, 12, fillH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(lines, offsetX, offsetY + height - fillH - 2);
    }
  }

  drawMP(mp, offsetX, offsetY) {
    const ctx = this.ctx;
    const w = 120;
    ctx.fillStyle = '#222';
    ctx.fillRect(offsetX, offsetY, w, 14);
    ctx.fillStyle = '#4488ff';
    ctx.fillRect(offsetX, offsetY, (mp / 100) * w, 14);
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, w, 14);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`MP: ${Math.floor(mp)}`, offsetX + 4, offsetY + 11);
  }

  drawSkillButtons(mp, skillCosts, activeSkill, offsetX, offsetY) {
    const ctx = this.ctx;
    const skills = [
      { name: 'Time Warp', key: 'Z', cost: skillCosts.TIME_WARP, id: 'TIME_WARP' },
      { name: 'Mag.Collapse', key: 'X', cost: skillCosts.MAGNETIC_COLLAPSE, id: 'MAGNETIC_COLLAPSE' },
      { name: 'Hold Lock', key: 'C', cost: skillCosts.HOLD_LOCK, id: 'HOLD_LOCK' },
    ];
    skills.forEach((sk, i) => {
      const x = offsetX;
      const y = offsetY + i * 34;
      const canUse = mp >= sk.cost;
      const active = activeSkill === sk.id;
      ctx.fillStyle = active ? '#224488' : canUse ? '#1a1a3a' : '#1a1a1a';
      ctx.fillRect(x, y, 130, 28);
      ctx.strokeStyle = active ? '#88aaff' : canUse ? '#4488ff' : '#333';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, 130, 28);
      ctx.fillStyle = canUse ? '#eee' : '#555';
      ctx.font = '11px monospace';
      ctx.fillText(`[${sk.key}] ${sk.name}`, x + 6, y + 12);
      ctx.fillStyle = canUse ? '#88aaff' : '#444';
      ctx.font = '10px monospace';
      ctx.fillText(`Cost: ${sk.cost} MP`, x + 6, y + 24);
    });
  }

  drawCombo(combo, offsetX, offsetY) {
    if (combo <= 1) return;
    this.ctx.fillStyle = `hsl(${60 - combo * 5}, 100%, 60%)`;
    this.ctx.font = `bold ${12 + combo * 2}px monospace`;
    this.ctx.fillText(`${combo - 1}x COMBO!`, offsetX, offsetY);
  }

  drawDefeat(label, offsetX, offsetY, W, H) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(offsetX, offsetY, W, H);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DEFEATED', offsetX + W / 2, offsetY + H / 2);
    ctx.textAlign = 'left';
  }

  drawActiveSkillOverlay(skill, timer, canvas) {
    if (!skill) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 80, 200, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#88aaff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${skill} (${(timer / 1000).toFixed(1)}s)`, canvas.width / 2, 30);
    ctx.textAlign = 'left';
  }
}

