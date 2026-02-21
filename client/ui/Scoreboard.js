/**
 * In-game scoreboard overlay, toggled with Tab key.
 * Shows all players with their scores and kills.
 */
export class Scoreboard {
  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.85); color: white; font-family: Arial, sans-serif;
      padding: 20px 24px; border-radius: 12px; min-width: 320px;
      pointer-events: none; z-index: 28; display: none;
    `;
    this.el.innerHTML = `
      <h3 style="text-align: center; margin: 0 0 12px 0; color: #888; font-size: 14px;">SCOREBOARD</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid #444;">
            <th style="padding: 4px 12px; text-align: left; color: #666; font-size: 12px;">Player</th>
            <th style="padding: 4px 12px; text-align: center; color: #666; font-size: 12px;">Score</th>
            <th style="padding: 4px 12px; text-align: center; color: #666; font-size: 12px;">Kills</th>
          </tr>
        </thead>
        <tbody id="scoreboard-body"></tbody>
      </table>
    `;
    document.body.appendChild(this.el);

    this._body = this.el.querySelector('#scoreboard-body');
    this._visible = false;

    this._onKeyDown = (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this.el.style.display = 'block';
        this._visible = true;
      }
    };
    this._onKeyUp = (e) => {
      if (e.code === 'Tab') {
        this.el.style.display = 'none';
        this._visible = false;
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  update(players) {
    if (!this._visible) return;

    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    this._body.innerHTML = sorted.map(p => `
      <tr>
        <td style="padding: 4px 12px; font-size: 14px;">${p.name}</td>
        <td style="padding: 4px 12px; text-align: center; color: #ffcc44; font-weight: bold;">${p.score || 0}</td>
        <td style="padding: 4px 12px; text-align: center;">${p.kills || 0}</td>
      </tr>
    `).join('');
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.el.remove();
  }
}
