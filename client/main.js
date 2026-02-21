import { Engine } from '@engine/Engine.js';
import { Game } from '@game/Game.js';

const container = document.getElementById('game-container');
const engine = new Engine(container);
const game = new Game(engine);

engine.start();
