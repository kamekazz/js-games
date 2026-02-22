import { Engine } from '@engine/Engine.js';
import { NetworkClient } from '@engine/network/NetworkClient.js';
import { StateBuffer } from '@engine/network/StateBuffer.js';
import { api } from '@engine/network/ApiClient.js';
import { SceneManager } from './scenes/SceneManager.js';
import { AuthScene } from './scenes/AuthScene.js';
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
let currentUser = null; // { display_name, guest, ... }

function getWsUrl(roomCode) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.host}/ws/game/${roomCode}/`;
}

async function createRoom(playerName) {
  try {
    const res = await api.post('/api/rooms/create/', {
      name: `${playerName}'s Room`, max_players: 4,
    });
    if (!res.ok) throw new Error('Failed to create room');
    const room = await res.json();
    joinRoom(room.code, playerName);
  } catch (e) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    joinRoom(code, playerName);
  }
}

function joinRoom(roomCode, playerName) {
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
    if (lobbyScene) lobbyScene.exit();
    lobbyScene = null;

    currentGame = new Game(engine, network, stateBuffer, data.player_id, data.x, data.y, (gameOverData) => {
      resultsScreen = new ResultsScreen(overlay, gameOverData, () => {
        resultsScreen.destroy();
        resultsScreen = null;
        showMenu();
      });
    });
    currentGame.onEliminated = (data) => {
      resultsScreen = new ResultsScreen(overlay, data, () => {
        resultsScreen.destroy();
        resultsScreen = null;
        showMenu();
      });
    };
    currentGame.onExtracted = (data) => {
      resultsScreen = new ResultsScreen(overlay, data, () => {
        resultsScreen.destroy();
        resultsScreen = null;
        showMenu();
      });
    };
    currentGame.onLeave = () => showMenu();
    engine.start();
  });

  network.on('close', () => {
    if (lobbyScene) lobbyScene.updateStatus('Disconnected — retrying...');
  });

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

  const displayName = currentUser ? currentUser.display_name : 'Guest';

  const menu = new MainMenu(
    sceneManager,
    (name) => createRoom(name),
    (code, name) => joinRoom(code, name),
    displayName,
    () => {
      // Logout callback
      currentUser = null;
      api.post('/api/auth/logout/', {}).catch(() => {});
      showAuth();
    },
  );
  sceneManager.switchTo(menu);
}

function showAuth() {
  engine.stop();
  network.disconnect();
  network.listeners.clear();
  if (currentGame) {
    currentGame.destroy();
    currentGame = null;
  }

  const auth = new AuthScene(sceneManager, (user) => {
    currentUser = user;
    showMenu();
  });
  sceneManager.switchTo(auth);
}

// Check if already authenticated
async function init() {
  try {
    const res = await api.get('/api/auth/me/');
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated) {
        currentUser = data;
        showMenu();
        return;
      }
    }
  } catch (e) {
    // Server not available, allow guest play
  }
  showAuth();
}

init();
