from django.conf import settings
from django.db import models


class PlayerProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    display_name = models.CharField(max_length=30, unique=True)
    games_played = models.PositiveIntegerField(default=0)
    total_kills = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.display_name
