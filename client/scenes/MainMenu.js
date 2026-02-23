import { api } from '@engine/network/ApiClient.js';
import { Leaderboard } from '@ui/Leaderboard.js';

export class MainMenu {
  constructor(sceneManager, onCreateRoom, onJoinRoom, displayName = 'Player', onLogout = null) {
    this.sceneManager = sceneManager;
    this.onCreateRoom = onCreateRoom;
    this.onJoinRoom = onJoinRoom;
    this.displayName = displayName;
    this.onLogout = onLogout;
    this.el = null;
    this._leaderboard = null;
  }

  async enter(container) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      pointer-events: auto; background: rgba(0,0,0,0.7); color: white; font-family: Arial, sans-serif;
    `;
    this.el.innerHTML = `
      <div style="position: absolute; top: 16px; right: 20px; display: flex; align-items: center; gap: 12px;">
        <span style="color: #aaa; font-size: 14px;">${this.displayName}</span>
        <button id="menu-logout" style="padding: 6px 14px; border-radius: 6px; border: 1px solid #666; background: transparent; color: #888; font-size: 13px; cursor: pointer;">Logout</button>
      </div>
      <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; color: #ff4444;">ZOMBIE SURVIVAL</h1>
      <p style="color: #888; margin-bottom: 2rem;">Top-down multiplayer survival</p>
      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <input id="menu-name" type="text" placeholder="Your name" maxlength="20" value="${this.displayName}"
          style="padding: 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: white; font-size: 16px; text-align: center;" />
        <button id="menu-create" style="padding: 14px; border-radius: 8px; border: none; background: #4488ff; color: white; font-size: 16px; font-weight: bold; cursor: pointer;">
          Create Room
        </button>
        <div style="display: flex; gap: 8px;">
          <input id="menu-code" type="text" placeholder="Room code" maxlength="8"
            style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: white; font-size: 16px; text-align: center; text-transform: uppercase;" />
          <button id="menu-join" style="padding: 12px 20px; border-radius: 8px; border: none; background: #44aa44; color: white; font-size: 16px; font-weight: bold; cursor: pointer;">
            Join
          </button>
        </div>
      </div>
      <button id="menu-leaderboard" style="margin-top: 16px; padding: 12px 28px; border-radius: 8px; border: 1px solid #ffcc44; background: transparent; color: #ffcc44; font-size: 15px; font-weight: bold; cursor: pointer;">
          Leaderboard
        </button>
      <div id="menu-rooms" style="margin-top: 24px; width: 320px; max-height: 200px; overflow-y: auto;"></div>
      <p id="menu-error" style="color: #ff4444; margin-top: 12px; display: none;"></p>
    `;
    container.appendChild(this.el);

    this.el.querySelector('#menu-create').addEventListener('click', () => {
      const name = this.el.querySelector('#menu-name').value.trim() || 'Player';
      this.onCreateRoom(name);
    });

    this.el.querySelector('#menu-join').addEventListener('click', () => {
      const name = this.el.querySelector('#menu-name').value.trim() || 'Player';
      const code = this.el.querySelector('#menu-code').value.trim().toUpperCase();
      if (!code) {
        this.showError('Enter a room code');
        return;
      }
      this.onJoinRoom(code, name);
    });

    this.el.querySelector('#menu-logout').addEventListener('click', () => {
      if (this.onLogout) this.onLogout();
    });

    this.el.querySelector('#menu-leaderboard').addEventListener('click', () => {
      this._leaderboard = new Leaderboard(this.el, () => {
        if (this._leaderboard) {
          this._leaderboard.destroy();
          this._leaderboard = null;
        }
      });
    });

    this._loadRooms();
  }

  async _loadRooms() {
    try {
      const res = await api.get('/api/rooms/');
      if (!res.ok) return;
      const rooms = await res.json();
      const container = this.el.querySelector('#menu-rooms');
      if (!rooms.length) {
        container.innerHTML = '<p style="color: #666; text-align: center;">No open rooms</p>';
        return;
      }
      container.innerHTML = rooms.map(r => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 4px; background: #1a1a2e; border-radius: 6px;">
          <span>${r.name} <span style="color: #666;">(${r.player_count}/${r.max_players})</span></span>
          <div style="display: flex; gap: 4px;">
            <button data-code="${r.code}" style="padding: 6px 14px; border-radius: 6px; border: none; background: #44aa44; color: white; cursor: pointer; font-size: 13px;">Join</button>
            <button data-delete="${r.code}" style="padding: 6px 8px; border-radius: 6px; border: none; background: #ff4444; color: white; cursor: pointer; font-size: 13px; font-weight: bold;">X</button>
          </div>
        </div>
      `).join('');
      container.querySelectorAll('button[data-code]').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = this.el.querySelector('#menu-name').value.trim() || 'Player';
          this.onJoinRoom(btn.dataset.code, name);
        });
      });
      container.querySelectorAll('button[data-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
          await api.delete(`/api/rooms/${btn.dataset.delete}/delete/`);
          this._loadRooms();
        });
      });
    } catch (e) {
      // API not available
    }
  }

  showError(msg) {
    const el = this.el.querySelector('#menu-error');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  exit() {
    if (this._leaderboard) {
      this._leaderboard.destroy();
      this._leaderboard = null;
    }
    if (this.el) this.el.remove();
  }
}
