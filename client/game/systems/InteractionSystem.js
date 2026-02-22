import { System } from '@engine/ecs/System.js';
import { PlayerControlled } from '../components/PlayerControlled.js';
import { Position } from '../components/Position.js';

const EXTRACTION_ZONE_RADIUS = 8.0;
const CHEST_INTERACT_RADIUS = 2.5;
const CAR_INTERACT_RADIUS = 3.5;

/**
 * Handles F key / mobile action button for hold-to-interact.
 * Sends player_action messages to the server and provides
 * proximity hints for the HUD.
 */
export class InteractionSystem extends System {
  constructor(inputManager, networkClient) {
    super(12);
    this.inputManager = inputManager;
    this.networkClient = networkClient;

    // State
    this._held = false;
    this._prevHeld = false;
    this.actionAvailable = false;
    this.actionLabel = '';

    // Data from server (fed by NetworkSyncSystem)
    this.extractionZones = [];
    this.chests = [];
    this.obstacles = [];

    // F key
    this._onKeyDown = (e) => {
      if (e.code === 'KeyF') this.setActionHeld(true);
    };
    this._onKeyUp = (e) => {
      if (e.code === 'KeyF') this.setActionHeld(false);
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  setActionHeld(val) {
    this._held = val;
  }

  update(dt) {
    // Send state change to server
    if (this._held !== this._prevHeld) {
      this._prevHeld = this._held;
      this.networkClient.send({ type: 'player_action', holding: this._held });
    }

    // Client-side proximity check for UI hints
    this.actionAvailable = false;
    this.actionLabel = '';

    const entities = this.world.query(PlayerControlled, Position);
    let px = 0, py = 0;
    for (const e of entities) {
      if (e.get(PlayerControlled).isLocal) {
        const pos = e.get(Position);
        px = pos.x;
        py = pos.y;
        break;
      }
    }

    // Check extraction zones
    for (const zone of this.extractionZones) {
      const dx = px - zone.x;
      const dy = py - zone.y;
      if (dx * dx + dy * dy < zone.r * zone.r) {
        this.actionAvailable = true;
        this.actionLabel = '[F] Extract';
        return;
      }
    }

    // Check chests
    for (const chest of this.chests) {
      if (chest.opened) continue;
      const dx = px - chest.x;
      const dy = py - chest.y;
      if (dx * dx + dy * dy < CHEST_INTERACT_RADIUS * CHEST_INTERACT_RADIUS) {
        this.actionAvailable = true;
        this.actionLabel = '[F] Open Chest';
        return;
      }
    }

    // Check lootable cars
    for (const obs of this.obstacles) {
      if (!obs.lootable || obs.looted) continue;
      const dx = px - obs.x;
      const dy = py - obs.y;
      if (dx * dx + dy * dy < CAR_INTERACT_RADIUS * CAR_INTERACT_RADIUS) {
        this.actionAvailable = true;
        this.actionLabel = '[F] Search Car';
        return;
      }
    }
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
