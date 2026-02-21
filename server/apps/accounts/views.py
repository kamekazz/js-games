from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def health_check(request):
    return Response({'status': 'ok'})


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        login(request, user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(
        request,
        username=serializer.validated_data['username'],
        password=serializer.validated_data['password'],
    )
    if user is None:
        return Response(
            {'error': 'Invalid username or password.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    login(request, user)
    return Response(UserSerializer(user).data)


@api_view(['POST'])
def logout_view(request):
    logout(request)
    return Response({'status': 'ok'})


@api_view(['GET'])
def me(request):
    if not request.user.is_authenticated:
        return Response({'authenticated': False}, status=status.HTTP_401_UNAUTHORIZED)
    return Response({
        'authenticated': True,
        **UserSerializer(request.user).data,
    })
