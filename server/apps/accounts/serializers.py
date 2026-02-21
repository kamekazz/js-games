from rest_framework import serializers
from .models import PlayerProfile


class PlayerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerProfile
        fields = ['id', 'display_name', 'games_played', 'total_kills', 'created_at']
        read_only_fields = ['id', 'games_played', 'total_kills', 'created_at']
