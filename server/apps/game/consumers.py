import json
import asyncio
import time
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.db import models
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
        elif msg_type == 'player_action':
            self._handle_action(data)

    async def _handle_join(self, data):
        display_name = data.get('name', 'Player')
        room = game_manager.get_or_create_room(self.room_code)

        # Generate a player ID from channel name
        self.player_id = self.channel_name[-8:]
        player_state = room.add_player(self.player_id, display_name)

        # Bridge authenticated user identity
        user = self.scope.get('user')
        if user and user.is_authenticated:
            player_state.user_id = user.id

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
            # Accept piggybacked action state for reliability
            if 'holding' in data:
                room.process_action_hold(self.player_id, data['holding'])

    def _handle_shoot(self, data):
        room = game_manager.rooms.get(self.room_code)
        if room and self.player_id:
            angle = data.get('angle')
            if angle is not None:
                # Update player angle immediately so projectile uses correct direction
                player = room.players.get(self.player_id)
                if player:
                    player.angle = float(angle)
            aim_time = max(0.0, float(data.get('aimTime', 0)))
            room.process_shoot(self.player_id, aim_time)

    def _handle_reload(self):
        room = game_manager.rooms.get(self.room_code)
        if room and self.player_id:
            room.process_reload(self.player_id)

    def _handle_switch_weapon(self, data):
        room = game_manager.rooms.get(self.room_code)
        if room and self.player_id:
            room.process_switch_weapon(self.player_id, data.get('weapon'))

    def _handle_action(self, data):
        room = game_manager.rooms.get(self.room_code)
        if room and self.player_id:
            room.process_action_hold(self.player_id, data.get('holding', False))

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

                # Save leaderboard entries for extracted players
                for event in room.events:
                    if event.get('type') == 'extracted':
                        await self._save_extraction(room, event['pid'])

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

    async def _save_extraction(self, room, player_id):
        """Save a leaderboard entry for an extracted player."""
        player = room.players.get(player_id)
        if not player or not player.extracted or player._leaderboard_saved:
            return
        if player.score <= 0:
            return

        player._leaderboard_saved = True
        survival_time = round(time.time() - room.start_time, 1)
        accuracy = round(player.shots_hit / max(player.shots_fired, 1) * 100)
        night = room.night_spawner.night

        await self._create_leaderboard_entry(
            user_id=player.user_id,
            display_name=player.display_name,
            score=player.score,
            zombie_kills=player.zombie_kills,
            night_survived=night,
            survival_time=survival_time,
            accuracy=accuracy,
        )

    @database_sync_to_async
    def _create_leaderboard_entry(self, user_id, display_name, score,
                                   zombie_kills, night_survived, survival_time, accuracy):
        from .models import LeaderboardEntry
        from apps.accounts.models import PlayerProfile

        LeaderboardEntry.objects.create(
            user_id=user_id,
            display_name=display_name,
            score=score,
            zombie_kills=zombie_kills,
            night_survived=night_survived,
            survival_time=survival_time,
            accuracy=accuracy,
        )

        # Update PlayerProfile stats if authenticated
        if user_id:
            PlayerProfile.objects.filter(user_id=user_id).update(
                games_played=models.F('games_played') + 1,
                total_kills=models.F('total_kills') + zombie_kills,
            )

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
