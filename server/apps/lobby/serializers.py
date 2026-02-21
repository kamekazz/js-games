from rest_framework import serializers
from .models import Room


class RoomSerializer(serializers.ModelSerializer):
    player_count = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ['id', 'code', 'name', 'max_players', 'status', 'player_count', 'created_at']
        read_only_fields = ['id', 'code', 'status', 'created_at']

    def get_player_count(self, obj):
        # Will be populated from in-memory game state
        from apps.game.state import game_manager
        return game_manager.get_player_count(obj.code)
