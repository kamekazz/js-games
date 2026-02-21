import nipplejs from 'nipplejs';

export class VirtualJoystick {
  constructor(zone, onChange) {
    this.value = { x: 0, y: 0 };
    this._onChange = onChange;

    this.manager = nipplejs.create({
      zone,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: 'rgba(255, 255, 255, 0.3)',
      size: 120,
    });

    this.manager.on('move', (evt, data) => {
      const force = Math.min(data.force, 1);
      const angle = data.angle.radian;
      this.value.x = Math.cos(angle) * force;
      this.value.y = Math.sin(angle) * force;
      this._onChange(this.value.x, this.value.y);
    });

    this.manager.on('end', () => {
      this.value.x = 0;
      this.value.y = 0;
      this._onChange(0, 0);
    });
  }

  destroy() {
    this.manager.destroy();
  }
}
