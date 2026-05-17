import { BOARD_COLS, BOARD_ROWS, COLORS, BLOCK_TYPES, MINO_SHAPES } from './constants.js';

const PAD = 2;

export class Renderer {
  constructor(canvas, cs = 27) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cs = cs;
  }

  clear() {
    this.ctx.fillStyle = '#0d0d1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBoard(board, ox, oy, label = '') {
    const { ctx, cs } = this;
    const W = BOARD_COLS * cs;
    const H = BOARD_ROWS * cs;

    ctx.fillStyle = '#12122a';
    ctx.fillRect(ox, oy, W, H);

    ctx.strokeStyle = '#1e1e40';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= BOARD_ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(ox, oy + r * cs); ctx.lineTo(ox + W, oy + r * cs); ctx.stroke();
    }
    for (let c = 0; c <= BOARD_COLS; c++) {
      ctx.beginPath(); ctx.moveTo(ox + c * cs, oy); ctx.lineTo(ox + c * cs, oy + H); ctx.stroke();
    }

    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const cell = board.grid[r][c];
        if (cell !== 0) this._cell(ox + c * cs, oy + r * cs, cell);
      }
    }

    // Infection overlays
    for (const inf of board.infectionMinos) {
      for (const { x, y } of inf.cells) {
        ctx.fillStyle = `rgba(255,0,255,${0.2 + 0.6 * (1 - inf.timer / 3000)})`;
        ctx.fillRect(ox + x * cs, oy + y * cs, cs, cs);
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(8, cs * 0.4)}px monospace`;
        ctx.fillText((inf.timer / 1000).toFixed(1), ox + x * cs + 2, oy + y * cs + cs * 0.55);
      }
    }

    // Ghost
    if (board.current && !board.defeated) {
      const gy = board.ghostY();
      const ghost = board.current.clone();
      ghost.y = gy;
      ctx.strokeStyle = COLORS[board.current.typeId] || '#fff';
      ctx.lineWidth = 1;
      for (const { x, y } of ghost.cells) {
        if (y >= 0) ctx.strokeRect(ox + x * cs + PAD, oy + y * cs + PAD, cs - PAD * 2, cs - PAD * 2);
      }
    }

    // Current piece
    if (board.current && !board.defeated) {
      for (const { x, y } of board.current.cells) {
        if (y >= 0) this._cell(ox + x * cs, oy + y * cs, board.current.typeId);
      }
    }

    ctx.strokeStyle = board.defeated ? '#ff2222' : '#3344aa';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, W, H);

    ctx.fillStyle = '#99aacc';
    ctx.font = `bold ${Math.max(10, cs * 0.45)}px monospace`;
    ctx.fillText(label, ox, oy - 5);
  }

  _cell(px, py, typeId) {
    const { ctx, cs } = this;
    const color = COLORS[typeId] ?? COLORS[String(typeId)] ?? '#888';
    ctx.fillStyle = color;
    ctx.fillRect(px + PAD, py + PAD, cs - PAD * 2, cs - PAD * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(px + PAD, py + PAD, cs - PAD * 2, 3);

    if (typeId === BLOCK_TYPES.BOMB) {
      ctx.font = `${cs - 6}px sans-serif`;
      ctx.fillText('💣', px + 1, py + cs - 2);
    } else if (typeId === BLOCK_TYPES.ICE) {
      ctx.fillStyle = 'rgba(180,240,255,0.35)';
      ctx.fillRect(px + PAD, py + PAD, cs - PAD * 2, cs - PAD * 2);
    } else if (typeId === BLOCK_TYPES.INFECTION) {
      ctx.fillStyle = 'rgba(255,0,255,0.28)';
      ctx.fillRect(px + PAD, py + PAD, cs - PAD * 2, cs - PAD * 2);
    } else if (typeId === BLOCK_TYPES.CORRUPTED) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + PAD, py + PAD, cs - PAD * 2, cs - PAD * 2);
    }
  }

  drawHold(typeId, ox, oy, locked = false) {
    const { ctx, cs } = this;
    const W = cs * 4, H = cs * 3;
    ctx.fillStyle = '#181828';
    ctx.fillRect(ox, oy, W, H);
    ctx.strokeStyle = locked ? '#ff3333' : '#334488';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox, oy, W, H);
    ctx.fillStyle = locked ? '#ff6666' : '#8899bb';
    ctx.font = `bold ${Math.max(9, cs * 0.38)}px monospace`;
    ctx.fillText('HOLD' + (locked ? '🔒' : ''), ox + 3, oy - 3);
    if (typeId !== null && typeId !== undefined) {
      this._minoPreview(typeId, ox + cs * 0.5, oy + cs * 0.5);
    }
  }

  drawNext(queue, ox, oy) {
    const { ctx, cs } = this;
    ctx.fillStyle = '#8899bb';
    ctx.font = `bold ${Math.max(9, cs * 0.38)}px monospace`;
    ctx.fillText('NEXT', ox + 3, oy - 3);
    for (let i = 0; i < queue.length; i++) {
      this._minoPreview(queue[i], ox + cs * 0.3, oy + i * cs * 2.8 + cs * 0.3);
    }
  }

  _minoPreview(typeId, px, py) {
    const shape = MINO_SHAPES[typeId]?.[0];
    if (!shape) return;
    const s = Math.floor(this.cs * 0.7);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const color = COLORS[typeId] ?? '#888';
          this.ctx.fillStyle = color;
          this.ctx.fillRect(px + c * s + 1, py + r * s + 1, s - 2, s - 2);
        }
      }
    }
  }

  drawGarbage(lines, ox, oy, h) {
    const { ctx } = this;
    ctx.fillStyle = '#111';
    ctx.fillRect(ox, oy, 10, h);
    if (lines > 0) {
      const fh = Math.min((lines / 20) * h, h);
      ctx.fillStyle = lines >= 8 ? '#ff2222' : lines >= 4 ? '#ff8800' : '#ffcc00';
      ctx.fillRect(ox, oy + h - fh, 10, fh);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(String(lines), ox, oy + h - fh - 2);
    }
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, 10, h);
  }

  drawMP(mp, ox, oy, w = 160) {
    const { ctx } = this;
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(ox, oy, w, 13);
    ctx.fillStyle = mp >= 70 ? '#00aaff' : mp >= 40 ? '#0066cc' : '#003388';
    ctx.fillRect(ox, oy, (mp / 100) * w, 13);
    ctx.strokeStyle = '#334499';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, w, 13);
    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.fillText(`MP ${Math.floor(mp)}/100`, ox + 4, oy + 10);
  }

  drawSkills(mp, skillCosts, active, ox, oy) {
    const { ctx } = this;
    const defs = [
      { id: 'TIME_WARP',          label: '[Q] Time Warp',      cost: skillCosts.TIME_WARP },
      { id: 'MAGNETIC_COLLAPSE',  label: '[W] Mag.Collapse',   cost: skillCosts.MAGNETIC_COLLAPSE },
      { id: 'HOLD_LOCK',          label: '[E] Hold Lock',      cost: skillCosts.HOLD_LOCK },
    ];
    defs.forEach((sk, i) => {
      const x = ox, y = oy + i * 30;
      const can = mp >= sk.cost;
      const isActive = active === sk.id;
      ctx.fillStyle = isActive ? '#1a3366' : can ? '#111a33' : '#0d0d1a';
      ctx.fillRect(x, y, 160, 24);
      ctx.strokeStyle = isActive ? '#88aaff' : can ? '#3355aa' : '#222233';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, 160, 24);
      ctx.fillStyle = can ? '#ccd8ff' : '#334';
      ctx.font = '10px monospace';
      ctx.fillText(`${sk.label}  ${sk.cost}MP`, x + 5, y + 16);
    });
  }

  drawCombo(combo, ox, oy) {
    if (combo < 2) return;
    this.ctx.fillStyle = `hsl(${Math.max(0, 55 - combo * 5)},100%,60%)`;
    this.ctx.font = `bold ${11 + combo}px monospace`;
    this.ctx.fillText(`${combo - 1}× COMBO`, ox, oy);
  }

  drawDefeatOverlay(ox, oy, W, H) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(ox, oy, W, H);
    ctx.fillStyle = '#ff3333';
    ctx.font = `bold ${Math.floor(W / 8)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('DEFEATED', ox + W / 2, oy + H / 2);
    ctx.textAlign = 'left';
  }

  drawSkillOverlay(skill, timer) {
    if (!skill || timer <= 0) return;
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,60,180,0.07)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#aabbff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${skill.replace('_', ' ')}  ${(timer / 1000).toFixed(1)}s`, this.canvas.width / 2, 28);
    ctx.textAlign = 'left';
  }

  drawGameOver(winner, W, H) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = winner === 'PLAYER' ? '#33ff66' : '#ff3333';
    ctx.font = `bold 52px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(winner === 'PLAYER' ? 'YOU WIN!' : 'GAME OVER', W / 2, H / 2 - 10);
    ctx.fillStyle = '#aaa';
    ctx.font = '18px monospace';
    ctx.fillText('Tap  R  or  RESTART  button', W / 2, H / 2 + 36);
    ctx.textAlign = 'left';
  }
}
