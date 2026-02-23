"""
In-memory game state manager. Holds all active game rooms and player states.
This runs in the same process as Django Channels (Daphne/ASGI).
"""
import time
import math
import random
import logging
from .zombies import ZombieState, NightCycleSpawner, ZOMBIE_TYPES, NIGHT_DURATION

logger = logging.getLogger('game.anticheat')

PLAYER_SPEED = 12
PLAYER_SPRINT_MULTIPLIER = 1.0
PLAYER_WALK_MULTIPLIER = 0.5
# Anti-cheat: max allowed speed (sprint + small tolerance)
MAX_SPEED = PLAYER_SPEED * PLAYER_SPRINT_MULTIPLIER * 1.1
# Minimum fire cooldown multiplier for anti-cheat (fraction of weapon fire_rate)
FIRE_INTERVAL_TOLERANCE = 0.8
WORLD_SIZE = 200
TICK_RATE = 20
TICK_INTERVAL = 1.0 / TICK_RATE
ZOMBIE_SEPARATION_DIST = 1.2  # min distance multiplier between zombie centers

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
        'cone_max_spread': 2,
        'cone_min_spread': 0.04,
        'focus_duration': 0.8,
        'laser_length': 5,
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
        'cone_max_spread': 0.8,
        'cone_min_spread': 0.02,
        'focus_duration': 1.5,
        'laser_length': 50,
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
        'cone_max_spread': 3,
        'cone_min_spread': 0.08,
        'focus_duration': 0.4,
        'laser_length': 3.5,
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
        'cone_max_spread': 5,
        'cone_min_spread': 0.3,
        'focus_duration': 0.6,
        'laser_length': 2.5,
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

# Stamina
MAX_STAMINA = 100
STAMINA_WALK_DRAIN = 0        # no stamina drain while walking
STAMINA_SPRINT_DRAIN = 3     # per second while sprinting
STAMINA_REGEN = 25            # per second while standing still
STAMINA_REGEN_DELAY = 0.3     # seconds before regen starts
EXHAUSTION_THRESHOLD = 30     # below this, speed drops
EXHAUSTION_MIN_MULT = 0.45    # speed multiplier at 0 stamina

# Surface speed multipliers (default = grass)
SURFACE_SPEED = {
    'road': 1.0,
    'sidewalk': 1.0,
    'mud': 0.7,
}
GRASS_SPEED = 0.8  # default when not on any patch

# Item drop definitions
ITEM_TYPES = {
    'health': {'heal': 30, 'color': 'green'},
    'ammo':   {'ammo': 12, 'color': 'orange'},
}
ITEM_DROP_CHANCE = 0.35  # 35% chance a zombie drops an item
ITEM_PICKUP_RADIUS = 1.5
ITEM_LIFETIME = 15.0  # seconds before item disappears

# Interaction / extraction constants
EXTRACTION_ZONE_RADIUS = 8.0
EXTRACTION_HOLD_DURATION = 15.0
CHEST_INTERACT_RADIUS = 2.5
CAR_INTERACT_RADIUS = 3.5

# Chest loot table: (weight, loot_dict, hold_duration)
CHEST_LOOT_TABLE = [
    (30, {'type': 'weapon_unlock', 'weapon_id': 'rifle'}, 4.0),
    (30, {'type': 'weapon_unlock', 'weapon_id': 'uzi'}, 4.0),
    (20, {'type': 'weapon_unlock', 'weapon_id': 'shotgun'}, 5.0),
    (40, {'type': 'ammo', 'weapon_id': 'rifle', 'amount': 18}, 2.5),
    (40, {'type': 'ammo', 'weapon_id': 'uzi', 'amount': 32}, 2.5),
    (30, {'type': 'ammo', 'weapon_id': 'shotgun', 'amount': 12}, 2.5),
    (35, {'type': 'health', 'amount': 50}, 2.0),
    (20, {'type': 'score', 'amount': 200}, 3.0),
]

# Car loot table (slightly better rewards)
CAR_LOOT_TABLE = [
    (25, {'type': 'weapon_unlock', 'weapon_id': 'rifle'}, 3.5),
    (25, {'type': 'weapon_unlock', 'weapon_id': 'uzi'}, 3.5),
    (20, {'type': 'weapon_unlock', 'weapon_id': 'shotgun'}, 4.0),
    (40, {'type': 'ammo', 'weapon_id': 'rifle', 'amount': 24}, 2.5),
    (40, {'type': 'ammo', 'weapon_id': 'uzi', 'amount': 40}, 2.5),
    (30, {'type': 'ammo', 'weapon_id': 'shotgun', 'amount': 16}, 2.5),
    (30, {'type': 'health', 'amount': 60}, 2.0),
    (15, {'type': 'score', 'amount': 300}, 3.0),
]


