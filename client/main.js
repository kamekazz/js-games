import { Engine } from '@engine/Engine.js';
import { NetworkClient } from '@engine/network/NetworkClient.js';
import { StateBuffer } from '@engine/network/StateBuffer.js';
import { SceneManager } from './scenes/SceneManager.js';
import { MainMenu } from './scenes/MainMenu.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { Game } from '@game/Game.js';
import { ResultsScreen } from '@ui/ResultsScreen.js';

const container = document.getElementById('game-container');
const overlay = document.getElementById('ui-overlay');

const engine = new Engine(container);
const network = new NetworkClient();
const stateBuffer = new StateBuffer(100);
const sceneManager = new SceneManager(overlay);

let currentGame = null;
let lobbyScene = null;
let resultsScreen = null;

function getWsUrl(roomCode) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.host}/ws/game/${roomCode}/`;
}

async function createRoom(playerName) {
  try {
    const res = await fetch('/api/rooms/create/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${playerName}'s Room`, max_players: 4 }),
    });
    if (!res.ok) throw new Error('Failed to create room');
    const room = await res.json();
    joinRoom(room.code, playerName);
  } catch (e) {
    // If API unavailable, generate a local code and connect directly
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    joinRoom(code, playerName);
  }
}

function joinRoom(roomCode, playerName) {
  // Clear any previous listeners
  network.listeners.clear();
  network.disconnect();

  lobbyScene = new LobbyScene(sceneManager, roomCode, () => {
    network.disconnect();
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }
    showMenu();
  });
  sceneManager.switchTo(lobbyScene);

  network.on('open', () => {
    console.log('WebSocket connected, sending join...');
    network.send({ type: 'join', name: playerName });
    if (lobbyScene) lobbyScene.updateStatus('Connected! Joining game...');
  });

  network.on('joined', (data) => {
    console.log('Joined as', data.player_id);
    // Hide the lobby overlay — game is starting
    if (lobbyScene) lobbyScene.exit();
    lobbyScene = null;

    // Start the game with game-over callback
    currentGame = new Game(engine, network, stateBuffer, data.player_id, data.x, data.y, (gameOverData) => {
      // Show results screen
      resultsScreen = new ResultsScreen(overlay, gameOverData, () => {
        resultsScreen.destroy();
        resultsScreen = null;
        showMenu();
      });
    });
    engine.start();
  });

  network.on('close', () => {
    if (lobbyScene) lobbyScene.updateStatus('Disconnected — retrying...');
  });

  // Connect after listeners are set up
  network.connect(getWsUrl(roomCode));
}

function showMenu() {
  engine.stop();
  network.disconnect();
  network.listeners.clear();
  if (currentGame) {
    currentGame.destroy();
    currentGame = null;
  }
  if (resultsScreen) {
    resultsScreen.destroy();
    resultsScreen = null;
  }
  const menu = new MainMenu(
    sceneManager,
    (name) => createRoom(name),
    (code, name) => joinRoom(code, name),
  );
  sceneManager.switchTo(menu);
}

// Start at main menu
showMenu();
