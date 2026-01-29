from rest_framework import generics, permissions, viewsets, filters, status
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.response import Response
from rest_framework.decorators import action
from notifications.tasks import send_onboarding_email
from .serializers import RegisterSerializer, UserSerializer, LoginSerializer
from .models import User, Role
from .permissions import IsAdmin, IsStaff
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


class UserViewSet(viewsets.ModelViewSet):
    """Admin/Staff endpoint to manage studio users"""
    serializer_class = UserSerializer
    permission_classes = [IsStaff | IsAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['email', 'full_name', 'phone']
    ordering_fields = ['email', 'full_name', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return User.objects.none()
        qs = User.objects.filter(studio=studio).prefetch_related('user_roles__role')
        
        # Filter by role
        role_filter = self.request.query_params.get('role')
        if role_filter:
            qs = qs.filter(user_roles__role__code=role_filter)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        
        return qs.distinct()

    def perform_create(self, serializer):
        serializer.save(studio=self.request.studio)

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle user active status"""
        user = self.get_object()
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        return Response({
            'detail': f'Usuario {"activado" if user.is_active else "desactivado"}',
            'is_active': user.is_active
        })

    @action(detail=True, methods=['post'])
    def add_role(self, request, pk=None):
        """Add a role to user"""
        user = self.get_object()
        role_code = request.data.get('role')
        if not role_code:
            return Response({'detail': 'role requerido'}, status=status.HTTP_400_BAD_REQUEST)
        user.add_role(role_code)
        return Response({'detail': f'Rol {role_code} agregado', 'roles': list(user.roles.values_list('code', flat=True))})

    @action(detail=True, methods=['post'])
    def remove_role(self, request, pk=None):
        """Remove a role from user"""
        user = self.get_object()
        role_code = request.data.get('role')
        if not role_code:
            return Response({'detail': 'role requerido'}, status=status.HTTP_400_BAD_REQUEST)
        from .models import UserRole
        deleted, _ = UserRole.objects.filter(user=user, role__code=role_code).delete()
        if deleted:
            return Response({'detail': f'Rol {role_code} removido', 'roles': list(user.roles.values_list('code', flat=True))})
        return Response({'detail': 'Rol no encontrado'}, status=status.HTTP_404_NOT_FOUND)
