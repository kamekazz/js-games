"""
In-memory game state manager. Holds all active game rooms and player states.
This runs in the same process as Django Channels (Daphne/ASGI).
"""
import time
import math

PLAYER_SPEED = 12
WORLD_SIZE = 100
TICK_RATE = 20
TICK_INTERVAL = 1.0 / TICK_RATE


class PlayerState:
    __slots__ = ('player_id', 'display_name', 'x', 'y', 'angle', 'vx', 'vy')

    def __init__(self, player_id, display_name='Player'):
        self.player_id = player_id
        self.display_name = display_name
        self.x = 0.0
        self.y = 0.0
        self.angle = 0.0
        self.vx = 0.0
        self.vy = 0.0

    def to_dict(self):
        return {
            'id': self.player_id,
            'name': self.display_name,
            'x': round(self.x, 2),
            'y': round(self.y, 2),
            'angle': round(self.angle, 3),
        }


class GameRoom:
    def __init__(self, room_code):
        self.room_code = room_code
        self.players = {}  # player_id -> PlayerState
        self.last_tick = time.time()

    def add_player(self, player_id, display_name='Player'):
        state = PlayerState(player_id, display_name)
        # Spawn at random offset from center
        import random
        state.x = random.uniform(-5, 5)
        state.y = random.uniform(-5, 5)
        self.players[player_id] = state
        return state

    def remove_player(self, player_id):
        self.players.pop(player_id, None)

    def process_input(self, player_id, move_x, move_y, angle):
        player = self.players.get(player_id)
        if not player:
            return

        # Normalize input
        length = math.sqrt(move_x * move_x + move_y * move_y)
        if length > 1.0:
            move_x /= length
            move_y /= length

        player.vx = move_x
        player.vy = move_y
        player.angle = angle

    def tick(self, dt):
        half = WORLD_SIZE / 2
        for player in self.players.values():
            player.x += player.vx * PLAYER_SPEED * dt
            player.y += player.vy * PLAYER_SPEED * dt
            player.x = max(-half, min(half, player.x))
            player.y = max(-half, min(half, player.y))

    def get_state(self):
        return {
            'players': [p.to_dict() for p in self.players.values()],
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
