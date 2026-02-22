"""
Zombie AI and night-cycle spawning system.
All zombie state is managed server-side and broadcast to clients via game_state.
"""
import math
import random

# Zombie type definitions
ZOMBIE_TYPES = {
    'walker': {
        'health': 60,
        'speed': 3.5,
        'damage': 10,
        'attack_cooldown': 1.0,
        'size': 0.6,       # collision radius
        'xp': 10,
    },
    'runner': {
        'health': 40,
        'speed': 7.0,
        'damage': 8,
        'attack_cooldown': 0.8,
        'size': 0.5,
        'xp': 15,
    },
    'tank': {
        'health': 200,
        'speed': 2.0,
        'damage': 25,
        'attack_cooldown': 1.5,
        'size': 0.9,
        'xp': 30,
    },
}

# Night cycle constants
NIGHT_DURATION = 720.0    # 12 minutes per night
DAWN_DURATION = 45.0      # 45 second dawn break
INITIAL_DELAY = 5.0       # seconds before Night 1
BLOOD_MOON_INTERVAL = 5   # every 5th night


class ZombieState:
    __slots__ = (
        'id', 'zombie_type', 'x', 'y', 'angle',
        'health', 'max_health', 'speed', 'damage',
        'attack_cooldown', 'attack_timer', 'size',
        'alive', 'xp',
    )

    _next_id = 0

    def __init__(self, zombie_type, x, y, stat_mults=None):
        ZombieState._next_id += 1
        self.id = ZombieState._next_id
        self.zombie_type = zombie_type
        self.x = x
        self.y = y
        self.angle = 0.0

        ztype = ZOMBIE_TYPES[zombie_type]
        hp_mult = 1.0
        spd_mult = 1.0
        dmg_mult = 1.0
        if stat_mults:
            hp_mult = stat_mults.get('hp', 1.0)
            spd_mult = stat_mults.get('speed', 1.0)
            dmg_mult = stat_mults.get('damage', 1.0)

        self.health = round(ztype['health'] * hp_mult)
        self.max_health = self.health
        self.speed = ztype['speed'] * spd_mult
        self.damage = round(ztype['damage'] * dmg_mult)
        self.attack_cooldown = ztype['attack_cooldown']
        self.attack_timer = 0.0
        self.size = ztype['size']
        self.alive = True
        self.xp = ztype['xp']

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.zombie_type,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
            'angle': round(self.angle, 3),
            'hp': self.health,
            'maxHp': self.max_health,
            'alive': self.alive,
        }


class NightCycleSpawner:
    """Manages continuous night-cycle zombie spawning with escalating difficulty."""

    def __init__(self, world_size):
        self.world_size = world_size
        self.night = 0
        self.night_active = False
        self.night_elapsed = 0.0
        self.dawn_timer = 0.0
        self.spawn_timer = 0.0
        self.is_blood_moon = False
        self.total_spawned_this_night = 0
        self._initial_timer = INITIAL_DELAY
        self._started = False  # True after first night begins
        self._night_ended = False  # True during dawn

    def _get_base_interval(self):
        return max(0.25, 2.0 - (self.night - 1) * 0.06)

    def _get_effective_interval(self):
        base = self._get_base_interval()
        # Within-night acceleration: shrinks by 30% from start to end
        progress = min(self.night_elapsed / NIGHT_DURATION, 1.0)
        accel = 1.0 - 0.3 * progress
        interval = base * accel
        # Blood moon: 40% faster spawns
        if self.is_blood_moon:
            interval *= 0.6
        return max(0.15, interval)

    def _get_max_alive(self):
        base = 15 + self.night * 3
        if self.is_blood_moon:
            base += 15
        return min(base, 80)

    def _get_type_weights(self):
        n = self.night
        if n <= 2:
            return [('walker', 1.0)]
        elif n <= 4:
            return [('walker', 0.7), ('runner', 0.3)]
        elif n <= 7:
            return [('walker', 0.55), ('runner', 0.35), ('tank', 0.10)]
        elif n <= 12:
            return [('walker', 0.40), ('runner', 0.35), ('tank', 0.25)]
        elif n <= 20:
            return [('walker', 0.30), ('runner', 0.40), ('tank', 0.30)]
        else:
            return [('walker', 0.25), ('runner', 0.40), ('tank', 0.35)]

    def _get_stat_multipliers(self):
        n = self.night
        hp = 1.0 if n <= 10 else 1.0 + (n - 10) * 0.05
        dmg = 1.0 if n <= 15 else 1.0 + (n - 15) * 0.03
        spd = 1.0 if n <= 20 else 1.0 + (n - 20) * 0.02
        return {'hp': hp, 'damage': dmg, 'speed': spd}

    def _get_chest_count(self):
        count = min(4 + self.night // 3, 10)
        if self.is_blood_moon:
            count += 2
        return count

    def pick_zombie_type(self, weights):
        r = random.random()
        cumulative = 0.0
        for ztype, w in weights:
            cumulative += w
            if r <= cumulative:
                return ztype
        return weights[-1][0]

    def get_spawn_position(self, players):
        """Spawn at the edge of the world, biased toward players."""
        half = self.world_size / 2
        edge = random.choice(['top', 'bottom', 'left', 'right'])

        if edge == 'top':
            x = random.uniform(-half, half)
            y = half - 1
        elif edge == 'bottom':
            x = random.uniform(-half, half)
            y = -half + 1
        elif edge == 'left':
            x = -half + 1
            y = random.uniform(-half, half)
        else:
            x = half - 1
            y = random.uniform(-half, half)

        return x, y

    def update(self, dt, alive_zombie_count, alive_players):
        """Returns (spawns_list, event_string_or_none).
        spawns_list entries: (ztype, x, y, stat_mults)
        event: 'night_start', 'dawn', or None
        """
        spawns = []
        event = None

        # --- Initial delay before first night ---
        if not self._started:
            self._initial_timer -= dt
            if self._initial_timer <= 0 and alive_players:
                self._start_night()
                event = 'night_start'
            return spawns, event

        # --- Dawn state ---
        if self._night_ended:
            self.dawn_timer -= dt
            if self.dawn_timer <= 0:
                self._start_night()
                event = 'night_start'
            return spawns, event

        # --- Night active: spawn zombies ---
        if self.night_active:
            self.night_elapsed += dt
            self.spawn_timer -= dt

            max_alive = self._get_max_alive()
            weights = self._get_type_weights()
            stat_mults = self._get_stat_multipliers()

            # Spawn loop: allow multiple spawns per tick at fast rates
            while self.spawn_timer <= 0 and alive_zombie_count < max_alive and alive_players:
                ztype = self.pick_zombie_type(weights)
                x, y = self.get_spawn_position(alive_players)
                spawns.append((ztype, x, y, stat_mults))
                self.total_spawned_this_night += 1
                alive_zombie_count += 1
                self.spawn_timer += self._get_effective_interval()

            # End night after duration
            if self.night_elapsed >= NIGHT_DURATION:
                self.night_active = False
                self._night_ended = True
                self.dawn_timer = DAWN_DURATION
                event = 'dawn'

        return spawns, event

    def _start_night(self):
        self.night += 1
        self.night_active = True
        self._night_ended = False
        self._started = True
        self.night_elapsed = 0.0
        self.total_spawned_this_night = 0
        self.is_blood_moon = (self.night % BLOOD_MOON_INTERVAL == 0)
        self.spawn_timer = 0.0
