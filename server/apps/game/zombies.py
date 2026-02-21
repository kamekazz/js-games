"""
Zombie AI and wave spawning system.
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


class ZombieState:
    __slots__ = (
        'id', 'zombie_type', 'x', 'y', 'angle',
        'health', 'max_health', 'speed', 'damage',
        'attack_cooldown', 'attack_timer', 'size',
        'alive', 'xp',
    )

    _next_id = 0

    def __init__(self, zombie_type, x, y):
        ZombieState._next_id += 1
        self.id = ZombieState._next_id
        self.zombie_type = zombie_type
        self.x = x
        self.y = y
        self.angle = 0.0

        ztype = ZOMBIE_TYPES[zombie_type]
        self.health = ztype['health']
        self.max_health = ztype['health']
        self.speed = ztype['speed']
        self.damage = ztype['damage']
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


class WaveSpawner:
    """Manages wave-based zombie spawning."""

    def __init__(self, world_size):
        self.world_size = world_size
        self.wave = 0
        self.zombies_to_spawn = 0
        self.spawn_timer = 0.0
        self.spawn_interval = 0.8   # seconds between spawns
        self.wave_delay = 5.0       # seconds between waves
        self.wave_timer = 3.0       # initial delay before first wave
        self.wave_active = False
        self.total_spawned = 0
        self.max_alive = 30         # cap on concurrent zombies

    def get_wave_config(self, wave_num):
        """Returns (total_zombies, zombie_type_weights) for a wave."""
        base_count = 5 + wave_num * 3
        total = min(base_count, 50)

        # Progressively introduce tougher types
        if wave_num <= 2:
            weights = [('walker', 1.0)]
        elif wave_num <= 5:
            weights = [('walker', 0.7), ('runner', 0.3)]
        elif wave_num <= 8:
            weights = [('walker', 0.5), ('runner', 0.35), ('tank', 0.15)]
        else:
            weights = [('walker', 0.4), ('runner', 0.35), ('tank', 0.25)]

        return total, weights

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
        """Returns list of (zombie_type, x, y) to spawn this tick."""
        spawns = []

        if not self.wave_active:
            self.wave_timer -= dt
            if self.wave_timer <= 0 and alive_players:
                # Start new wave
                self.wave += 1
                total, self._wave_weights = self.get_wave_config(self.wave)
                self.zombies_to_spawn = total
                self.total_spawned = 0
                self.wave_active = True
                self.spawn_timer = 0.0
                # Speed up spawning in later waves
                self.spawn_interval = max(0.3, 0.8 - self.wave * 0.05)
            return spawns

        if self.zombies_to_spawn <= 0:
            # Wave complete when all spawned zombies are dead
            if alive_zombie_count == 0:
                self.wave_active = False
                self.wave_timer = self.wave_delay
            return spawns

        # Spawn zombies at intervals
        self.spawn_timer -= dt
        if self.spawn_timer <= 0 and alive_zombie_count < self.max_alive:
            ztype = self.pick_zombie_type(self._wave_weights)
            x, y = self.get_spawn_position(alive_players)
            spawns.append((ztype, x, y))
            self.zombies_to_spawn -= 1
            self.total_spawned += 1
            self.spawn_timer = self.spawn_interval

        return spawns
