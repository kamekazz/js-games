export class MainMenu {
  constructor(sceneManager, onCreateRoom, onJoinRoom) {
    this.sceneManager = sceneManager;
    this.onCreateRoom = onCreateRoom;
    this.onJoinRoom = onJoinRoom;
    this.el = null;
  }

  async enter(container) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      pointer-events: auto; background: rgba(0,0,0,0.7); color: white; font-family: Arial, sans-serif;
    `;
    this.el.innerHTML = `
      <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; color: #ff4444;">ZOMBIE SURVIVAL</h1>
      <p style="color: #888; margin-bottom: 2rem;">Top-down multiplayer survival</p>
      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <input id="menu-name" type="text" placeholder="Your name" maxlength="20"
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

    // Load room list
    this._loadRooms();
  }

  async _loadRooms() {
    try {
      const res = await fetch('/api/rooms/');
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
          <button data-code="${r.code}" style="padding: 6px 14px; border-radius: 6px; border: none; background: #44aa44; color: white; cursor: pointer; font-size: 13px;">Join</button>
        </div>
      `).join('');
      container.querySelectorAll('button[data-code]').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = this.el.querySelector('#menu-name').value.trim() || 'Player';
          this.onJoinRoom(btn.dataset.code, name);
        });
      });
    } catch (e) {
      // API not available, that's fine
    }
  }

  showError(msg) {
    const el = this.el.querySelector('#menu-error');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  exit() {
    if (this.el) this.el.remove();
  }
}
