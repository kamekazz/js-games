from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from .models import LeaderboardEntry
from .serializers import LeaderboardEntrySerializer


class LeaderboardView(ListAPIView):
    serializer_class = LeaderboardEntrySerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return LeaderboardEntry.objects.order_by('-score')[:50]
