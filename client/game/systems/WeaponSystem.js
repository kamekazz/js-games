import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Weapon } from '../components/Weapon.js';
import { Health } from '../components/Health.js';
import { Rotation } from '../components/Rotation.js';

export class WeaponSystem extends System {
  constructor(inputManager, networkClient, audioManager) {
    super(15); // after movement
    this.inputManager = inputManager;
    this.networkClient = networkClient;
    this.audioManager = audioManager;
    this._reloadRequested = false;

    // R key to reload
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') this._reloadRequested = true;
    });
  }

  requestReload() {
    this._reloadRequested = true;
  }

  update(dt) {
    const input = this.inputManager.getState();

    // Fire on release: shoot when mouse or joystick aim is released
    const wantShoot = input.mouseJustReleased || input.aimJoystickJustReleased;

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
        if (this.audioManager) this.audioManager.playReload();
      }

      // Manual reload
      if (this._reloadRequested && !weapon.reloading && weapon.ammo < weapon.maxAmmo) {
        this.networkClient.send({ type: 'player_reload' });
        weapon.reloading = true;
        this._reloadRequested = false;
        if (this.audioManager) this.audioManager.playReload();
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
