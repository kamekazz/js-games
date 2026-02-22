import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Weapon } from '../components/Weapon.js';
import { Health } from '../components/Health.js';
import { Sprint } from '../components/Sprint.js';
import { Rotation } from '../components/Rotation.js';
import { WEAPONS } from '@shared/constants.js';

const HOTKEY_MAP = {
  Digit1: 'pistol',
  Digit2: 'rifle',
  Digit3: 'uzi',
  Digit4: 'shotgun',
};

export class WeaponSystem extends System {
  constructor(inputManager, networkClient, audioManager) {
    super(15); // after movement
    this.inputManager = inputManager;
    this.networkClient = networkClient;
    this.audioManager = audioManager;
    this._reloadRequested = false;
    this._switchRequested = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') this._reloadRequested = true;
      if (HOTKEY_MAP[e.code]) this._switchRequested = HOTKEY_MAP[e.code];
    });
  }

  requestReload() {
    this._reloadRequested = true;
  }

  update(dt) {
    const input = this.inputManager.getState();

    // Fire on release: shoot when mouse or joystick aim is released
    const wantShoot = input.mouseJustReleased || input.aimJoystickJustReleased;

    const entities = this.world.query(PlayerControlled, Weapon, Health, Sprint, Rotation);

    for (const entity of entities) {
      const pc = entity.get(PlayerControlled);
      if (!pc.isLocal) continue;

      const weapon = entity.get(Weapon);
      const health = entity.get(Health);
      const sprint = entity.get(Sprint);
      if (!health.alive) continue;

      // Weapon switch — must be unlocked
      if (this._switchRequested && !weapon.reloading && this._switchRequested !== weapon.id) {
        if (weapon.unlockedWeapons.has(this._switchRequested)) {
          weapon.switchTo(this._switchRequested);
          this.networkClient.send({ type: 'player_switch_weapon', weapon: this._switchRequested });
        }
      }

      // Cooldown
      if (weapon.cooldown > 0) weapon.cooldown -= dt;

      // Can't reload when fully exhausted
      const canReload = sprint.stamina > 0;

      // Auto-reload when empty and not already reloading
      if (weapon.ammo <= 0 && !weapon.reloading && canReload) {
        this.networkClient.send({ type: 'player_reload' });
        weapon.reloading = true;
        if (this.audioManager) this.audioManager.playReload();
      }

      // Manual reload
      if (this._reloadRequested && !weapon.reloading && weapon.ammo < weapon.maxAmmo && canReload) {
        this.networkClient.send({ type: 'player_reload' });
        weapon.reloading = true;
        this._reloadRequested = false;
        if (this.audioManager) this.audioManager.playReload();
      }

      // Shoot — send current angle and aim time so server calculates accuracy
      // Can't shoot while sprinting
      if (wantShoot && weapon.cooldown <= 0 && !weapon.reloading && weapon.ammo > 0 && !sprint.isSprinting) {
        const angle = entity.get(Rotation).angle;
        this.networkClient.send({ type: 'player_shoot', angle, aimTime: weapon.aimTime });
        weapon.cooldown = weapon.fireRate;
        const cost = WEAPONS[weapon.id].ammoCost || 1;
        weapon.ammo = Math.max(0, weapon.ammo - cost);
        weapon.aimTime = 0;
      }
    }

    this._reloadRequested = false;
    this._switchRequested = null;
  }
}
