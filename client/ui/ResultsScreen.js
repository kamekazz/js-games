/**
 * Full-screen results overlay shown when the game ends.
 * Shows wave reached, time survived, and per-player scores.
 */
export class ResultsScreen {
  constructor(container, data, onContinue) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      pointer-events: auto; background: rgba(0,0,0,0.85); color: white;
      font-family: Arial, sans-serif; z-index: 30;
      animation: fadeIn 0.5s ease-out;
    `;

    const scores = data.scores || [];
    scores.sort((a, b) => b.score - a.score);

    const minutes = Math.floor(data.elapsed / 60);
    const seconds = Math.floor(data.elapsed % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const rows = scores.map((s, i) => `
      <tr style="background: ${i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent'};">
        <td style="padding: 8px 16px; text-align: left;">${i === 0 ? 'MVP ' : ''}${s.name}</td>
        <td style="padding: 8px 16px; text-align: center; color: #ffcc44; font-weight: bold;">${s.score}</td>
        <td style="padding: 8px 16px; text-align: center;">${s.kills}</td>
        <td style="padding: 8px 16px; text-align: center;">${s.deaths}</td>
        <td style="padding: 8px 16px; text-align: center;">${s.accuracy}%</td>
      </tr>
    `).join('');

    this.el.innerHTML = `
      <h1 style="font-size: 2.5rem; color: #ff4444; margin-bottom: 8px;">GAME OVER</h1>
      <p style="font-size: 1.1rem; color: #aaa; margin-bottom: 4px;">Wave ${data.wave} | Survived ${timeStr}</p>
      <table style="margin-top: 24px; border-collapse: collapse; min-width: 400px; max-width: 90vw;">
        <thead>
          <tr style="border-bottom: 2px solid #444;">
            <th style="padding: 8px 16px; text-align: left; color: #888;">Player</th>
            <th style="padding: 8px 16px; text-align: center; color: #888;">Score</th>
            <th style="padding: 8px 16px; text-align: center; color: #888;">Kills</th>
            <th style="padding: 8px 16px; text-align: center; color: #888;">Deaths</th>
            <th style="padding: 8px 16px; text-align: center; color: #888;">Accuracy</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <button id="results-continue" style="
        margin-top: 32px; padding: 14px 40px; border-radius: 8px;
        border: none; background: #4488ff; color: white;
        font-size: 16px; font-weight: bold; cursor: pointer;
      ">Back to Menu</button>
    `;

    container.appendChild(this.el);

    this.el.querySelector('#results-continue').addEventListener('click', () => {
      onContinue();
    });
  }

  destroy() {
    this.el.remove();
  }
}
