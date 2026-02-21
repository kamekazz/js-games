from django.contrib import admin
from .models import PlayerProfile


@admin.register(PlayerProfile)
class PlayerProfileAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'games_played', 'total_kills', 'created_at']
    search_fields = ['display_name']
