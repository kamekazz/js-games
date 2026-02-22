/**
 * Buffers server snapshots and interpolates between them for smooth rendering.
 */
export class StateBuffer {
  constructor(interpolationDelay = 100) {
    this.buffer = []; // { time, state }
    this.interpolationDelay = interpolationDelay; // ms behind server
  }

  push(serverTime, state) {
    this.buffer.push({ time: serverTime, state });
    // Keep only last 2 seconds of history
    while (this.buffer.length > 40) {
      this.buffer.shift();
    }
  }

  getInterpolatedState(renderTime) {
    const targetTime = renderTime - this.interpolationDelay;

    // Find the two snapshots to interpolate between
    let before = null;
    let after = null;

    for (let i = 0; i < this.buffer.length; i++) {
      if (this.buffer[i].time <= targetTime) {
        before = this.buffer[i];
      } else {
        after = this.buffer[i];
        break;
      }
    }

    // If no interpolation possible, return latest
    if (!before && !after) return null;
    if (!before) return after.state;
    if (!after) return before.state;

    // Interpolation factor
    const range = after.time - before.time;
    const t = range > 0 ? (targetTime - before.time) / range : 0;

    return this._lerp(before.state, after.state, Math.max(0, Math.min(1, t)));
  }

  _lerp(stateA, stateB, t) {
    // Interpolate player positions
    const playersA = new Map(stateA.players.map(p => [p.id, p]));
    const playersB = new Map(stateB.players.map(p => [p.id, p]));

    const players = [];
    for (const [id, b] of playersB) {
      const a = playersA.get(id);
      if (a) {
        players.push({
          ...b,
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          angle: this._lerpAngle(a.angle, b.angle, t),
        });
      } else {
        players.push(b);
      }
    }

    // Preserve all non-player state from the newer snapshot
    return { ...stateB, players };
  }

  _lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }
}
