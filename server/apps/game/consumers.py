import json
import asyncio
import time
from channels.generic.websocket import AsyncWebsocketConsumer
from .state import game_manager, TICK_INTERVAL


class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.group_name = f'game_{self.room_code}'
        self.player_id = None
        self._tick_task = None

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if self.player_id:
            room = game_manager.rooms.get(self.room_code)
            if room:
                room.remove_player(self.player_id)
                # Notify others
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'player_left',
                        'player_id': self.player_id,
                    }
                )
                # Remove room if empty
                if not room.players:
                    game_manager.remove_room(self.room_code)
                    if self._tick_task:
                        self._tick_task.cancel()

        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type')

        if msg_type == 'join':
            await self._handle_join(data)
        elif msg_type == 'player_move':
            await self._handle_move(data)
        elif msg_type == 'player_shoot':
            self._handle_shoot(data)
        elif msg_type == 'player_reload':
            self._handle_reload()
        elif msg_type == 'player_switch_weapon':
            self._handle_switch_weapon(data)

    async def _handle_join(self, data):
        display_name = data.get('name', 'Player')
        room = game_manager.get_or_create_room(self.room_code)

        # Generate a player ID from channel name
        self.player_id = self.channel_name[-8:]
        player_state = room.add_player(self.player_id, display_name)

        # Send join confirmation with player's own ID
        await self.send(text_data=json.dumps({
            'type': 'joined',
            'player_id': self.player_id,
            'x': player_state.x,
            'y': player_state.y,
        }))

        # Notify group
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'player_joined',
                'player_id': self.player_id,
                'name': display_name,
            }
        )

        # Start tick loop if this is the first player
        if len(room.players) == 1:
            self._tick_task = asyncio.ensure_future(self._tick_loop())

    async def _handle_move(self, data):
        room = game_manager.rooms.get(self.room_code)
        if room and self.player_id:
            room.process_input(
                self.player_id,
                float(data.get('mx', 0)),
                float(data.get('my', 0)),
                float(data.get('angle', 0)),
                sprinting=data.get('sprint', False),
            )

    def _handle_shoot(self, data):
        room = game_manager.rooms.get(self.room_code)
        if room and self.player_id:
            angle = data.get('angle')
            if angle is not None:
                # Update player angle immediately so projectile uses correct direction
                player = room.players.get(self.player_id)
                if player:
                    player.angle = float(angle)
            room.process_shoot(self.player_id)

    def _handle_reload(self):
        room = game_manager.rooms.get(self.room_code)
        if room and self.player_id:
            room.process_reload(self.player_id)

    def _handle_switch_weapon(self, data):
        room = game_manager.rooms.get(self.room_code)
        if room and self.player_id:
            room.process_switch_weapon(self.player_id, data.get('weapon'))

    async def _tick_loop(self):
        """Server-authoritative game loop running at TICK_RATE Hz."""
        try:
            last_time = time.time()
            while True:
                await asyncio.sleep(TICK_INTERVAL)
                now = time.time()
                dt = now - last_time
                last_time = now

                room = game_manager.rooms.get(self.room_code)
                if not room or not room.players:
                    break

                room.tick(dt)

                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'game_state',
                        'state': room.get_state(),
                        'tick_time': now,
                    }
                )
        except asyncio.CancelledError:
            pass

    # Channel layer message handlers
    async def game_state(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_state',
            'state': event['state'],
            't': event['tick_time'],
        }))

    async def player_joined(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player_joined',
            'player_id': event['player_id'],
            'name': event['name'],
        }))

    async def player_left(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player_left',
            'player_id': event['player_id'],
        }))
