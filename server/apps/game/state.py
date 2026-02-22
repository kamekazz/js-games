"""
In-memory game state manager. Holds all active game rooms and player states.
This runs in the same process as Django Channels (Daphne/ASGI).
"""
import time
import math
import random
import logging
from .zombies import ZombieState, WaveSpawner, ZOMBIE_TYPES

logger = logging.getLogger('game.anticheat')

PLAYER_SPEED = 12
PLAYER_SPRINT_MULTIPLIER = 1.7
# Anti-cheat: max allowed speed (sprint + small tolerance)
MAX_SPEED = PLAYER_SPEED * PLAYER_SPRINT_MULTIPLIER * 1.1
# Minimum fire cooldown multiplier for anti-cheat (fraction of weapon fire_rate)
FIRE_INTERVAL_TOLERANCE = 0.8
WORLD_SIZE = 200
TICK_RATE = 20
TICK_INTERVAL = 1.0 / TICK_RATE

# Weapon definitions
WEAPONS = {
    'pistol': {
        'damage': 20,
        'fire_rate': 0.3,
        'magazine': 8,
        'reload_time': 1.5,
        'projectile_speed': 40,
        'range': 30,
        'pellets': 1,
        'spread_angle': 0,
        'falloff': True,
        'falloff_start': 15,
        'falloff_min': 0.5,
    },
    'rifle': {
        'damage': 35,
        'fire_rate': 0.8,
        'magazine': 18,
        'reload_time': 2.5,
        'projectile_speed': 60,
        'range': 80,
        'pellets': 2,
        'spread_angle': 0,
        'ammo_cost': 2,
        'falloff': False,
        'falloff_start': 0,
        'falloff_min': 1.0,
    },
    'uzi': {
        'damage': 10,
        'fire_rate': 0.1,
        'magazine': 32,
        'reload_time': 1.8,
        'projectile_speed': 35,
        'range': 20,
        'pellets': 4,
        'spread_angle': 0,
        'ammo_cost': 4,
        'falloff': True,
        'falloff_start': 10,
        'falloff_min': 0.6,
    },
    'shotgun': {
        'damage': 8,
        'fire_rate': 1.0,
        'magazine': 6,
        'reload_time': 2.2,
        'projectile_speed': 30,
        'range': 12,
        'pellets': 6,
        'spread_angle': 0.35,
        'falloff': True,
        'falloff_start': 5,
        'falloff_min': 0.3,
        'close_bonus': 1.5,
        'close_bonus_range': 5,
    },
}

VALID_WEAPON_IDS = set(WEAPONS.keys())

# Obstacle definitions (half-widths for collision)
OBSTACLE_TYPES = {
    'building_sm': {'half_w': 5.0,  'half_d': 4.0},
    'building_md': {'half_w': 7.0,  'half_d': 5.0},
    'building_lg': {'half_w': 9.0,  'half_d': 7.0},
    'car':         {'half_w': 2.5,  'half_d': 1.25},
    'truck':       {'half_w': 3.5,  'half_d': 1.5},
    'crate':       {'half_w': 1.0,  'half_d': 1.0},
    'barrier':     {'half_w': 2.0,  'half_d': 0.25},
}
SPAWN_CLEAR_RADIUS = 15  # keep center clear for player spawns

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


class GroundPatch:
    """Non-collidable ground surface (road, mud, sidewalk)."""
    __slots__ = ('patch_type', 'x', 'y', 'w', 'd', 'angle')

    def __init__(self, patch_type, x, y, w, d, angle=0.0):
        self.patch_type = patch_type
        self.x = x
        self.y = y
        self.w = w
        self.d = d
        self.angle = angle

    def to_dict(self):
        return {
            'type': self.patch_type,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
            'w': round(self.w, 2),
            'd': round(self.d, 2),
            'angle': round(self.angle, 3),
        }


