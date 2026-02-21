"""
In-memory game state manager. Holds all active game rooms and player states.
This runs in the same process as Django Channels (Daphne/ASGI).
"""
import time
import math
import random
from .zombies import ZombieState, WaveSpawner, ZOMBIE_TYPES

PLAYER_SPEED = 12
WORLD_SIZE = 100
TICK_RATE = 20
TICK_INTERVAL = 1.0 / TICK_RATE

# Weapon definitions
WEAPONS = {
    'pistol': {
        'damage': 20,
        'fire_rate': 0.3,   # seconds between shots
        'magazine': 12,
        'reload_time': 1.5,
        'projectile_speed': 40,
        'range': 30,
    },
}

PLAYER_MAX_HEALTH = 100
RESPAWN_TIME = 3.0

# Item drop definitions
ITEM_TYPES = {
    'health': {'heal': 30, 'color': 'green'},
    'ammo':   {'ammo': 12, 'color': 'orange'},
}
ITEM_DROP_CHANCE = 0.35  # 35% chance a zombie drops an item
ITEM_PICKUP_RADIUS = 1.5
ITEM_LIFETIME = 15.0  # seconds before item disappears

# Game over: all players dead for this long = game over
GAME_OVER_DEAD_TIME = 5.0


class ItemDrop:
    __slots__ = ('id', 'item_type', 'x', 'y', 'lifetime')

    _next_id = 0

    def __init__(self, item_type, x, y):
        ItemDrop._next_id += 1
        self.id = ItemDrop._next_id
        self.item_type = item_type
        self.x = x
        self.y = y
        self.lifetime = ITEM_LIFETIME

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.item_type,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
        }


class ProjectileState:
    __slots__ = ('id', 'owner_id', 'x', 'y', 'dx', 'dy', 'speed', 'damage', 'max_range', 'traveled')

    _next_id = 0

    def __init__(self, owner_id, x, y, angle, weapon):
        ProjectileState._next_id += 1
        self.id = ProjectileState._next_id
        self.owner_id = owner_id
        self.x = x
        self.y = y
        self.dx = math.cos(angle)
        self.dy = math.sin(angle)
        self.speed = weapon['projectile_speed']
        self.damage = weapon['damage']
        self.max_range = weapon['range']
        self.traveled = 0.0


class PlayerState:
    __slots__ = (
        'player_id', 'display_name', 'x', 'y', 'angle', 'vx', 'vy',
        'health', 'alive', 'respawn_timer',
        'weapon_id', 'ammo', 'mag_size', 'fire_cooldown', 'reload_timer', 'reloading',
        'score', 'zombie_kills', 'deaths', 'shots_fired', 'shots_hit',
    )

    def __init__(self, player_id, display_name='Player'):
        self.player_id = player_id
        self.display_name = display_name
        self.x = 0.0
        self.y = 0.0
        self.angle = 0.0
        self.vx = 0.0
        self.vy = 0.0
        # Health
        self.health = PLAYER_MAX_HEALTH
        self.alive = True
        self.respawn_timer = 0.0
        # Weapon
        self.weapon_id = 'pistol'
        weapon = WEAPONS[self.weapon_id]
        self.ammo = weapon['magazine']
        self.mag_size = weapon['magazine']
        self.fire_cooldown = 0.0
        self.reload_timer = 0.0
        self.reloading = False
        # Scoring
        self.score = 0
        self.zombie_kills = 0
        self.deaths = 0
        self.shots_fired = 0
        self.shots_hit = 0

    def to_dict(self):
        return {
            'id': self.player_id,
            'name': self.display_name,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
            'angle': round(self.angle, 3),
            'hp': self.health,
            'alive': self.alive,
            'ammo': self.ammo,
            'maxAmmo': self.mag_size,
            'reloading': self.reloading,
            'score': self.score,
            'kills': self.zombie_kills,
        }


