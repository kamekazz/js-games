import * as THREE from 'three';
import { System } from '@engine/ecs/System.js';
import { Entity } from '@engine/ecs/Entity.js';
import { Position } from '../components/Position.js';
import { Rotation } from '../components/Rotation.js';
import { MeshRef } from '../components/MeshRef.js';
import { NetworkId } from '../components/NetworkId.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Velocity } from '../components/Velocity.js';
import { Health } from '../components/Health.js';
import { Weapon } from '../components/Weapon.js';
import { Sprint } from '../components/Sprint.js';
import { isTouchDevice } from '@engine/input/DeviceDetector.js';

export class NetworkSyncSystem extends System {
  constructor(networkClient, stateBuffer, renderer, inputManager) {
    super(95);
    this.networkClient = networkClient;
    this.stateBuffer = stateBuffer;
    this.renderer = renderer;
    this.inputManager = inputManager;
    this._isTouch = isTouchDevice();
    this.localPlayerId = null;
    this.projectileSystem = null;  // set by Game.js
    this.enemyRenderSystem = null; // set by Game.js
    this.itemRenderSystem = null;  // set by Game.js
    this.scoreboard = null;        // set by Game.js
    this.hud = null;               // set by Game.js
    this.onGameOver = null;        // callback set by Game.js
    this.onEliminated = null;      // callback set by Game.js
    this.onExtracted = null;       // callback set by Game.js
    this.obstacleRenderSystem = null; // set by Game.js
    this.movementSystem = null;    // set by Game.js
    this.sprintSystem = null;      // set by Game.js
    this.effectsSystem = null;     // set by Game.js
    this.audioManager = null;      // set by Game.js
    this.interactionSystem = null; // set by Game.js
    this.extractionZoneRenderSystem = null; // set by Game.js
    this.chestRenderSystem = null; // set by Game.js
    this.weaponHotbar = null;      // set by Game.js
    this.onInteractionAvailableChanged = null; // callback set by Game.js
    this._prevActionAvailable = false;
    this._obstaclesCreated = false;
    this._groundCreated = false;
    this._extractionZonesCreated = false;
    this._sendInterval = 1000 / 20;
    this._lastSendTime = 0;
    this._serverTimeOffset = 0;
    this._remoteEntities = new Map();
    this._latestState = null;
    this._latestEvents = [];
    this._nightLightingSet = false;
    // Idle direction arrow
    this._idleTimer = 0;
    this._idleArrow = null;
    this._lastPlayerX = null;
    this._lastPlayerY = null;
  }

  init(world) {
    super.init(world);

    this.networkClient.on('game_state', (data) => {
      const serverTime = data.t * 1000;
      if (this._serverTimeOffset === 0) {
        this._serverTimeOffset = serverTime - performance.now();
      }
      this.stateBuffer.push(serverTime, data.state);
      this._latestState = data.state;
      this._latestEvents = data.state.events || [];
    });
  }

  update(dt) {
    this._sendInput();
    this._applyServerState();
    this._processEvents();
    this._updateProjectiles();
    this._updateZombies();
    this._updateItems();
    this._updateChests();
    this._updateScoreboard();
    this._updateLocalFromServer();
    this._updateInteractionHint();
    this._updateIdleArrow(dt);
  }

  _sendInput() {
    const now = performance.now();
    if (now - this._lastSendTime < this._sendInterval) return;
    this._lastSendTime = now;

    if (!this.networkClient.connected || !this.localPlayerId) return;

    const input = this.inputManager.getState();
    let angle = 0;
    let sprinting = false;
    const locals = this.world.query(PlayerControlled, Rotation);
    for (const e of locals) {
      if (e.get(PlayerControlled).isLocal) {
        angle = e.get(Rotation).angle;
        const sprint = e.get(Sprint);
        if (sprint) sprinting = sprint.isSprinting;
        break;
      }
    }

    const msg = {
      type: 'player_move',
      mx: input.moveX,
      my: input.moveY,
      angle,
      sprint: sprinting,
    };
    // Piggyback action holding state so server always has latest
    if (this.interactionSystem && this.interactionSystem._held) {
      msg.holding = true;
    }
    this.networkClient.send(msg);
  }

