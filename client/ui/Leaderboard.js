import { api } from '@engine/network/ApiClient.js';

/**
 * Full-screen leaderboard overlay showing top extraction scores.
 */
export class Leaderboard {
  constructor(container, onClose) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      pointer-events: auto; background: rgba(0,0,0,0.85); color: white;
      font-family: Arial, sans-serif; z-index: 30;
    `;

    this.el.innerHTML = `
      <h1 style="font-size: 2.2rem; color: #ffcc44; margin-bottom: 24px;">LEADERBOARD</h1>
      <div id="lb-content" style="width: 90%; max-width: 640px; max-height: 60vh; overflow-y: auto;">
        <p style="color: #888; text-align: center;">Loading...</p>
      </div>
      <button id="lb-back" style="
        margin-top: 28px; padding: 12px 36px; border-radius: 8px;
        border: 1px solid #666; background: transparent; color: #ccc;
        font-size: 15px; cursor: pointer;
      ">Back</button>
    `;

    container.appendChild(this.el);

    this.el.querySelector('#lb-back').addEventListener('click', () => {
      onClose();
    });

    this._load();
  }

  async _load() {
    const content = this.el.querySelector('#lb-content');
    try {
      const res = await api.get('/api/leaderboard/');
      if (!res.ok) {
        content.innerHTML = '<p style="color: #ff4444; text-align: center;">Failed to load leaderboard</p>';
        return;
      }
      const entries = await res.json();
      if (!entries.length) {
        content.innerHTML = '<p style="color: #888; text-align: center;">No extractions yet. Be the first!</p>';
        return;
      }

      const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32'];

      const rows = entries.map((e, i) => {
        const rank = i + 1;
        const rankColor = i < 3 ? rankColors[i] : '#888';
        const minutes = Math.floor(e.survival_time / 60);
        const seconds = Math.floor(e.survival_time % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        return `
          <tr style="background: ${i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent'};">
            <td style="padding: 8px 12px; text-align: center; color: ${rankColor}; font-weight: bold;">${rank}</td>
            <td style="padding: 8px 12px; text-align: left;">${e.display_name}</td>
            <td style="padding: 8px 12px; text-align: center; color: #ffcc44; font-weight: bold;">${e.score}</td>
            <td style="padding: 8px 12px; text-align: center;">${e.zombie_kills}</td>
            <td style="padding: 8px 12px; text-align: center;">${e.night_survived}</td>
            <td style="padding: 8px 12px; text-align: center;">${timeStr}</td>
          </tr>
        `;
      }).join('');

      content.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #444;">
              <th style="padding: 8px 12px; text-align: center; color: #888;">#</th>
              <th style="padding: 8px 12px; text-align: left; color: #888;">Player</th>
              <th style="padding: 8px 12px; text-align: center; color: #888;">Score</th>
              <th style="padding: 8px 12px; text-align: center; color: #888;">Kills</th>
              <th style="padding: 8px 12px; text-align: center; color: #888;">Night</th>
              <th style="padding: 8px 12px; text-align: center; color: #888;">Time</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } catch (e) {
      content.innerHTML = '<p style="color: #ff4444; text-align: center;">Failed to load leaderboard</p>';
    }
  }

  destroy() {
    this.el.remove();
  }
}
