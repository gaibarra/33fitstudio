from rest_framework import viewsets, permissions, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Studio, Location, LinkButton
from .serializers import StudioSerializer, LocationSerializer, LinkButtonSerializer

class StudioViewSet(viewsets.ModelViewSet):
    queryset = Studio.objects.all()
    serializer_class = StudioSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

class LocationViewSet(viewsets.ModelViewSet):
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return Location.objects.none()
        return Location.objects.filter(studio=studio)

    def perform_create(self, serializer):
        serializer.save(studio=self.request.studio)

class LinkButtonViewSet(viewsets.ModelViewSet):
    serializer_class = LinkButtonSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['position']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'public']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return LinkButton.objects.none()
        return LinkButton.objects.filter(studio=studio)

    def perform_create(self, serializer):
        serializer.save(studio=self.request.studio)

    @action(detail=False, methods=['get'], url_path='public')
    def public(self, request):
        studio_id = request.GET.get('studio_id')
        if not studio_id:
            return Response({'detail': 'studio_id requerido'}, status=400)
        buttons = LinkButton.objects.filter(studio_id=studio_id, is_active=True).order_by('position')
        data = LinkButtonSerializer(buttons, many=True).data
        return Response(data)
