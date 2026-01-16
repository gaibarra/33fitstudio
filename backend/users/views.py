from rest_framework import generics, permissions
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.response import Response
from notifications.tasks import send_onboarding_email
from .serializers import RegisterSerializer, UserSerializer, LoginSerializer
from .models import User
from django.db import transaction

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def perform_create(self, serializer):
        user = serializer.save()
        send_onboarding_email.delay(str(user.id))

class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class TokenView(TokenObtainPairView):
    pass

class TokenRefresh(TokenRefreshView):
    pass
