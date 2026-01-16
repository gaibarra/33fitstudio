from rest_framework import viewsets, permissions
from .models import NotificationTemplate, WebhookEndpoint
from .serializers import NotificationTemplateSerializer, WebhookEndpointSerializer

class StudioScopedMixin:
    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return self.model.objects.none()
        return self.model.objects.filter(studio=studio)

    def perform_create(self, serializer):
        serializer.save(studio=self.request.studio)

class NotificationTemplateViewSet(StudioScopedMixin, viewsets.ModelViewSet):
    serializer_class = NotificationTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    model = NotificationTemplate

class WebhookEndpointViewSet(StudioScopedMixin, viewsets.ModelViewSet):
    serializer_class = WebhookEndpointSerializer
    permission_classes = [permissions.IsAuthenticated]
    model = WebhookEndpoint
