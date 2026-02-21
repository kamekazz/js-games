from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health-check'),
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login_view, name='login'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/me/', views.me, name='me'),
]