class GameRoom:
    def __init__(self, room_code):
        self.room_code = room_code
        self.players = {}       # player_id -> PlayerState
        self.projectiles = []   # list of ProjectileState
        self.zombies = []       # list of ZombieState
        self.items = []         # list of ItemDrop
        self.wave_spawner = WaveSpawner(WORLD_SIZE)
        self.events = []        # events to broadcast this tick
        self.kills = {}         # player_id -> kill count
        self.game_over = False
        self.game_over_sent = False
        self._all_dead_timer = 0.0
        self.start_time = time.time()
        self.last_tick = time.time()

    def add_player(self, player_id, display_name='Player'):
        state = PlayerState(player_id, display_name)
        state.x = random.uniform(-5, 5)
        state.y = random.uniform(-5, 5)
        self.players[player_id] = state
        return state

    def remove_player(self, player_id):
        self.players.pop(player_id, None)

    def process_input(self, player_id, move_x, move_y, angle):
        player = self.players.get(player_id)
        if not player or not player.alive:
            return

        length = math.sqrt(move_x * move_x + move_y * move_y)
        if length > 1.0:
            move_x /= length
            move_y /= length

        player.vx = move_x
        player.vy = move_y
        player.angle = angle

    def process_shoot(self, player_id):
        player = self.players.get(player_id)
        if not player or not player.alive:
            return

        if player.reloading or player.fire_cooldown > 0:
            return

        if player.ammo <= 0:
            return

        weapon = WEAPONS[player.weapon_id]
        player.ammo -= 1
        player.fire_cooldown = weapon['fire_rate']
        player.shots_fired += 1

        proj = ProjectileState(player_id, player.x, player.y, player.angle, weapon)
        self.projectiles.append(proj)

        self.events.append({
            'type': 'shoot',
            'pid': player_id,
            'x': round(player.x, 2),
            'y': round(player.y, 2),
            'angle': round(player.angle, 3),
        })

    def process_reload(self, player_id):
        player = self.players.get(player_id)
        if not player or not player.alive or player.reloading:
            return
        if player.ammo >= player.mag_size:
            return

        weapon = WEAPONS[player.weapon_id]
        player.reloading = True
        player.reload_timer = weapon['reload_time']

    def tick(self, dt):
        self.events = []
        half = WORLD_SIZE / 2

        # Don't tick if game is over
        if self.game_over:
            return

        alive_players = [p for p in self.players.values() if p.alive]

        # --- Game over detection ---
        if self.players and not alive_players and self.wave_spawner.wave > 0:
            self._all_dead_timer += dt
            if self._all_dead_timer >= GAME_OVER_DEAD_TIME:
                self.game_over = True
                elapsed = time.time() - self.start_time
                # Wave survival bonus
                for p in self.players.values():
                    p.score += self.wave_spawner.wave * 50
                self.events.append({
                    'type': 'game_over',
                    'wave': self.wave_spawner.wave,
                    'elapsed': round(elapsed, 1),
                    'scores': [
                        {
                            'id': p.player_id,
                            'name': p.display_name,
                            'score': p.score,
                            'kills': p.zombie_kills,
                            'deaths': p.deaths,
                            'accuracy': round(p.shots_hit / max(p.shots_fired, 1) * 100),
                        }
                        for p in self.players.values()
                    ],
                })
                return
        else:
            self._all_dead_timer = 0.0

        # Update players
        for player in self.players.values():
            if not player.alive:
                player.respawn_timer -= dt
                if player.respawn_timer <= 0:
                    player.alive = True
                    player.health = PLAYER_MAX_HEALTH
                    player.x = random.uniform(-10, 10)
                    player.y = random.uniform(-10, 10)
                    weapon = WEAPONS[player.weapon_id]
                    player.ammo = weapon['magazine']
                    player.reloading = False
                    self.events.append({'type': 'respawn', 'pid': player.player_id})
                continue

            # Movement
            player.x += player.vx * PLAYER_SPEED * dt
            player.y += player.vy * PLAYER_SPEED * dt
            player.x = max(-half, min(half, player.x))
            player.y = max(-half, min(half, player.y))

            # Weapon cooldowns
            if player.fire_cooldown > 0:
                player.fire_cooldown -= dt

            if player.reloading:
                player.reload_timer -= dt
                if player.reload_timer <= 0:
                    player.reloading = False
                    player.ammo = player.mag_size

        # --- Wave spawning ---
        alive_zombie_count = sum(1 for z in self.zombies if z.alive)
        spawns = self.wave_spawner.update(dt, alive_zombie_count, alive_players)
        for ztype, zx, zy in spawns:
            zombie = ZombieState(ztype, zx, zy)
            self.zombies.append(zombie)

        # Emit wave_start event
        if spawns and self.wave_spawner.total_spawned == len(spawns):
            self.events.append({
                'type': 'wave_start',
                'wave': self.wave_spawner.wave,
            })

        # --- Update zombies (AI: chase nearest player) ---
        for zombie in self.zombies:
            if not zombie.alive:
                continue

            # Find nearest alive player
            nearest = None
            nearest_dist = float('inf')
            for player in alive_players:
                dx = player.x - zombie.x
                dy = player.y - zombie.y
                dist = math.sqrt(dx * dx + dy * dy)
                if dist < nearest_dist:
                    nearest_dist = dist
                    nearest = player

            if nearest is None:
                continue

            # Move toward nearest player
            dx = nearest.x - zombie.x
            dy = nearest.y - zombie.y
            dist = math.sqrt(dx * dx + dy * dy)

            if dist > 0.1:
                zombie.angle = math.atan2(dy, dx)
                zombie.x += (dx / dist) * zombie.speed * dt
                zombie.y += (dy / dist) * zombie.speed * dt
                zombie.x = max(-half, min(half, zombie.x))
                zombie.y = max(-half, min(half, zombie.y))

            # Attack player on contact
            if zombie.attack_timer > 0:
                zombie.attack_timer -= dt

            hit_radius = zombie.size + 0.6  # zombie size + player size
            if dist < hit_radius and zombie.attack_timer <= 0:
                nearest.health -= zombie.damage
                zombie.attack_timer = zombie.attack_cooldown
                self.events.append({
                    'type': 'zombie_hit',
                    'pid': nearest.player_id,
                    'dmg': zombie.damage,
                    'hp': nearest.health,
                })
                if nearest.health <= 0:
                    nearest.health = 0
                    nearest.alive = False
                    nearest.respawn_timer = RESPAWN_TIME
                    nearest.vx = 0
                    nearest.vy = 0
                    nearest.deaths += 1
                    self.events.append({
                        'type': 'kill',
                        'pid': nearest.player_id,
                        'by': 'zombie',
                    })

        # --- Update projectiles (hit zombies AND players) ---
        surviving = []
        for proj in self.projectiles:
            move = proj.speed * dt
            proj.x += proj.dx * move
            proj.y += proj.dy * move
            proj.traveled += move

            if proj.traveled >= proj.max_range:
                continue
            if abs(proj.x) > half or abs(proj.y) > half:
                continue

            hit = False

            # Check hit against zombies first
            for zombie in self.zombies:
                if not zombie.alive:
                    continue
                dx = zombie.x - proj.x
                dy = zombie.y - proj.y
                if dx * dx + dy * dy < zombie.size * zombie.size + 0.5:
                    zombie.health -= proj.damage
                    # Track accuracy
                    shooter = self.players.get(proj.owner_id)
                    if shooter:
                        shooter.shots_hit += 1
                    if zombie.health <= 0:
                        zombie.health = 0
                        zombie.alive = False
                        self.kills[proj.owner_id] = self.kills.get(proj.owner_id, 0) + 1
                        # Award score + track kills
                        if shooter:
                            shooter.zombie_kills += 1
                            shooter.score += zombie.xp
                        self.events.append({
                            'type': 'zombie_kill',
                            'zid': zombie.id,
                            'by': proj.owner_id,
                            'xp': zombie.xp,
                        })
                        # Item drop
                        if random.random() < ITEM_DROP_CHANCE:
                            itype = random.choice(['health', 'ammo'])
                            self.items.append(ItemDrop(itype, zombie.x, zombie.y))
                    hit = True
                    break

            # Check hit against players (PvP)
            if not hit:
                for player in self.players.values():
                    if player.player_id == proj.owner_id or not player.alive:
                        continue
                    dx = player.x - proj.x
                    dy = player.y - proj.y
                    if dx * dx + dy * dy < 1.0:
                        player.health -= proj.damage
                        self.events.append({
                            'type': 'hit',
                            'pid': player.player_id,
                            'by': proj.owner_id,
                            'dmg': proj.damage,
                            'hp': player.health,
                        })
                        if player.health <= 0:
                            player.health = 0
                            player.alive = False
                            player.respawn_timer = RESPAWN_TIME
                            player.vx = 0
                            player.vy = 0
                            self.events.append({
                                'type': 'kill',
                                'pid': player.player_id,
                                'by': proj.owner_id,
                            })
                        hit = True
                        break

            if not hit:
                surviving.append(proj)

        self.projectiles = surviving

        # Clean up dead zombies
        self.zombies = [z for z in self.zombies if z.alive]

        # --- Update items (lifetime + pickup) ---
        surviving_items = []
        for item in self.items:
            item.lifetime -= dt
            if item.lifetime <= 0:
                continue

            picked = False
            for player in alive_players:
                dx = player.x - item.x
                dy = player.y - item.y
                if dx * dx + dy * dy < ITEM_PICKUP_RADIUS * ITEM_PICKUP_RADIUS:
                    idef = ITEM_TYPES[item.item_type]
                    if item.item_type == 'health' and player.health < PLAYER_MAX_HEALTH:
                        player.health = min(PLAYER_MAX_HEALTH, player.health + idef['heal'])
                        picked = True
                    elif item.item_type == 'ammo':
                        player.ammo = min(player.mag_size, player.ammo + idef['ammo'])
                        picked = True
                    if picked:
                        player.score += 5
                        self.events.append({
                            'type': 'item_pickup',
                            'pid': player.player_id,
                            'item': item.item_type,
                        })
                        break

            if not picked:
                surviving_items.append(item)

        self.items = surviving_items

    def get_state(self):
        return {
            'players': [p.to_dict() for p in self.players.values()],
            'projectiles': [
                {
                    'id': p.id,
                    'x': round(p.x, 2),
                    'y': round(p.y, 2),
                }
                for p in self.projectiles
            ],
            'zombies': [z.to_dict() for z in self.zombies if z.alive],
            'items': [i.to_dict() for i in self.items],
            'wave': self.wave_spawner.wave,
            'waveActive': self.wave_spawner.wave_active,
            'gameOver': self.game_over,
            'events': self.events,
        }


class GameManager:
    def __init__(self):
        self.rooms = {}  # room_code -> GameRoom

    def get_or_create_room(self, room_code):
        if room_code not in self.rooms:
            self.rooms[room_code] = GameRoom(room_code)
        return self.rooms[room_code]

    def remove_room(self, room_code):
        self.rooms.pop(room_code, None)

    def get_player_count(self, room_code):
        room = self.rooms.get(room_code)
        return len(room.players) if room else 0


# Singleton
game_manager = GameManager()