class ObstacleState:
    __slots__ = ('id', 'obstacle_type', 'x', 'y', 'angle', 'half_w', 'half_d',
                 '_cos', '_sin')

    _next_id = 0

    def __init__(self, obstacle_type, x, y, angle):
        ObstacleState._next_id += 1
        self.id = ObstacleState._next_id
        self.obstacle_type = obstacle_type
        self.x = x
        self.y = y
        self.angle = angle
        info = OBSTACLE_TYPES[obstacle_type]
        self.half_w = info['half_w']
        self.half_d = info['half_d']
        # Cache rotation for collision checks
        self._cos = math.cos(-angle)
        self._sin = math.sin(-angle)

    def point_collides(self, px, py, radius=0.0):
        """Check if a point (with optional radius) collides with this obstacle."""
        # Transform point into obstacle's local space
        dx = px - self.x
        dy = py - self.y
        lx = dx * self._cos - dy * self._sin
        ly = dx * self._sin + dy * self._cos
        return (abs(lx) < self.half_w + radius and
                abs(ly) < self.half_d + radius)

    def push_out(self, px, py, radius):
        """If point collides, push it out to the nearest edge. Returns (new_x, new_y, collided)."""
        dx = px - self.x
        dy = py - self.y
        lx = dx * self._cos - dy * self._sin
        ly = dx * self._sin + dy * self._cos

        hw = self.half_w + radius
        hd = self.half_d + radius

        if abs(lx) >= hw or abs(ly) >= hd:
            return px, py, False

        # Find shortest push-out axis
        push_right = hw - lx
        push_left = hw + lx
        push_top = hd - ly
        push_bottom = hd + ly

        min_push = min(push_right, push_left, push_top, push_bottom)

        if min_push == push_right:
            lx = hw
        elif min_push == push_left:
            lx = -hw
        elif min_push == push_top:
            ly = hd
        else:
            ly = -hd

        # Transform back to world space (inverse rotation)
        cos_a = self._cos
        sin_a = self._sin
        nx = self.x + lx * cos_a + ly * sin_a
        ny = self.y - lx * sin_a + ly * cos_a

        return nx, ny, True

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.obstacle_type,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
            'angle': round(self.angle, 3),
            'hw': self.half_w,
            'hd': self.half_d,
        }


class ProjectileState:
    __slots__ = ('id', 'owner_id', 'x', 'y', 'dx', 'dy', 'speed', 'damage', 'max_range', 'traveled', 'weapon_id')

    _next_id = 0

    def __init__(self, owner_id, x, y, angle, weapon, weapon_id='pistol'):
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
        self.weapon_id = weapon_id