  _applyServerState() {
    const renderTime = performance.now() + this._serverTimeOffset;
    const state = this.stateBuffer.getInterpolatedState(renderTime);
    if (!state) return;

    // Create obstacle meshes once
    if (!this._obstaclesCreated && this.obstacleRenderSystem && state.obstacles && state.obstacles.length > 0) {
      this._obstaclesCreated = true;
      this.obstacleRenderSystem.setObstacles(state.obstacles);
      // Pass obstacle data for client-side collision prediction
      if (this.movementSystem) {
        this.movementSystem.obstacles = state.obstacles;
      }
      // Feed obstacles to interaction system
      if (this.interactionSystem) {
        this.interactionSystem.obstacles = state.obstacles;
      }
    }

    // Update obstacle loot states from latest server state (not interpolated,
    // since _lerp only returns players). Mirrors how _updateChests works.
    if (this._obstaclesCreated && this.interactionSystem && this._latestState && this._latestState.obstacles) {
      this.interactionSystem.obstacles = this._latestState.obstacles;
    }

    // Create ground patches once
    if (!this._groundCreated && this.obstacleRenderSystem && state.ground && state.ground.length > 0) {
      this._groundCreated = true;
      this.obstacleRenderSystem.setGround(state.ground);
      if (this.sprintSystem) {
        this.sprintSystem.groundPatches = state.ground;
      }
    }

    // Create extraction zone meshes once
    if (!this._extractionZonesCreated && state.extractionZones && state.extractionZones.length > 0) {
      this._extractionZonesCreated = true;
      if (this.extractionZoneRenderSystem) {
        this.extractionZoneRenderSystem.setZones(state.extractionZones);
      }
      if (this.interactionSystem) {
        this.interactionSystem.extractionZones = state.extractionZones;
      }
    }

    const seen = new Set();

    for (const playerData of state.players) {
      seen.add(playerData.id);
      if (playerData.id === this.localPlayerId) continue;

      const entityId = this._remoteEntities.get(playerData.id);
      let entity = entityId != null ? this.world.getEntity(entityId) : null;

      if (!entity) {
        entity = this._createRemotePlayer(playerData);
        this._remoteEntities.set(playerData.id, entity.id);
      }

      const pos = entity.get(Position);
      pos.x = playerData.x;
      pos.y = playerData.y;

      const rot = entity.get(Rotation);
      rot.angle = playerData.angle;

      // Toggle visibility based on alive status
      const mesh = entity.get(MeshRef).mesh;
      mesh.visible = playerData.alive !== false;
    }

    for (const [netId, entityId] of this._remoteEntities) {
      if (!seen.has(netId)) {
        const entity = this.world.getEntity(entityId);
        if (entity) {
          const meshRef = entity.get(MeshRef);
          if (meshRef) this.renderer.remove(meshRef.mesh);
          this.world.removeEntity(entityId);
        }
        this._remoteEntities.delete(netId);
      }
    }
  }

