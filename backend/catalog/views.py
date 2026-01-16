from rest_framework import viewsets, permissions, filters, status
from rest_framework.response import Response
from .models import Instructor, ClassType, Product
from .serializers import InstructorSerializer, ClassTypeSerializer, ProductSerializer

class StudioScopedMixin:
    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return self.model.objects.none()
        return self.model.objects.filter(studio=studio)

    def perform_create(self, serializer):
        serializer.save(studio=self.request.studio)

class InstructorViewSet(StudioScopedMixin, viewsets.ModelViewSet):
    serializer_class = InstructorSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['full_name']
    model = Instructor

class ClassTypeViewSet(StudioScopedMixin, viewsets.ModelViewSet):
    serializer_class = ClassTypeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']
    model = ClassType

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.sessions.exists():
            return Response({'detail': 'No se puede eliminar: hay sesiones asociadas a esta clase.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

class ProductViewSet(StudioScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'type']
    ordering_fields = ['price_cents', 'created_at']
    model = Product
