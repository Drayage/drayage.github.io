import { Game } from './game.js';

const canvas = document.getElementById('gameCanvas');
const aiSelect = document.getElementById('aiSelect');
const startBtn = document.getElementById('startBtn');

let game = null;

startBtn.addEventListener('click', () => {
  const aiType = aiSelect.value;
  document.getElementById('menu').style.display = 'none';
  canvas.style.display = 'block';
  game = new Game(canvas, aiType);
  game.start();
});
