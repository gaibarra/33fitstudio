from rest_framework import viewsets, permissions
from .models import TrackingEvent
from .serializers import TrackingEventSerializer

class TrackingEventViewSet(viewsets.ModelViewSet):
    serializer_class = TrackingEventSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return TrackingEvent.objects.none()
        qs = TrackingEvent.objects.filter(studio=studio)
        if not (self.request.user and self.request.user.is_authenticated and (self.request.user.has_role('staff') or self.request.user.has_role('admin'))):
            qs = qs.filter(user=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(studio=self.request.studio, user=self.request.user if self.request.user.is_authenticated else None)
