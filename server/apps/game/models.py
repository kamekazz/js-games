from django.conf import settings
from django.db import models


class LeaderboardEntry(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leaderboard_entries',
    )
    display_name = models.CharField(max_length=30)
    score = models.PositiveIntegerField()
    zombie_kills = models.PositiveIntegerField(default=0)
    night_survived = models.PositiveIntegerField(default=0)
    survival_time = models.FloatField(default=0.0)
    accuracy = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-score']
        indexes = [
            models.Index(fields=['-score']),
        ]

    def __str__(self):
        return f'{self.display_name} - {self.score}'
