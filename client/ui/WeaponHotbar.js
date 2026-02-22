export class WeaponHotbar {
  constructor(container, onSelect) {
    this._onSelect = onSelect;
    this._activeWeapon = 'pistol';
    this._unlockedWeapons = new Set(['pistol']);

    this._slots = [
      { id: 'pistol', label: 'P' },
      { id: 'rifle', label: 'R' },
      { id: 'uzi', label: 'U' },
      { id: 'shotgun', label: 'S' },
    ];

    this.el = document.createElement('div');
    this.el.id = 'weapon-hotbar';
    this.el.style.cssText = `
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 6px;
      pointer-events: auto;
      z-index: 20;
    `;

    this._buttons = [];
    for (const slot of this._slots) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        width: 52px;
        height: 52px;
        border-radius: 6px;
        border: 2px solid #888;
        background: rgba(0,0,0,0.5);
        color: white;
        font-size: 16px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        touch-action: none;
        -webkit-user-select: none;
        user-select: none;
        cursor: pointer;
        padding: 0;
      `;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this._unlockedWeapons.has(slot.id)) {
          this._onSelect(slot.id);
        }
      });
      this.el.appendChild(btn);
      this._buttons.push({ el: btn, slot });
    }

    container.appendChild(this.el);
    this._render();
  }

  setActiveWeapon(id) {
    if (id === this._activeWeapon) return;
    this._activeWeapon = id;
    this._render();
  }

  setUnlockedWeapons(set) {
    if (set.size === this._unlockedWeapons.size) {
      let same = true;
      for (const w of set) {
        if (!this._unlockedWeapons.has(w)) { same = false; break; }
      }
      if (same) return;
    }
    this._unlockedWeapons = new Set(set);
    this._render();
  }

  _render() {
    for (const { el, slot } of this._buttons) {
      const unlocked = this._unlockedWeapons.has(slot.id);
      const active = slot.id === this._activeWeapon;

      el.textContent = unlocked ? slot.label : '?';
      el.style.opacity = unlocked ? '1' : '0.4';
      el.style.borderColor = active ? '#ffcc44' : (unlocked ? '#ccc' : '#555');
      el.style.background = active
        ? 'rgba(255,204,68,0.25)'
        : 'rgba(0,0,0,0.5)';
    }
  }

  destroy() {
    this.el.remove();
  }
}
