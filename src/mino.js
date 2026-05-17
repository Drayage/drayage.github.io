import { MINO_SHAPES, BLOCK_TYPES } from './constants.js';

export class Mino {
  constructor(typeId, x = 3, y = 0) {
    this.typeId = typeId;
    this.x = x;
    this.y = y;
    this.rotation = 0;
    this.infectionTimer = null; // for Infection mino
  }

  get shape() {
    return MINO_SHAPES[this.typeId][this.rotation];
  }

  get cells() {
    const result = [];
    const s = this.shape;
    for (let r = 0; r < s.length; r++) {
      for (let c = 0; c < s[r].length; c++) {
        if (s[r][c]) result.push({ x: this.x + c, y: this.y + r });
      }
    }
    return result;
  }

  clone() {
    const m = new Mino(this.typeId, this.x, this.y);
    m.rotation = this.rotation;
    return m;
  }

  rotateRight() {
    const shapes = MINO_SHAPES[this.typeId];
    this.rotation = (this.rotation + 1) % shapes.length;
  }

  rotateLeft() {
    const shapes = MINO_SHAPES[this.typeId];
    this.rotation = (this.rotation + shapes.length - 1) % shapes.length;
  }
}

// SRS wall kick offsets [from_rotation][kick_index][dx, dy]
export const WALL_KICKS = {
  // Standard (non-I)
  '0->1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '1->0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '1->2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '2->1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '2->3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '3->2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '3->0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '0->3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
};
