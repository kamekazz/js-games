from django.contrib.auth.models import User
from rest_framework import serializers
from .models import PlayerProfile


class PlayerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerProfile
        fields = ['id', 'display_name', 'games_played', 'total_kills', 'created_at']
        read_only_fields = ['id', 'games_played', 'total_kills', 'created_at']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=30)
    password = serializers.CharField(min_length=4, write_only=True)
    display_name = serializers.CharField(min_length=2, max_length=30)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already taken.')
        return value

    def validate_display_name(self, value):
        if PlayerProfile.objects.filter(display_name=value).exists():
            raise serializers.ValidationError('Display name already taken.')
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
        )
        PlayerProfile.objects.create(
            user=user,
            display_name=validated_data['display_name'],
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    display_name = serializers.SerializerMethodField()
    games_played = serializers.SerializerMethodField()
    total_kills = serializers.SerializerMethodField()

    def get_display_name(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.display_name if profile else obj.username

    def get_games_played(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.games_played if profile else 0

    def get_total_kills(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.total_kills if profile else 0
