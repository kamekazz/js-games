from rest_framework import serializers
from .models import LeaderboardEntry


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaderboardEntry
        fields = [
            'id', 'display_name', 'score', 'zombie_kills',
            'night_survived', 'survival_time', 'accuracy', 'created_at',
        ]