class ItemDrop:
    __slots__ = ('id', 'item_type', 'x', 'y', 'lifetime', 'weapon_id')

    _next_id = 0

    def __init__(self, item_type, x, y, weapon_id=None):
        ItemDrop._next_id += 1
        self.id = ItemDrop._next_id
        self.item_type = item_type
        self.x = x
        self.y = y
        self.lifetime = ITEM_LIFETIME
        self.weapon_id = weapon_id  # which weapon's ammo (None for health)

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.item_type,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
        }


def _roll_loot(table):
    """Weighted random pick from a loot table. Returns (loot_dict, hold_duration)."""
    total = sum(w for w, _, _ in table)
    r = random.random() * total
    cumulative = 0
    for weight, loot, duration in table:
        cumulative += weight
        if r <= cumulative:
            return dict(loot), duration
    # Fallback
    _, loot, duration = table[-1]
    return dict(loot), duration


class ExtractionZone:
    __slots__ = ('id', 'x', 'y', 'radius')

    _next_id = 0

    def __init__(self, x, y, radius=EXTRACTION_ZONE_RADIUS):
        ExtractionZone._next_id += 1
        self.id = ExtractionZone._next_id
        self.x = x
        self.y = y
        self.radius = radius

    def contains(self, px, py):
        dx = px - self.x
        dy = py - self.y
        return dx * dx + dy * dy < self.radius * self.radius

    def to_dict(self):
        return {
            'id': self.id,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
            'r': self.radius,
        }


class LootChest:
    __slots__ = ('id', 'x', 'y', 'opened', 'loot', 'hold_duration')

    _next_id = 0

    def __init__(self, x, y):
        LootChest._next_id += 1
        self.id = LootChest._next_id
        self.x = x
        self.y = y
        self.opened = False
        self.loot, self.hold_duration = _roll_loot(CHEST_LOOT_TABLE)

    def to_dict(self):
        return {
            'id': self.id,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
            'opened': self.opened,
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
                 '_cos', '_sin', 'lootable', 'looted', 'car_loot', 'car_loot_duration')

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
        # Car loot
        self.lootable = obstacle_type in ('car', 'truck')
        self.looted = False
        if self.lootable:
            loot, dur = _roll_loot(CAR_LOOT_TABLE)
            self.car_loot = loot
            self.car_loot_duration = dur
        else:
            self.car_loot = None
            self.car_loot_duration = 0

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
        d = {
            'id': self.id,
            'type': self.obstacle_type,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
            'angle': round(self.angle, 3),
            'hw': self.half_w,
            'hd': self.half_d,
        }
        if self.lootable:
            d['lootable'] = True
            d['looted'] = self.looted
        return d


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
        'health', 'alive', 'eliminated',
        'weapon_id', 'ammo', 'mag_size', 'fire_cooldown', 'reload_timer', 'reloading',
        'score', 'zombie_kills', 'deaths', 'shots_fired', 'shots_hit',
        'sprinting', '_last_shot_time',
        'stamina', '_stamina_regen_timer',
        'unlocked_weapons', 'weapon_ammo_reserve',
        'action_holding', 'action_progress', 'action_target_id', 'action_target_type', 'action_duration',
        'extracted',
        'user_id', '_leaderboard_saved',
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
        self.eliminated = False
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
        # Sprint & stamina
        self.sprinting = False
        self.stamina = MAX_STAMINA
        self._stamina_regen_timer = 0.0
        # Anti-cheat
        self._last_shot_time = 0.0
        # Weapon progression
        self.unlocked_weapons = {'pistol'}
        self.weapon_ammo_reserve = {'pistol': -1, 'rifle': 0, 'uzi': 0, 'shotgun': 0}  # -1 = infinite
        # Action / interaction
        self.action_holding = False
        self.action_progress = 0.0
        self.action_target_id = None
        self.action_target_type = None
        self.action_duration = 0.0
        # Extraction
        self.extracted = False
        # Identity / leaderboard
        self.user_id = None
        self._leaderboard_saved = False

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
            'stamina': round(self.stamina, 1),
            'unlockedWeapons': list(self.unlocked_weapons),
            'ammoReserve': dict(self.weapon_ammo_reserve),
            'actionProgress': round(self.action_progress, 2),
            'actionDuration': round(self.action_duration, 2),
            'actionTargetType': self.action_target_type,
            'extracted': self.extracted,
        }


