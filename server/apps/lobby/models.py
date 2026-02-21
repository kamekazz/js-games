import uuid
from django.db import models


class Room(models.Model):
    class Status(models.TextChoices):
        WAITING = 'waiting', 'Waiting'
        PLAYING = 'playing', 'Playing'
        FINISHED = 'finished', 'Finished'

    code = models.CharField(max_length=8, unique=True, default='')
    name = models.CharField(max_length=50)
    max_players = models.PositiveSmallIntegerField(default=4)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.WAITING)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = uuid.uuid4().hex[:8].upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.code})'