class PlayerState:
    __slots__ = (
        'player_id', 'display_name', 'x', 'y', 'angle', 'vx', 'vy',
        'health', 'alive', 'respawn_timer',
        'weapon_id', 'ammo', 'mag_size', 'fire_cooldown', 'reload_timer', 'reloading',
        'score', 'zombie_kills', 'deaths', 'shots_fired', 'shots_hit',
        'sprinting', '_last_shot_time',
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
        # Sprint
        self.sprinting = False
        # Anti-cheat
        self._last_shot_time = 0.0

    def to_dict(self):
        return {
            'id': self.player_id,
            'name': self.display_name,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
            'angle': round(self.angle, 3),
            'hp': self.health,
            'alive': self.alive,
            'weapon': self.weapon_id,
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
        self.obstacles = []
        self.ground_patches = []
        self._generate_obstacles()

    def add_player(self, player_id, display_name='Player'):
        state = PlayerState(player_id, display_name)
        state.x = random.uniform(-5, 5)
        state.y = random.uniform(-5, 5)
        self.players[player_id] = state
        return state

    def remove_player(self, player_id):
        self.players.pop(player_id, None)

    def process_input(self, player_id, move_x, move_y, angle, sprinting=False):
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
        player.sprinting = bool(sprinting) and (move_x != 0 or move_y != 0)

    def process_shoot(self, player_id):
        player = self.players.get(player_id)
        if not player or not player.alive:
            return

        if player.reloading or player.fire_cooldown > 0:
            return

        if player.ammo <= 0:
            return

        weapon = WEAPONS[player.weapon_id]

        # Anti-cheat: enforce minimum fire interval per weapon
        now = time.time()
        min_interval = weapon['fire_rate'] * FIRE_INTERVAL_TOLERANCE
        if now - player._last_shot_time < min_interval:
            logger.warning('Rapid fire from %s (%.3fs)', player_id, now - player._last_shot_time)
            return
        player._last_shot_time = now

        player.ammo = max(0, player.ammo - weapon.get('ammo_cost', 1))
        player.fire_cooldown = weapon['fire_rate']
        player.shots_fired += 1

        pellets = weapon.get('pellets', 1)
        spread = weapon.get('spread_angle', 0)

        if pellets > 1:
            if spread > 0:
                # Spread pellets across the angle (shotgun)
                half_spread = spread / 2
                for i in range(pellets):
                    offset = -half_spread + spread * (i / (pellets - 1))
                    pellet_angle = player.angle + offset
                    proj = ProjectileState(player_id, player.x, player.y, pellet_angle, weapon, player.weapon_id)
                    self.projectiles.append(proj)
            else:
                # Multiple pellets, same direction staggered behind each other (rifle)
                dx = math.cos(player.angle)
                dy = math.sin(player.angle)
                spacing = 1.2  # distance between bullets
                for i in range(pellets):
                    ox = player.x - dx * spacing * i
                    oy = player.y - dy * spacing * i
                    proj = ProjectileState(player_id, ox, oy, player.angle, weapon, player.weapon_id)
                    self.projectiles.append(proj)
        else:
            proj = ProjectileState(player_id, player.x, player.y, player.angle, weapon, player.weapon_id)
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

    def process_switch_weapon(self, player_id, weapon_id):
        if weapon_id not in VALID_WEAPON_IDS:
            return
        player = self.players.get(player_id)
        if not player or not player.alive:
            return
        if player.reloading:
            return
        if player.weapon_id == weapon_id:
            return

        player.weapon_id = weapon_id
        weapon = WEAPONS[weapon_id]
        player.ammo = weapon['magazine']
        player.mag_size = weapon['magazine']
        player.fire_cooldown = 0.0
        player.reload_timer = 0.0
        player.reloading = False

    def _generate_obstacles(self):
        half = WORLD_SIZE / 2

        # --- 1. Generate cluster centers ---
        cluster_centers = []
        for _ in range(200):
            if len(cluster_centers) >= 7:
                break
            cx = random.uniform(-half + 20, half - 20)
            cy = random.uniform(-half + 20, half - 20)
            # Avoid spawn zone
            if abs(cx) < SPAWN_CLEAR_RADIUS and abs(cy) < SPAWN_CLEAR_RADIUS:
                continue
            # Min distance from other clusters
            too_close = False
            for ox, oy, _ in cluster_centers:
                if math.sqrt((cx - ox)**2 + (cy - oy)**2) < 30:
                    too_close = True
                    break
            if too_close:
                continue
            cluster_angle = random.uniform(0, math.pi * 2)
            cluster_centers.append((cx, cy, cluster_angle))

        # --- 2. Place buildings per cluster ---
        building_types = ['building_sm', 'building_md', 'building_lg']
        for cx, cy, base_angle in cluster_centers:
            num_buildings = random.randint(3, 6)
            placed = []
            for i in range(num_buildings):
                btype = random.choice(building_types)
                info = OBSTACLE_TYPES[btype]
                hw, hd = info['half_w'], info['half_d']

                if i == 0:
                    bx, by = cx, cy
                else:
                    # Place adjacent to a random previously placed building
                    ref = random.choice(placed)
                    ref_info = OBSTACLE_TYPES[ref['type']]
                    side = random.choice(['right', 'below', 'left', 'above'])
                    gap = 2.5  # tight hallway width
                    cos_a = math.cos(base_angle)
                    sin_a = math.sin(base_angle)
                    if side == 'right':
                        lx = ref_info['half_w'] + hw + gap
                        ly = 0
                    elif side == 'left':
                        lx = -(ref_info['half_w'] + hw + gap)
                        ly = 0
                    elif side == 'below':
                        lx = 0
                        ly = ref_info['half_d'] + hd + gap
                    else:
                        lx = 0
                        ly = -(ref_info['half_d'] + hd + gap)
                    bx = ref['x'] + lx * cos_a - ly * sin_a
                    by = ref['y'] + lx * sin_a + ly * cos_a

                # Clamp inside world
                bx = max(-half + hw + 2, min(half - hw - 2, bx))
                by = max(-half + hd + 2, min(half - hd - 2, by))
                # Skip if overlaps spawn zone
                if abs(bx) < SPAWN_CLEAR_RADIUS + hw and abs(by) < SPAWN_CLEAR_RADIUS + hd:
                    continue

                self.obstacles.append(ObstacleState(btype, bx, by, base_angle))
                placed.append({'type': btype, 'x': bx, 'y': by})

            # Sidewalk patch around cluster
            if placed:
                min_x = min(b['x'] - OBSTACLE_TYPES[b['type']]['half_w'] for b in placed)
                max_x = max(b['x'] + OBSTACLE_TYPES[b['type']]['half_w'] for b in placed)
                min_y = min(b['y'] - OBSTACLE_TYPES[b['type']]['half_d'] for b in placed)
                max_y = max(b['y'] + OBSTACLE_TYPES[b['type']]['half_d'] for b in placed)
                pad = 4
                sw = (max_x - min_x) + pad * 2
                sd = (max_y - min_y) + pad * 2
                scx = (min_x + max_x) / 2
                scy = (min_y + max_y) / 2
                self.ground_patches.append(GroundPatch('sidewalk', scx, scy, sw, sd))

        # --- 3. Roads connecting nearby clusters ---
        for i in range(len(cluster_centers)):
            for j in range(i + 1, len(cluster_centers)):
                x1, y1, _ = cluster_centers[i]
                x2, y2, _ = cluster_centers[j]
                dist = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
                if dist > 60:
                    continue
                # Road patch between clusters
                mx = (x1 + x2) / 2
                my = (y1 + y2) / 2
                angle = math.atan2(y2 - y1, x2 - x1)
                self.ground_patches.append(GroundPatch('road', mx, my, dist, 8.0, angle))

        # --- 4. Cars along roads and near clusters ---
        num_cars = random.randint(10, 15)
        for _ in range(num_cars):
            ctype = random.choice(['car', 'truck'])
            # Place near a random cluster or road
            cluster = random.choice(cluster_centers)
            offset_dist = random.uniform(12, 25)
            offset_angle = random.uniform(0, math.pi * 2)
            vx = cluster[0] + math.cos(offset_angle) * offset_dist
            vy = cluster[1] + math.sin(offset_angle) * offset_dist
            vx = max(-half + 5, min(half - 5, vx))
            vy = max(-half + 5, min(half - 5, vy))
            if abs(vx) < SPAWN_CLEAR_RADIUS and abs(vy) < SPAWN_CLEAR_RADIUS:
                continue
            car_angle = offset_angle + random.uniform(-0.3, 0.3)
            self.obstacles.append(ObstacleState(ctype, vx, vy, car_angle))

        # --- 5. Crates in hallways and open areas ---
        num_crates = random.randint(15, 20)
        for _ in range(num_crates):
            cluster = random.choice(cluster_centers)
            cx = cluster[0] + random.uniform(-15, 15)
            cy = cluster[1] + random.uniform(-15, 15)
            cx = max(-half + 3, min(half - 3, cx))
            cy = max(-half + 3, min(half - 3, cy))
            if abs(cx) < SPAWN_CLEAR_RADIUS and abs(cy) < SPAWN_CLEAR_RADIUS:
                continue
            self.obstacles.append(ObstacleState('crate', cx, cy, random.uniform(0, math.pi * 2)))

        # --- 6. Barriers scattered around ---
        num_barriers = random.randint(8, 12)
        for _ in range(num_barriers):
            bx = random.uniform(-half + 5, half - 5)
            by = random.uniform(-half + 5, half - 5)
            if abs(bx) < SPAWN_CLEAR_RADIUS and abs(by) < SPAWN_CLEAR_RADIUS:
                continue
            self.obstacles.append(ObstacleState('barrier', bx, by, random.uniform(0, math.pi)))

        # --- 7. Mud patches in open areas ---
        num_mud = random.randint(10, 15)
        for _ in range(num_mud):
            mx = random.uniform(-half + 10, half - 10)
            my = random.uniform(-half + 10, half - 10)
            mw = random.uniform(6, 14)
            md = random.uniform(6, 14)
            self.ground_patches.append(GroundPatch('mud', mx, my, mw, md, random.uniform(0, math.pi)))

    def _push_out_of_obstacles(self, x, y, radius):
        """Push a point out of all obstacles. Returns (new_x, new_y)."""
        for obs in self.obstacles:
            x, y, _ = obs.push_out(x, y, radius)
        return x, y

    def _projectile_hits_obstacle(self, px, py):
        """Check if a projectile point is inside any obstacle."""
        for obs in self.obstacles:
            if obs.point_collides(px, py, 0.0):
                return obs
        return None

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
            speed = PLAYER_SPEED * (PLAYER_SPRINT_MULTIPLIER if player.sprinting else 1.0)
            player.x += player.vx * speed * dt
            player.y += player.vy * speed * dt
            player.x = max(-half, min(half, player.x))
            player.y = max(-half, min(half, player.y))
            # Obstacle collision
            player.x, player.y = self._push_out_of_obstacles(player.x, player.y, 0.5)

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
                # Obstacle collision
                zombie.x, zombie.y = self._push_out_of_obstacles(zombie.x, zombie.y, zombie.size * 0.5)

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

            # Check obstacle collision
            hit_obs = self._projectile_hits_obstacle(proj.x, proj.y)
            if hit_obs:
                self.events.append({
                    'type': 'proj_hit',
                    'x': round(proj.x, 2),
                    'y': round(proj.y, 2),
                    'dmg': 0,
                })
                continue

            hit = False

            # Check hit against zombies first
            for zombie in self.zombies:
                if not zombie.alive:
                    continue
                dx = zombie.x - proj.x
                dy = zombie.y - proj.y
                if dx * dx + dy * dy < zombie.size * zombie.size + 0.5:
                    dmg = self._calc_damage(proj)
                    zombie.health -= dmg
                    # Track accuracy
                    shooter = self.players.get(proj.owner_id)
                    if shooter:
                        shooter.shots_hit += 1
                    self.events.append({
                        'type': 'proj_hit',
                        'x': round(zombie.x, 2),
                        'y': round(zombie.y, 2),
                        'dmg': dmg,
                    })
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
                            'x': round(zombie.x, 2),
                            'y': round(zombie.y, 2),
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
                        player.health -= self._calc_damage(proj)
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

    def _calc_damage(self, proj):
        weapon = WEAPONS.get(proj.weapon_id)
        if not weapon:
            return proj.damage
        # Close-range bonus (e.g. shotgun +20% up close)
        close_range = weapon.get('close_bonus_range', 0)
        close_mult = weapon.get('close_bonus', 1.0)
        if close_range > 0 and proj.traveled <= close_range:
            return round(proj.damage * close_mult)
        if not weapon.get('falloff'):
            return proj.damage
        start = weapon['falloff_start']
        if proj.traveled <= start:
            return proj.damage
        # Linear falloff from start to max_range
        t = (proj.traveled - start) / max(proj.max_range - start, 0.01)
        t = min(t, 1.0)
        mult = 1.0 - t * (1.0 - weapon['falloff_min'])
        return round(proj.damage * mult)

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
            'obstacles': [o.to_dict() for o in self.obstacles],
            'ground': [g.to_dict() for g in self.ground_patches],
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
