import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Weapon } from '../components/Weapon.js';
import { Health } from '../components/Health.js';
import { Rotation } from '../components/Rotation.js';

export class WeaponSystem extends System {
  constructor(inputManager, networkClient) {
    super(15); // after movement
    this.inputManager = inputManager;
    this.networkClient = networkClient;
    this._shooting = false;
    this._reloadRequested = false;

    // Mouse click to shoot (desktop)
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this._shooting = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._shooting = false;
    });
    // R key to reload
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') this._reloadRequested = true;
    });
  }

  setShooting(val) {
    this._shooting = val;
  }

  requestReload() {
    this._reloadRequested = true;
  }

  update(dt) {
    const input = this.inputManager.getState();

    // Auto-fire when right joystick (aim) is active on mobile
    const wantShoot = this._shooting || input.aimJoystickActive;

    const entities = this.world.query(PlayerControlled, Weapon, Health, Rotation);

    for (const entity of entities) {
      const pc = entity.get(PlayerControlled);
      if (!pc.isLocal) continue;

      const weapon = entity.get(Weapon);
      const health = entity.get(Health);
      if (!health.alive) continue;

      // Cooldown
      if (weapon.cooldown > 0) weapon.cooldown -= dt;

      // Auto-reload when empty and not already reloading
      if (weapon.ammo <= 0 && !weapon.reloading) {
        this.networkClient.send({ type: 'player_reload' });
        weapon.reloading = true;
      }

      // Manual reload
      if (this._reloadRequested && !weapon.reloading && weapon.ammo < weapon.maxAmmo) {
        this.networkClient.send({ type: 'player_reload' });
        weapon.reloading = true;
        this._reloadRequested = false;
      }

      // Shoot — send current angle so server uses the right direction immediately
      if (wantShoot && weapon.cooldown <= 0 && !weapon.reloading && weapon.ammo > 0) {
        const angle = entity.get(Rotation).angle;
        this.networkClient.send({ type: 'player_shoot', angle });
        weapon.cooldown = weapon.fireRate;
        weapon.ammo--;
      }
    }

    this._reloadRequested = false;
  }
}
