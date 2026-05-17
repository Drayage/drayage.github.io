import { BLOCK_TYPES } from './constants.js';

const BASE_MINOS = [
  BLOCK_TYPES.I, BLOCK_TYPES.O, BLOCK_TYPES.T,
  BLOCK_TYPES.S, BLOCK_TYPES.Z, BLOCK_TYPES.J, BLOCK_TYPES.L,
];
const SPECIAL_MINOS = [
  BLOCK_TYPES.INFECTION, BLOCK_TYPES.ICE,
  BLOCK_TYPES.BOMB, BLOCK_TYPES.DRILL,
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Deck {
  constructor(specialChance = 0.1) {
    this.specialChance = specialChance;
    this.drawPile = [];
    this.discardPile = [];
    this._initDeck();
  }

  _initDeck() {
    // 7 types × 3 = 21 cards
    const initial = [];
    for (const m of BASE_MINOS) {
      initial.push(m, m, m);
    }
    this.drawPile = shuffle(initial);
    this.discardPile = [];
  }

  draw() {
    if (this.drawPile.length === 0) {
      this.drawPile = shuffle(this.discardPile);
      this.discardPile = [];
    }
    const id = this.drawPile.pop();
    // small chance to inject special block
    if (Math.random() < this.specialChance) {
      this.discardPile.push(id);
      return SPECIAL_MINOS[Math.floor(Math.random() * SPECIAL_MINOS.length)];
    }
    this.discardPile.push(id);
    return id;
  }

  peek(n = 3) {
    const result = [];
    let tempDraw = [...this.drawPile];
    let tempDiscard = [...this.discardPile];
    for (let i = 0; i < n; i++) {
      if (tempDraw.length === 0) {
        tempDraw = shuffle(tempDiscard);
        tempDiscard = [];
      }
      const id = tempDraw.pop();
      tempDiscard.push(id);
      // apply same special chance logic approximation (show base for preview)
      result.push(id);
    }
    return result;
  }
}