  _updateLocalFromServer() {
    if (!this._latestState) return;

    // Sync health/ammo from server for local player
    for (const pd of this._latestState.players) {
      if (pd.id !== this.localPlayerId) continue;

      const locals = this.world.query(PlayerControlled, Health, Weapon);
      for (const e of locals) {
        if (!e.get(PlayerControlled).isLocal) continue;

        // Reconcile position with server (smooth correction)
        const pos = e.get(Position);
        const dx = pd.x - pos.x;
        const dy = pd.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          // Teleport if too far off
          pos.x = pd.x;
          pos.y = pd.y;
        } else if (dist > 0.1) {
          // Smooth correction
          pos.x += dx * 0.3;
          pos.y += dy * 0.3;
        }

        const health = e.get(Health);
        health.current = pd.hp;
        health.alive = pd.alive;

        const weapon = e.get(Weapon);
        // Server-authoritative weapon sync
        if (pd.weapon && pd.weapon !== weapon.id) {
          weapon.switchTo(pd.weapon);
          if (this.hud) this.hud.updateWeapon(pd.weapon);
          if (this.weaponHotbar) this.weaponHotbar.setActiveWeapon(pd.weapon);
        }
        weapon.ammo = pd.ammo;
        weapon.maxAmmo = pd.maxAmmo;
        weapon.reloading = pd.reloading;

        // Sync unlocked weapons
        if (pd.unlockedWeapons) {
          weapon.unlockedWeapons = new Set(pd.unlockedWeapons);
          if (this.hud) this.hud.updateWeaponSlots(weapon.unlockedWeapons);
          if (this.weaponHotbar) this.weaponHotbar.setUnlockedWeapons(weapon.unlockedWeapons);
        }

        // Toggle mesh visibility
        const mesh = e.get(MeshRef).mesh;
        mesh.visible = pd.alive;

        // Reconcile stamina with server
        const sprint = e.get(Sprint);
        if (sprint && pd.stamina != null) {
          const staminaDiff = pd.stamina - sprint.stamina;
          if (Math.abs(staminaDiff) > 10) {
            sprint.stamina = pd.stamina;
          } else if (Math.abs(staminaDiff) > 1) {
            sprint.stamina += staminaDiff * 0.3;
          }
        }

        // Update HUD
        if (this.hud) {
          this.hud.updateHealth(pd.hp, 100);
          this.hud.updateAmmo(pd.ammo, pd.maxAmmo, pd.reloading);
          this.hud.updateWeapon(weapon.id);
          if (this.weaponHotbar) this.weaponHotbar.setActiveWeapon(weapon.id);
          if (sprint) this.hud.updateStamina(sprint.stamina, sprint.maxStamina);
          if (pd.ammoReserve) this.hud.updateAmmoReserve(pd.ammoReserve, weapon.id);

          // Action progress
          if (pd.actionDuration > 0 && pd.actionProgress > 0) {
            const labels = {
              extraction_zone: 'Extracting...',
              chest: 'Opening Chest...',
              car: 'Searching Car...',
            };
            this.hud.updateAction(pd.actionProgress, pd.actionDuration, labels[pd.actionTargetType] || 'Action');
          } else {
            this.hud.hideAction();
          }
        }
      }
      break;
    }
  }

  _processEvents() {
    if (!this.hud) return;
    for (const evt of this._latestEvents) {
      if (evt.type === 'shoot') {
        if (this.audioManager) this.audioManager.playShoot();
        if (this.effectsSystem) this.effectsSystem.spawnMuzzleFlash(evt.x, evt.y, evt.angle);
      } else if (evt.type === 'proj_hit') {
        if (this.audioManager) this.audioManager.playZombieHit();
        if (this.effectsSystem) {
          this.effectsSystem.spawnHitSparks(evt.x, evt.y);
          if (evt.dmg) this.effectsSystem.spawnDamageNumber(evt.x, evt.y, evt.dmg);
        }
      } else if (evt.type === 'hit' || evt.type === 'zombie_hit') {
        if (evt.type === 'zombie_hit' && evt.pid === this.localPlayerId) {
          if (this.audioManager) this.audioManager.playPlayerHit();
        }
        // Find position for blood burst
        const target = this._findPlayerPos(evt.pid);
        if (target && this.effectsSystem) this.effectsSystem.spawnBloodBurst(target.x, target.y);
      } else if (evt.type === 'kill') {
        const killer = evt.by === 'zombie' ? 'Zombie' : this._findPlayerName(evt.by);
        const victim = this._findPlayerName(evt.pid);
        if (evt.pid === this.localPlayerId) {
          this.hud.showDeath();
          if (this.audioManager) this.audioManager.playDeath();
        } else {
          this.hud.showKill(killer, victim);
        }
      } else if (evt.type === 'zombie_kill') {
        if (this.audioManager) this.audioManager.playZombieDeath();
        if (this.effectsSystem && evt.x != null) {
          this.effectsSystem.spawnDeathBurst(evt.x, evt.y);
        }
        if (evt.by === this.localPlayerId) this.hud.addKill();
      } else if (evt.type === 'night_start') {
        this.hud.showNightStart(evt.night, evt.bloodMoon);
        if (this.audioManager) this.audioManager.playNightStart();
        this.renderer.setNightLighting(true, evt.bloodMoon);
      } else if (evt.type === 'dawn') {
        this.hud.showDawnAnnounce(evt.night);
        if (this.audioManager) this.audioManager.playDawn();
        this.renderer.setNightLighting(false, false);
      } else if (evt.type === 'item_pickup' && evt.pid === this.localPlayerId) {
        // Typed ammo pickup
        if (evt.item === 'ammo' && evt.weapon) {
          const names = { pistol: 'Pistol', rifle: 'Rifle', uzi: 'Uzi', shotgun: 'Shotgun' };
          const wname = names[evt.weapon] || evt.weapon;
          this.hud.showPickup(`+${evt.amount || 12} ${wname} Ammo`, '#ffaa22');
        } else if (evt.item === 'health') {
          this.hud.showPickup('+Health', '#44cc44');
        } else {
          this.hud.showPickup(`+${evt.item}`, '#ffaa22');
        }
        if (this.audioManager) this.audioManager.playPickup();
      } else if (evt.type === 'weapon_unlock') {
        const names = { pistol: 'Pistol', rifle: 'Rifle', uzi: 'Uzi', shotgun: 'Shotgun' };
        if (evt.pid === this.localPlayerId) {
          this.hud.showWeaponUnlock(names[evt.weapon] || evt.weapon);
        } else {
          const pname = this._findPlayerName(evt.pid);
          this.hud.showPickup(`${pname} unlocked ${names[evt.weapon] || evt.weapon}!`, '#ffcc44');
        }
      } else if (evt.type === 'ammo_pickup' && evt.pid === this.localPlayerId) {
        const names = { pistol: 'Pistol', rifle: 'Rifle', uzi: 'Uzi', shotgun: 'Shotgun' };
        this.hud.showPickup(`+${evt.amount} ${names[evt.weapon] || evt.weapon} Ammo`, '#ffaa22');
      } else if (evt.type === 'health_pickup' && evt.pid === this.localPlayerId) {
        this.hud.showPickup(`+${evt.amount} Health`, '#44cc44');
      } else if (evt.type === 'score_pickup' && evt.pid === this.localPlayerId) {
        this.hud.showPickup(`+${evt.amount} Score`, '#ffcc44');
      } else if (evt.type === 'chest_opened') {
        if (evt.pid === this.localPlayerId) {
          if (this.audioManager) this.audioManager.playPickup();
        }
      } else if (evt.type === 'car_looted') {
        if (this.obstacleRenderSystem && evt.obsId) {
          this.obstacleRenderSystem.markCarLooted(evt.obsId);
        }
        if (evt.pid === this.localPlayerId) {
          if (this.audioManager) this.audioManager.playPickup();
        }
      } else if (evt.type === 'extracted') {
        if (evt.pid === this.localPlayerId) {
          this.hud.showExtracted(true);
          // After a brief delay so the player sees the banner, fire the extraction callback
          if (this.onExtracted) {
            const extractData = evt;
            setTimeout(() => {
              if (this.onExtracted) this.onExtracted(extractData);
            }, 2500);
          }
        } else {
          this.hud.showExtractionKillFeed(evt.name || this._findPlayerName(evt.pid));
        }
      } else if (evt.type === 'player_eliminated') {
        if (evt.pid === this.localPlayerId) {
          if (this.onEliminated) this.onEliminated(evt);
        } else {
          this.hud.showKill('Zombie', evt.name || this._findPlayerName(evt.pid));
        }
      } else if (evt.type === 'game_over') {
        if (this.onGameOver) this.onGameOver(evt);
      }
    }

    // Update night info and score from state
    if (this._latestState) {
      this.hud.updateNight(
        this._latestState.night || 0,
        this._latestState.nightActive || false,
        this._latestState.nightElapsed || 0,
        this._latestState.nightDuration || 720,
        this._latestState.isDawn || false,
        this._latestState.bloodMoon || false,
      );

      // Handle mid-night join: set lighting immediately on first state
      if (this._latestState.nightActive && !this._nightLightingSet) {
        this._nightLightingSet = true;
        this.renderer.setNightLighting(true, this._latestState.bloodMoon || false, true);
      } else if (this._latestState.isDawn && !this._nightLightingSet) {
        this._nightLightingSet = true;
        this.renderer.setNightLighting(false, false, true);
      }

      // Find local player score
      const local = this._latestState.players.find(p => p.id === this.localPlayerId);
      if (local) {
        this.hud.updateScore(local.score || 0);
      }
    }

    this._latestEvents = [];
  }

  _updateInteractionHint() {
    if (!this.interactionSystem) return;
    const available = this.interactionSystem.actionAvailable;
    const label = this.interactionSystem.actionLabel;

    if (this.hud && !this._isTouch) {
      if (available) this.hud.showActionHint(label);
      else this.hud.hideActionHint();
    }

    // Fire callback only on state change
    if (available !== this._prevActionAvailable) {
      this._prevActionAvailable = available;
      if (this.onInteractionAvailableChanged) {
        this.onInteractionAvailableChanged(available, label);
      }
    }
  }

  _updateIdleArrow(dt) {
    if (!this._latestState) return;

    // Find local player data
    const pd = this._latestState.players.find(p => p.id === this.localPlayerId);
    if (!pd || !pd.alive) {
      this._idleTimer = 0;
      if (this._idleArrow) this._idleArrow.visible = false;
      return;
    }

    // Detect movement
    const moved = this._lastPlayerX !== null &&
      (Math.abs(pd.x - this._lastPlayerX) > 0.15 || Math.abs(pd.y - this._lastPlayerY) > 0.15);
    this._lastPlayerX = pd.x;
    this._lastPlayerY = pd.y;

    if (moved || pd.stamina < 95) {
      this._idleTimer = 0;
      if (this._idleArrow) this._idleArrow.visible = false;
      return;
    }

    this._idleTimer += dt;

    if (this._idleTimer < 5) {
      if (this._idleArrow) this._idleArrow.visible = false;
      return;
    }

    // Find nearest zombie
    const zombies = this._latestState.zombies || [];
    if (zombies.length === 0) {
      if (this._idleArrow) this._idleArrow.visible = false;
      return;
    }

    let nearest = null;
    let nearestDist = Infinity;
    for (const z of zombies) {
      const dx = z.x - pd.x;
      const dy = z.y - pd.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearestDist) {
        nearestDist = d2;
        nearest = z;
      }
    }

    if (!nearest) {
      if (this._idleArrow) this._idleArrow.visible = false;
      return;
    }

    // Create arrow if needed
    if (!this._idleArrow) {
      this._idleArrow = this._createIdleArrow();
      this.renderer.add(this._idleArrow);
    }

    // Position arrow near player feet, pointing toward nearest enemy
    const angle = Math.atan2(nearest.y - pd.y, nearest.x - pd.x);
    this._idleArrow.position.set(
      pd.x + Math.cos(angle) * 2,
      0.15,
      -(pd.y + Math.sin(angle) * 2)
    );
    this._idleArrow.rotation.y = -angle + Math.PI / 2;
    this._idleArrow.visible = true;

    // Pulse opacity
    const pulse = 0.5 + Math.sin(this._idleTimer * 3) * 0.3;
    this._idleArrow.children[0].material.opacity = pulse;
  }

  _createIdleArrow() {
    const group = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.6);
    shape.lineTo(-0.4, -0.3);
    shape.lineTo(0, 0);
    shape.lineTo(0.4, -0.3);
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      emissive: 0xff4444,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    group.add(mesh);
    return group;
  }

  _findPlayerName(pid) {
    if (!this._latestState) return 'Player';
    const p = this._latestState.players.find(p => p.id === pid);
    return p ? p.name : 'Player';
  }

  _findPlayerPos(pid) {
    if (!this._latestState) return null;
    const p = this._latestState.players.find(p => p.id === pid);
    return p ? { x: p.x, y: p.y } : null;
  }

  _findZombiePos(zid) {
    if (!this._latestState || !this._latestState.zombies) return null;
    const z = this._latestState.zombies.find(z => z.id === zid);
    return z ? { x: z.x, y: z.y } : null;
  }

  _updateProjectiles() {
    if (this.projectileSystem && this._latestState && this._latestState.projectiles) {
      this.projectileSystem.setProjectiles(this._latestState.projectiles);
    }
  }

  _updateZombies() {
    if (this.enemyRenderSystem && this._latestState && this._latestState.zombies) {
      this.enemyRenderSystem.setZombies(this._latestState.zombies);
    }
  }

  _updateItems() {
    if (this.itemRenderSystem && this._latestState && this._latestState.items) {
      this.itemRenderSystem.setItems(this._latestState.items);
    }
  }

  _updateChests() {
    if (this.chestRenderSystem && this._latestState && this._latestState.chests) {
      this.chestRenderSystem.setChests(this._latestState.chests);
      // Feed chests to interaction system for proximity hints
      if (this.interactionSystem) {
        this.interactionSystem.chests = this._latestState.chests;
      }
    }
  }

  _updateScoreboard() {
    if (this.scoreboard && this._latestState && this._latestState.players) {
      this.scoreboard.update(this._latestState.players);
    }
  }

  _createRemotePlayer(playerData) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.2, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xff4444 })
    );
    body.position.y = 0.6;
    group.add(body);

    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xff8888 })
    );
    nose.position.set(0, 0.6, -0.8);
    group.add(nose);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(playerData.name || 'Player', 128, 40);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(0, 2.2, 0);
    sprite.scale.set(4, 1, 1);
    group.add(sprite);

    this.renderer.add(group);

    const entity = new Entity();
    entity.add(new Position(playerData.x, playerData.y));
    entity.add(new Rotation(playerData.angle));
    entity.add(new MeshRef(group));
    entity.add(new NetworkId(playerData.id));
    entity.add(new Velocity(0, 0, 0));

    this.world.addEntity(entity);
    return entity;
  }
}
