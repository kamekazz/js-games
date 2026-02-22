/**
 * Full-screen results overlay shown when the game ends.
 * Shows wave reached, time survived, and per-player scores.
 * Includes extraction status column.
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

    const minutes = Math.floor(data.elapsed / 60);
    const seconds = Math.floor(data.elapsed % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const isExtraction = data.type === 'extracted';
    const isElimination = !data.scores && data.pid && !isExtraction;

    if (isExtraction) {
      // Successful extraction — celebratory screen
      this.el.innerHTML = `
        <h1 style="font-size: 2.5rem; color: #44ff44; margin-bottom: 8px;">EXTRACTED</h1>
        <p style="font-size: 1.2rem; color: #ccc; margin-bottom: 4px; max-width: 480px; text-align: center; line-height: 1.5;">
          You survived the zombie apocalypse and made it out alive.
          Rest up — you'll be back for another run soon.
        </p>
        <p style="font-size: 1rem; color: #888; margin-bottom: 20px;">Night ${data.night} | Survived ${timeStr}</p>
        <div style="
          background: rgba(255,255,255,0.05); border: 1px solid #333; border-radius: 12px;
          padding: 20px 32px; min-width: 300px; max-width: 90vw;
        ">
          <div style="text-align: center; margin-bottom: 16px;">
            <span style="font-size: 2.2rem; font-weight: bold; color: #ffcc44;">${data.score}</span>
            <span style="font-size: 1rem; color: #888; display: block;">SCORE</span>
          </div>
          <div style="display: flex; justify-content: center; gap: 32px;">
            <div style="text-align: center;">
              <span style="font-size: 1.4rem; font-weight: bold;">${data.kills}</span>
              <span style="font-size: 0.8rem; color: #888; display: block;">Kills</span>
            </div>
            <div style="text-align: center;">
              <span style="font-size: 1.4rem; font-weight: bold;">${data.accuracy}%</span>
              <span style="font-size: 0.8rem; color: #888; display: block;">Accuracy</span>
            </div>
            <div style="text-align: center;">
              <span style="font-size: 1.4rem; font-weight: bold;">${data.night}</span>
              <span style="font-size: 0.8rem; color: #888; display: block;">Nights</span>
            </div>
            <div style="text-align: center;">
              <span style="font-size: 1.4rem; font-weight: bold;">${timeStr}</span>
              <span style="font-size: 0.8rem; color: #888; display: block;">Time</span>
            </div>
          </div>
        </div>
        <p style="font-size: 0.85rem; color: #555; margin-top: 16px;">Your score has been saved to the leaderboard.</p>
        <button id="results-continue" style="
          margin-top: 20px; padding: 14px 40px; border-radius: 8px;
          border: none; background: #44aa44; color: white;
          font-size: 16px; font-weight: bold; cursor: pointer;
        ">Back to Menu</button>
      `;
    } else if (isElimination) {
      // Single-player elimination (permadeath)
      this.el.innerHTML = `
        <h1 style="font-size: 2.5rem; color: #ff4444; margin-bottom: 8px;">YOU DIED</h1>
        <p style="font-size: 1.1rem; color: #aaa; margin-bottom: 4px;">Night ${data.night} | Survived ${timeStr}</p>
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
          <tbody>
            <tr style="background: rgba(255,255,255,0.05);">
              <td style="padding: 8px 16px; text-align: left;">${data.name}</td>
              <td style="padding: 8px 16px; text-align: center; color: #ff4444; font-weight: bold;">0</td>
              <td style="padding: 8px 16px; text-align: center;">${data.kills}</td>
              <td style="padding: 8px 16px; text-align: center;">${data.deaths}</td>
              <td style="padding: 8px 16px; text-align: center;">${data.accuracy}%</td>
            </tr>
          </tbody>
        </table>
        <button id="results-continue" style="
          margin-top: 32px; padding: 14px 40px; border-radius: 8px;
          border: none; background: #4488ff; color: white;
          font-size: 16px; font-weight: bold; cursor: pointer;
        ">Back to Menu</button>
      `;
    } else {
      // Multi-player game over (existing logic)
      const scores = data.scores || [];
      scores.sort((a, b) => b.score - a.score);

      const rows = scores.map((s, i) => {
        const extracted = s.extracted;
        const scoreDisplay = extracted ? s.score : '<span style="color: #ff4444;">NOT EXTRACTED</span>';
        const statusColor = extracted ? '#44ff44' : '#ff4444';
        const statusText = extracted ? 'Extracted' : 'Lost';
        return `
          <tr style="background: ${i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent'};">
            <td style="padding: 8px 16px; text-align: left;">${i === 0 ? 'MVP ' : ''}${s.name}</td>
            <td style="padding: 8px 16px; text-align: center; color: ${statusColor}; font-weight: bold;">${statusText}</td>
            <td style="padding: 8px 16px; text-align: center; color: #ffcc44; font-weight: bold;">${scoreDisplay}</td>
            <td style="padding: 8px 16px; text-align: center;">${s.kills}</td>
            <td style="padding: 8px 16px; text-align: center;">${s.deaths}</td>
            <td style="padding: 8px 16px; text-align: center;">${s.accuracy}%</td>
          </tr>
        `;
      }).join('');

      this.el.innerHTML = `
        <h1 style="font-size: 2.5rem; color: #ff4444; margin-bottom: 8px;">GAME OVER</h1>
        <p style="font-size: 1.1rem; color: #aaa; margin-bottom: 4px;">Night ${data.night} | Survived ${timeStr}</p>
        <table style="margin-top: 24px; border-collapse: collapse; min-width: 500px; max-width: 90vw;">
          <thead>
            <tr style="border-bottom: 2px solid #444;">
              <th style="padding: 8px 16px; text-align: left; color: #888;">Player</th>
              <th style="padding: 8px 16px; text-align: center; color: #888;">Status</th>
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
    }

    container.appendChild(this.el);

    this.el.querySelector('#results-continue').addEventListener('click', () => {
      onContinue();
    });
  }

  destroy() {
    this.el.remove();
  }
}
