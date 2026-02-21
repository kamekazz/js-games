import { Component } from '@engine/ecs/Component.js';

export class Weapon extends Component {
  constructor() {
    super();
    this.id = 'pistol';
    this.ammo = 12;
    this.maxAmmo = 12;
    this.fireRate = 0.3;
    this.cooldown = 0;
    this.reloading = false;
  }
}
