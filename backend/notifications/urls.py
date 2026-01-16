from rest_framework.routers import DefaultRouter
from .views import NotificationTemplateViewSet, WebhookEndpointViewSet

router = DefaultRouter()
router.register('templates', NotificationTemplateViewSet, basename='notification-template')
router.register('webhooks', WebhookEndpointViewSet, basename='webhook-endpoint')

urlpatterns = router.urls
