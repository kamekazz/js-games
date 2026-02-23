export class ZoomSlider {
  constructor(container, renderer) {
    this._renderer = renderer;
    this._minView = 15;
    this._maxView = 45;

    // Smooth zoom interpolation
    this._targetViewSize = renderer.viewSize;
    this._smoothing = 0.08; // lerp factor per frame
    this._animFrame = null;
    this._animating = false;

    // Outer wrapper — positioned on the left side, vertically centered
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      pointer-events: auto;
      z-index: 20;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
    `;

    // "+" button (zoom in = smaller viewSize)
    this._plusBtn = this._createButton('+', () => this._step(-2));
    this.el.appendChild(this._plusBtn);

    // Slider track
    this._track = document.createElement('div');
    this._track.style.cssText = `
      width: 6px;
      height: 120px;
      background: rgba(255,255,255,0.15);
      border-radius: 3px;
      position: relative;
      cursor: pointer;
    `;
    this.el.appendChild(this._track);

    // Slider thumb
    this._thumb = document.createElement('div');
    this._thumb.style.cssText = `
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(255,255,255,0.7);
      border: 2px solid rgba(255,255,255,0.9);
      position: absolute;
      left: 50%;
      transform: translate(-50%, -50%);
      cursor: grab;
      touch-action: none;
    `;
    this._track.appendChild(this._thumb);

    // "-" button (zoom out = larger viewSize)
    this._minusBtn = this._createButton('\u2013', () => this._step(2));
    this.el.appendChild(this._minusBtn);

    // Drag handling
    this._dragging = false;
    this._thumb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._dragging = true;
      this._thumb.setPointerCapture(e.pointerId);
      this._thumb.style.cursor = 'grabbing';
    });
    this._thumb.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = this._track.getBoundingClientRect();
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      // Top = zoomed in (min viewSize), Bottom = zoomed out (max viewSize)
      const viewSize = this._minView + y * (this._maxView - this._minView);
      this._setViewSize(viewSize);
    });
    this._thumb.addEventListener('pointerup', (e) => {
      this._dragging = false;
      this._thumb.style.cursor = 'grab';
    });
    this._thumb.addEventListener('pointercancel', () => {
      this._dragging = false;
      this._thumb.style.cursor = 'grab';
    });

    // Click on track to jump
    this._track.addEventListener('pointerdown', (e) => {
      if (e.target === this._thumb) return;
      const rect = this._track.getBoundingClientRect();
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const viewSize = this._minView + y * (this._maxView - this._minView);
      this._setViewSize(viewSize);
    });

    // Mouse scroll wheel zoom (smooth)
    this._onWheel = (e) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      // Scroll up = zoom in (smaller viewSize), scroll down = zoom out
      const delta = e.deltaY > 0 ? 3 : -3;
      this._targetViewSize = Math.max(this._minView, Math.min(this._maxView, this._targetViewSize + delta));
      this._startSmooth();
    };
    window.addEventListener('wheel', this._onWheel, { passive: false });

    container.appendChild(this.el);
    this._updateThumb();
  }

  _createButton(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.4);
      background: rgba(255,255,255,0.15);
      color: white;
      font-size: 16px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      touch-action: none;
      line-height: 1;
      padding: 0;
    `;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  _step(delta) {
    const viewSize = Math.max(this._minView, Math.min(this._maxView, this._renderer.viewSize + delta));
    this._targetViewSize = viewSize;
    this._setViewSize(viewSize);
  }

  _setViewSize(viewSize) {
    this._renderer.viewSize = viewSize;
    this._renderer._handleResize();
    this._updateThumb();
  }

  _startSmooth() {
    if (this._animating) return;
    this._animating = true;
    const tick = () => {
      const current = this._renderer.viewSize;
      const diff = this._targetViewSize - current;
      if (Math.abs(diff) < 0.05) {
        this._setViewSize(this._targetViewSize);
        this._animating = false;
        return;
      }
      this._setViewSize(current + diff * this._smoothing);
      this._animFrame = requestAnimationFrame(tick);
    };
    this._animFrame = requestAnimationFrame(tick);
  }

  _updateThumb() {
    const t = (this._renderer.viewSize - this._minView) / (this._maxView - this._minView);
    const trackHeight = 120;
    this._thumb.style.top = `${t * trackHeight}px`;
  }

  destroy() {
    window.removeEventListener('wheel', this._onWheel);
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    this.el.remove();
  }
}
