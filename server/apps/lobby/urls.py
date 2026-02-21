from django.urls import path
from . import views

urlpatterns = [
    path('rooms/', views.room_list, name='room-list'),
    path('rooms/create/', views.room_create, name='room-create'),
    path('rooms/<str:code>/', views.room_detail, name='room-detail'),
]