class GameRoom:
    def __init__(self, room_code):
        self.room_code = room_code
        self.players = {}       # player_id -> PlayerState
        self.projectiles = []   # list of ProjectileState
        self.zombies = []       # list of ZombieState
        self.items = []         # list of ItemDrop
        self.night_spawner = NightCycleSpawner(WORLD_SIZE)
        self.events = []        # events to broadcast this tick
        self.kills = {}         # player_id -> kill count
        self.game_over = False
        self.start_time = time.time()
        self.last_tick = time.time()
        self.obstacles = []
        self.ground_patches = []
        self.extraction_zones = []
        self.chests = []
        self._prev_night_active = False
        self._static_state = None

        # Reset class-level ID counters to prevent unbounded growth across sessions
        ObstacleState._next_id = 0
        ExtractionZone._next_id = 0
        LootChest._next_id = 0
        ItemDrop._next_id = 0
        ProjectileState._next_id = 0

        self._generate_obstacles()
        self._generate_extraction_zones()
        self._rebuild_static_state()

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

    def process_shoot(self, player_id, aim_time=0.0):
        player = self.players.get(player_id)
        if not player or not player.alive:
            return

        if player.reloading or player.fire_cooldown > 0:
            return

        # Can't shoot while sprinting
        if player.sprinting:
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

        # Calculate accuracy spread from cone focus
        focus_duration = weapon.get('focus_duration', 1.0)
        cone_max = weapon.get('cone_max_spread', 0)
        cone_min = weapon.get('cone_min_spread', 0)
        laser_len = weapon.get('laser_length', 5)
        # Clamp aim_time to focus_duration (anti-cheat)
        aim_time = min(aim_time, focus_duration)
        progress = min(aim_time / focus_duration, 1.0) if focus_duration > 0 else 1.0
        cone_spread = cone_min + (cone_max - cone_min) * (1.0 - progress)
        # Convert cone width at laser distance to angular half-spread
        accuracy_half_angle = math.atan2(cone_spread / 2, laser_len)

        pellets = weapon.get('pellets', 1)
        spread = weapon.get('spread_angle', 0)

        if pellets > 1:
            if spread > 0:
                # Spread pellets across the angle (shotgun) + accuracy offset
                half_spread = spread / 2
                for i in range(pellets):
                    offset = -half_spread + spread * (i / (pellets - 1))
                    noise = random.uniform(-accuracy_half_angle, accuracy_half_angle)
                    pellet_angle = player.angle + offset + noise
                    proj = ProjectileState(player_id, player.x, player.y, pellet_angle, weapon, player.weapon_id)
                    self.projectiles.append(proj)
            else:
                # Multiple pellets, same direction staggered behind each other (rifle)
                dx = math.cos(player.angle)
                dy = math.sin(player.angle)
                spacing = 1.2  # distance between bullets
                noise = random.uniform(-accuracy_half_angle, accuracy_half_angle)
                aimed_angle = player.angle + noise
                dx = math.cos(aimed_angle)
                dy = math.sin(aimed_angle)
                for i in range(pellets):
                    ox = player.x - dx * spacing * i
                    oy = player.y - dy * spacing * i
                    proj = ProjectileState(player_id, ox, oy, aimed_angle, weapon, player.weapon_id)
                    self.projectiles.append(proj)
        else:
            noise = random.uniform(-accuracy_half_angle, accuracy_half_angle)
            proj = ProjectileState(player_id, player.x, player.y, player.angle + noise, weapon, player.weapon_id)
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
        # Can't reload when fully exhausted
        if player.stamina <= 0:
            return
        # Can't reload if no ammo in reserve (except infinite)
        reserve = player.weapon_ammo_reserve.get(player.weapon_id, 0)
        if reserve == 0:
            return

        weapon = WEAPONS[player.weapon_id]
        # Low stamina makes reloading slower (up to 2.5x at stamina near 0)
        if player.stamina < EXHAUSTION_THRESHOLD:
            reload_mult = 1.0 + 1.5 * (1.0 - player.stamina / EXHAUSTION_THRESHOLD)
        else:
            reload_mult = 1.0
        player.reloading = True
        player.reload_timer = weapon['reload_time'] * reload_mult

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
        # Must have unlocked weapon
        if weapon_id not in player.unlocked_weapons:
            return

        player.weapon_id = weapon_id
        weapon = WEAPONS[weapon_id]
        # Load magazine from reserve
        reserve = player.weapon_ammo_reserve.get(weapon_id, 0)
        if reserve == -1:
            # Infinite ammo (pistol)
            player.ammo = weapon['magazine']
        else:
            give = min(reserve, weapon['magazine'])
            player.ammo = give
            player.weapon_ammo_reserve[weapon_id] = reserve - give
        player.mag_size = weapon['magazine']
        player.fire_cooldown = 0.0
        player.reload_timer = 0.0
        player.reloading = False

    def process_action_hold(self, player_id, holding):
        player = self.players.get(player_id)
        if not player or not player.alive:
            return
        player.action_holding = bool(holding)

    def _rebuild_static_state(self):
        """Cache serialization of static/rarely-changing data."""
        self._static_state = {
            'obstacles': [o.to_dict() for o in self.obstacles],
            'ground': [g.to_dict() for g in self.ground_patches],
            'extractionZones': [z.to_dict() for z in self.extraction_zones],
        }

    def _generate_obstacles(self):
        half = WORLD_SIZE / 2

        # --- Grid-based town layout ---
        block_size = 22
        street_width = 8
        grid_count = 5
        cell_step = block_size + street_width  # 30
        grid_offset = (grid_count - 1) * cell_step / 2  # 60

        # Build block centers (skip center block = spawn plaza)
        block_centers = []
        for row in range(grid_count):
            for col in range(grid_count):
                cx = col * cell_step - grid_offset
                cy = row * cell_step - grid_offset
                if row == 2 and col == 2:
                    continue
                block_centers.append((cx, cy))

        # --- 1. Place buildings in each block ---
        building_types = ['building_sm', 'building_md', 'building_lg']
        all_buildings = []  # track for crate placement
        for cx, cy in block_centers:
            num_buildings = random.randint(1, 3)
            placed = []
            for i in range(num_buildings):
                btype = random.choice(building_types)
                info = OBSTACLE_TYPES[btype]
                hw, hd = info['half_w'], info['half_d']

                if i == 0:
                    bx, by = cx, cy
                elif i == 1:
                    # Place to the side of first building
                    ref = placed[0]
                    ref_hw = OBSTACLE_TYPES[ref['type']]['half_w']
                    gap = 2.5
                    if random.random() < 0.5:
                        bx = ref['x'] + ref_hw + hw + gap
                        by = ref['y']
                    else:
                        bx = ref['x']
                        by = ref['y'] + OBSTACLE_TYPES[ref['type']]['half_d'] + hd + gap
                else:
                    # Third building: try opposite side
                    ref = placed[0]
                    ref_hw = OBSTACLE_TYPES[ref['type']]['half_w']
                    ref_hd = OBSTACLE_TYPES[ref['type']]['half_d']
                    gap = 2.5
                    if random.random() < 0.5:
                        bx = ref['x'] - ref_hw - hw - gap
                        by = ref['y']
                    else:
                        bx = ref['x']
                        by = ref['y'] - ref_hd - hd - gap

                # Keep within block bounds
                block_half = block_size / 2
                bx = max(cx - block_half + hw, min(cx + block_half - hw, bx))
                by = max(cy - block_half + hd, min(cy + block_half - hd, by))

                self.obstacles.append(ObstacleState(btype, bx, by, 0.0))
                placed.append({'type': btype, 'x': bx, 'y': by})
                all_buildings.append({'type': btype, 'x': bx, 'y': by})

            # Sidewalk patch around block (thin edge, avoid overlapping roads)
            pad = 1
            self.ground_patches.append(
                GroundPatch('sidewalk', cx, cy, block_size + pad * 2, block_size + pad * 2)
            )

        # --- 2. Streets: full-length N-S and E-S road patches ---
        grid_min = -grid_offset - block_size / 2
        grid_max = grid_offset + block_size / 2
        grid_length = grid_max - grid_min

        # Horizontal streets (between rows)
        for i in range(grid_count - 1):
            sy = i * cell_step - grid_offset + block_size / 2 + street_width / 2
            self.ground_patches.append(
                GroundPatch('road', 0, sy, grid_length + street_width, street_width)
            )

        # Vertical streets (between cols)
        for i in range(grid_count - 1):
            sx = i * cell_step - grid_offset + block_size / 2 + street_width / 2
            self.ground_patches.append(
                GroundPatch('road', sx, 0, street_width, grid_length + street_width)
            )

        # --- 3. Cars along streets ---
        num_cars = random.randint(12, 18)
        for _ in range(num_cars):
            ctype = random.choice(['car', 'truck'])
            # Pick a random street
            if random.random() < 0.5:
                # Horizontal street
                si = random.randint(0, grid_count - 2)
                sy = si * cell_step - grid_offset + block_size / 2 + street_width / 2
                sx = random.uniform(grid_min, grid_max)
                car_angle = 0.0 + random.uniform(-0.15, 0.15)
                # Offset to one side of street
                sy += random.choice([-1, 1]) * random.uniform(1.5, 3.0)
            else:
                # Vertical street
                si = random.randint(0, grid_count - 2)
                sx = si * cell_step - grid_offset + block_size / 2 + street_width / 2
                sy = random.uniform(grid_min, grid_max)
                car_angle = math.pi / 2 + random.uniform(-0.15, 0.15)
                sx += random.choice([-1, 1]) * random.uniform(1.5, 3.0)

            if abs(sx) < SPAWN_CLEAR_RADIUS and abs(sy) < SPAWN_CLEAR_RADIUS:
                continue
            # Don't place cars inside existing obstacles (buildings, etc.)
            car_info = OBSTACLE_TYPES[ctype]
            car_radius = max(car_info['half_w'], car_info['half_d'])
            blocked = False
            for obs in self.obstacles:
                if obs.point_collides(sx, sy, car_radius):
                    blocked = True
                    break
            if blocked:
                continue
            self.obstacles.append(ObstacleState(ctype, sx, sy, car_angle))

        # --- 4. Crates near buildings within blocks ---
        num_crates = random.randint(15, 22)
        for _ in range(num_crates):
            if not all_buildings:
                break
            bldg = random.choice(all_buildings)
            binfo = OBSTACLE_TYPES[bldg['type']]
            offset_angle = random.uniform(0, math.pi * 2)
            dist = max(binfo['half_w'], binfo['half_d']) + random.uniform(2, 4)
            cx = bldg['x'] + math.cos(offset_angle) * dist
            cy = bldg['y'] + math.sin(offset_angle) * dist
            cx = max(-half + 3, min(half - 3, cx))
            cy = max(-half + 3, min(half - 3, cy))
            if abs(cx) < SPAWN_CLEAR_RADIUS and abs(cy) < SPAWN_CLEAR_RADIUS:
                continue
            # Don't place inside other obstacles
            blocked = False
            for obs in self.obstacles:
                if obs.point_collides(cx, cy, 1.5):
                    blocked = True
                    break
            if blocked:
                continue
            self.obstacles.append(ObstacleState('crate', cx, cy, random.uniform(0, math.pi * 2)))

        # --- 5. Barriers at some street intersections ---
        num_barriers = random.randint(6, 10)
        intersections = []
        for ri in range(grid_count - 1):
            for ci in range(grid_count - 1):
                ix = ci * cell_step - grid_offset + block_size / 2 + street_width / 2
                iy = ri * cell_step - grid_offset + block_size / 2 + street_width / 2
                intersections.append((ix, iy))
        random.shuffle(intersections)
        for bx, by in intersections[:num_barriers]:
            if abs(bx) < SPAWN_CLEAR_RADIUS and abs(by) < SPAWN_CLEAR_RADIUS:
                continue
            self.obstacles.append(ObstacleState('barrier', bx, by, random.uniform(0, math.pi)))

        # --- 6. Mud patches in the outer wilderness ring ---
        num_mud = random.randint(10, 15)
        for _ in range(num_mud):
            # Place outside the town grid
            for _attempt in range(20):
                mx = random.uniform(-half + 10, half - 10)
                my = random.uniform(-half + 10, half - 10)
                # Must be outside the grid area
                if abs(mx) > grid_max + 5 or abs(my) > grid_max + 5:
                    break
            else:
                continue
            mw = random.uniform(6, 14)
            md = random.uniform(6, 14)
            self.ground_patches.append(GroundPatch('mud', mx, my, mw, md, random.uniform(0, math.pi)))

    def _push_out_of_obstacles(self, x, y, radius):
        """Push a point out of all obstacles. Returns (new_x, new_y)."""
        for obs in self.obstacles:
            x, y, _ = obs.push_out(x, y, radius)
        return x, y

    def _generate_extraction_zones(self):
        """Generate 2 extraction zones far from center and far apart."""
        half = WORLD_SIZE / 2
        zones = []
        for _ in range(200):
            if len(zones) >= 2:
                break
            x = random.uniform(-half + 12, half - 12)
            y = random.uniform(-half + 12, half - 12)
            dist_from_center = math.sqrt(x * x + y * y)
            if dist_from_center < 50:
                continue
            # Check distance from other zones
            too_close = False
            for z in zones:
                dz = math.sqrt((x - z.x) ** 2 + (y - z.y) ** 2)
                if dz < 40:
                    too_close = True
                    break
            if too_close:
                continue
            # Check not overlapping obstacles
            blocked = False
            for obs in self.obstacles:
                if obs.point_collides(x, y, EXTRACTION_ZONE_RADIUS):
                    blocked = True
                    break
            if blocked:
                continue
            zones.append(ExtractionZone(x, y))
        self.extraction_zones = zones

    def _spawn_night_chests(self):
        """Spawn chests near buildings at start of each night."""
        buildings = [o for o in self.obstacles if o.obstacle_type.startswith('building')]
        if not buildings:
            return
        num_chests = self.night_spawner._get_chest_count()
        for _ in range(num_chests):
            building = random.choice(buildings)
            # Spawn near building edge
            offset_angle = random.uniform(0, math.pi * 2)
            dist = building.half_w + random.uniform(2, 5)
            cx = building.x + math.cos(offset_angle) * dist
            cy = building.y + math.sin(offset_angle) * dist
            half = WORLD_SIZE / 2
            cx = max(-half + 2, min(half - 2, cx))
            cy = max(-half + 2, min(half - 2, cy))
            # Don't place inside obstacles
            blocked = False
            for obs in self.obstacles:
                if obs.point_collides(cx, cy, 1.0):
                    blocked = True
                    break
            if blocked:
                continue
            self.chests.append(LootChest(cx, cy))

    def _find_nearest_interactable(self, player):
        """Find nearest interactable for player. Returns (type, id, duration) or None."""
        px, py = player.x, player.y

        # Check extraction zones
        for zone in self.extraction_zones:
            if zone.contains(px, py):
                return ('extraction_zone', zone.id, EXTRACTION_HOLD_DURATION)

        # Check chests
        best_chest = None
        best_dist = CHEST_INTERACT_RADIUS * CHEST_INTERACT_RADIUS
        for chest in self.chests:
            if chest.opened:
                continue
            dx = px - chest.x
            dy = py - chest.y
            d2 = dx * dx + dy * dy
            if d2 < best_dist:
                best_dist = d2
                best_chest = chest
        if best_chest:
            return ('chest', best_chest.id, best_chest.hold_duration)

        # Check lootable cars
        best_car = None
        best_dist = CAR_INTERACT_RADIUS * CAR_INTERACT_RADIUS
        for obs in self.obstacles:
            if not obs.lootable or obs.looted:
                continue
            dx = px - obs.x
            dy = py - obs.y
            d2 = dx * dx + dy * dy
            if d2 < best_dist:
                best_dist = d2
                best_car = obs
        if best_car:
            return ('car', best_car.id, best_car.car_loot_duration)

        return None

    def _give_loot(self, player, loot):
        """Apply loot dict to player. Returns list of events to emit."""
        events = []
        ltype = loot['type']
        if ltype == 'weapon_unlock':
            wid = loot['weapon_id']
            if wid not in player.unlocked_weapons:
                player.unlocked_weapons.add(wid)
                # Give starting ammo
                starting = WEAPONS[wid]['magazine'] * 2
                player.weapon_ammo_reserve[wid] = player.weapon_ammo_reserve.get(wid, 0) + starting
                events.append({
                    'type': 'weapon_unlock',
                    'pid': player.player_id,
                    'weapon': wid,
                })
            else:
                # Already unlocked, give ammo instead
                player.weapon_ammo_reserve[wid] = player.weapon_ammo_reserve.get(wid, 0) + WEAPONS[wid]['magazine']
                events.append({
                    'type': 'ammo_pickup',
                    'pid': player.player_id,
                    'weapon': wid,
                    'amount': WEAPONS[wid]['magazine'],
                })
        elif ltype == 'ammo':
            wid = loot['weapon_id']
            amount = loot['amount']
            player.weapon_ammo_reserve[wid] = player.weapon_ammo_reserve.get(wid, 0) + amount
            events.append({
                'type': 'ammo_pickup',
                'pid': player.player_id,
                'weapon': wid,
                'amount': amount,
            })
        elif ltype == 'health':
            amount = loot['amount']
            player.health = min(PLAYER_MAX_HEALTH, player.health + amount)
            events.append({
                'type': 'health_pickup',
                'pid': player.player_id,
                'amount': amount,
            })
        elif ltype == 'score':
            amount = loot['amount']
            player.score += amount
            events.append({
                'type': 'score_pickup',
                'pid': player.player_id,
                'amount': amount,
            })
        return events

    def _update_actions(self, dt):
        """Update hold-to-interact actions for all players."""
        for player in self.players.values():
            if not player.alive or player.extracted:
                continue

            if not player.action_holding:
                # Reset action progress
                if player.action_progress > 0:
                    player.action_progress = 0.0
                    player.action_target_id = None
                    player.action_target_type = None
                    player.action_duration = 0.0
                continue

            # Find nearest interactable
            result = self._find_nearest_interactable(player)
            if not result:
                # Keep extraction progress if player briefly leaves zone
                if player.action_target_type == 'extraction_zone':
                    continue
                player.action_progress = 0.0
                player.action_target_id = None
                player.action_target_type = None
                player.action_duration = 0.0
                continue

            target_type, target_id, duration = result

            # If target changed, reset progress (but not if returning to same extraction zone)
            if player.action_target_id != target_id or player.action_target_type != target_type:
                player.action_progress = 0.0
                player.action_target_id = target_id
                player.action_target_type = target_type
                player.action_duration = duration

            # Advance progress
            player.action_progress += dt

            # Completion
            if player.action_progress >= duration:
                player.action_progress = 0.0
                player.action_target_id = None
                player.action_target_type = None
                player.action_duration = 0.0
                player.action_holding = False

                if target_type == 'extraction_zone':
                    player.extracted = True
                    player.alive = False
                    self.events.append({
                        'type': 'extracted',
                        'pid': player.player_id,
                        'score': player.score,
                        'name': player.display_name,
                        'kills': player.zombie_kills,
                        'night': self.night_spawner.night,
                        'elapsed': round(time.time() - self.start_time, 1),
                        'accuracy': round(player.shots_hit / max(player.shots_fired, 1) * 100),
                    })
                elif target_type == 'chest':
                    for chest in self.chests:
                        if chest.id == target_id and not chest.opened:
                            chest.opened = True
                            loot_events = self._give_loot(player, chest.loot)
                            self.events.extend(loot_events)
                            self.events.append({
                                'type': 'chest_opened',
                                'pid': player.player_id,
                                'chestId': chest.id,
                                'loot': chest.loot['type'],
                            })
                            break
                elif target_type == 'car':
                    for obs in self.obstacles:
                        if obs.id == target_id and obs.lootable and not obs.looted:
                            obs.looted = True
                            loot_events = self._give_loot(player, obs.car_loot)
                            self.events.extend(loot_events)
                            self.events.append({
                                'type': 'car_looted',
                                'pid': player.player_id,
                                'obsId': obs.id,
                                'loot': obs.car_loot['type'],
                            })
                            # Refresh cached obstacles since loot state changed
                            self._static_state['obstacles'] = [o.to_dict() for o in self.obstacles]
                            break

    def _projectile_hits_obstacle(self, px, py):
        """Check if a projectile point is inside any obstacle."""
        for obs in self.obstacles:
            if obs.point_collides(px, py, 0.0):
                return obs
        return None

    def _get_surface_multiplier(self, px, py):
        """Return speed multiplier based on ground surface at position."""
        best = GRASS_SPEED  # default: grass
        for gp in self.ground_patches:
            # Transform point into patch local space
            dx = px - gp.x
            dy = py - gp.y
            cos_a = math.cos(-gp.angle)
            sin_a = math.sin(-gp.angle)
            lx = dx * cos_a - dy * sin_a
            ly = dx * sin_a + dy * cos_a
            if abs(lx) < gp.w / 2 and abs(ly) < gp.d / 2:
                mult = SURFACE_SPEED.get(gp.patch_type, GRASS_SPEED)
                if mult > best:
                    best = mult
        return best

    def tick(self, dt):
        self.events = []
        half = WORLD_SIZE / 2

        # Don't tick if game is over
        if self.game_over:
            return

        alive_players = [p for p in self.players.values() if p.alive]

        # --- Game over detection (permadeath) ---
        # Active = not extracted AND not eliminated
        active_players = [p for p in self.players.values() if not p.extracted and not p.eliminated]
        if not active_players and self.night_spawner.night > 0:
            self.game_over = True
            return

        # --- Update actions (hold-to-interact) ---
        self._update_actions(dt)

        # Update players
        for player in self.players.values():
            if not player.alive:
                continue  # Dead (extracted or eliminated) — skip

            # --- Stamina ---
            is_moving = player.vx != 0 or player.vy != 0
            if is_moving:
                if player.sprinting and player.stamina > 0:
                    player.stamina -= STAMINA_SPRINT_DRAIN * dt
                else:
                    player.stamina -= STAMINA_WALK_DRAIN * dt
                    player.sprinting = False  # can't sprint with no stamina
                player.stamina = max(0, player.stamina)
                player._stamina_regen_timer = STAMINA_REGEN_DELAY
            else:
                # Regen when standing still
                if player._stamina_regen_timer > 0:
                    player._stamina_regen_timer -= dt
                else:
                    player.stamina = min(MAX_STAMINA, player.stamina + STAMINA_REGEN * dt)

            # Exhaustion penalty
            if player.stamina > EXHAUSTION_THRESHOLD:
                exhaustion_mult = 1.0
            else:
                exhaustion_mult = EXHAUSTION_MIN_MULT + (player.stamina / EXHAUSTION_THRESHOLD) * (1.0 - EXHAUSTION_MIN_MULT)

            # Surface speed
            surface_mult = self._get_surface_multiplier(player.x, player.y)

            # Sprint multiplier
            sprint_mult = PLAYER_SPRINT_MULTIPLIER if player.sprinting and player.stamina > 0 else PLAYER_WALK_MULTIPLIER

            # Movement
            speed = PLAYER_SPEED * sprint_mult * exhaustion_mult * surface_mult
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
                    reserve = player.weapon_ammo_reserve.get(player.weapon_id, 0)
                    if reserve == -1:
                        # Infinite ammo (pistol)
                        player.ammo = player.mag_size
                    else:
                        need = player.mag_size - player.ammo
                        give = min(need, reserve)
                        player.ammo += give
                        player.weapon_ammo_reserve[player.weapon_id] = reserve - give

        # --- Night cycle spawning ---
        alive_zombie_count = sum(1 for z in self.zombies if z.alive)
        spawns, night_event = self.night_spawner.update(dt, alive_zombie_count, alive_players)
        for ztype, zx, zy, stat_mults in spawns:
            zombie = ZombieState(ztype, zx, zy, stat_mults=stat_mults)
            self.zombies.append(zombie)

        if night_event == 'night_start':
            self.events.append({
                'type': 'night_start',
                'night': self.night_spawner.night,
                'bloodMoon': self.night_spawner.is_blood_moon,
            })
            self._spawn_night_chests()
        elif night_event == 'dawn':
            self.events.append({
                'type': 'dawn',
                'night': self.night_spawner.night,
            })
            # Clear unopened chests at dawn
            self.chests = [c for c in self.chests if c.opened]
            # Kill all remaining zombies for dawn rest
            for zombie in self.zombies:
                if zombie.alive:
                    zombie.alive = False

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
                    nearest.eliminated = True
                    nearest.vx = 0
                    nearest.vy = 0
                    nearest.deaths += 1
                    self.events.append({
                        'type': 'kill',
                        'pid': nearest.player_id,
                        'by': 'zombie',
                    })
                    self.events.append({
                        'type': 'player_eliminated',
                        'pid': nearest.player_id,
                        'night': self.night_spawner.night,
                        'elapsed': round(time.time() - self.start_time, 1),
                        'name': nearest.display_name,
                        'score': 0,
                        'kills': nearest.zombie_kills,
                        'deaths': nearest.deaths,
                        'accuracy': round(nearest.shots_hit / max(nearest.shots_fired, 1) * 100),
                    })

        # --- Zombie separation (prevent stacking) ---
        alive_zombies = [z for z in self.zombies if z.alive]
        for i in range(len(alive_zombies)):
            zi = alive_zombies[i]
            for j in range(i + 1, len(alive_zombies)):
                zj = alive_zombies[j]
                dx = zj.x - zi.x
                dy = zj.y - zi.y
                dist_sq = dx * dx + dy * dy
                min_dist = (zi.size + zj.size) * ZOMBIE_SEPARATION_DIST
                min_dist_sq = min_dist * min_dist
                if dist_sq < min_dist_sq and dist_sq > 0.0001:
                    dist = math.sqrt(dist_sq)
                    overlap = (min_dist - dist) * 0.5
                    nx = dx / dist
                    ny = dy / dist
                    zi.x -= nx * overlap
                    zi.y -= ny * overlap
                    zj.x += nx * overlap
                    zj.y += ny * overlap
                elif dist_sq <= 0.0001:
                    angle = random.random() * math.pi * 2
                    nudge = min_dist * 0.5
                    zi.x -= math.cos(angle) * nudge
                    zi.y -= math.sin(angle) * nudge
                    zj.x += math.cos(angle) * nudge
                    zj.y += math.sin(angle) * nudge

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
                            if random.random() < 0.3:
                                # Health drop
                                self.items.append(ItemDrop('health', zombie.x, zombie.y))
                            else:
                                # Typed ammo drop
                                wid = random.choice(['pistol', 'rifle', 'uzi', 'shotgun'])
                                self.items.append(ItemDrop('ammo', zombie.x, zombie.y, weapon_id=wid))
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
                            player.eliminated = True
                            player.vx = 0
                            player.vy = 0
                            player.deaths += 1
                            self.events.append({
                                'type': 'kill',
                                'pid': player.player_id,
                                'by': proj.owner_id,
                            })
                            self.events.append({
                                'type': 'player_eliminated',
                                'pid': player.player_id,
                                'night': self.night_spawner.night,
                                'elapsed': round(time.time() - self.start_time, 1),
                                'name': player.display_name,
                                'score': 0,
                                'kills': player.zombie_kills,
                                'deaths': player.deaths,
                                'accuracy': round(player.shots_hit / max(player.shots_fired, 1) * 100),
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
                        wid = item.weapon_id or player.weapon_id
                        amount = idef['ammo']
                        reserve = player.weapon_ammo_reserve.get(wid, 0)
                        if reserve == -1:
                            # Pistol infinite — add to current mag
                            player.ammo = min(player.mag_size, player.ammo + amount)
                        else:
                            player.weapon_ammo_reserve[wid] = reserve + amount
                        picked = True
                    if picked:
                        player.score += 5
                        self.events.append({
                            'type': 'item_pickup',
                            'pid': player.player_id,
                            'item': item.item_type,
                            'weapon': item.weapon_id,
                            'amount': idef.get('ammo', idef.get('heal', 0)),
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
        state = {
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
            'chests': [c.to_dict() for c in self.chests if not c.opened],
            'night': self.night_spawner.night,
            'nightActive': self.night_spawner.night_active,
            'nightElapsed': round(self.night_spawner.night_elapsed, 1),
            'nightDuration': NIGHT_DURATION,
            'isDawn': not self.night_spawner.night_active and self.night_spawner.night > 0 and self.night_spawner._night_ended,
            'bloodMoon': self.night_spawner.is_blood_moon,
            'gameOver': self.game_over,
            'events': self.events,
        }
        # Merge cached static state (obstacles, ground, extractionZones)
        state.update(self._static_state)
        return state


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
