export class ActionButton {
  constructor(container, { label = '', size = 60, color = 'rgba(255,255,255,0.3)', onPress, onRelease }) {
    this.el = document.createElement('button');
    this.el.textContent = label;
    this.el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 2px solid ${color};
      background: ${color};
      color: white;
      font-size: 14px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
      cursor: pointer;
      margin-bottom: 10px;
    `;

    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (onPress) onPress();
    });

    this.el.addEventListener('pointerup', (e) => {
      e.preventDefault();
      if (onRelease) onRelease();
    });

    this.el.addEventListener('pointerleave', (e) => {
      if (onRelease) onRelease();
    });

    container.appendChild(this.el);
  }

  destroy() {
    this.el.remove();
  }
}
