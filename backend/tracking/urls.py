from rest_framework.routers import DefaultRouter
from .views import TrackingEventViewSet

router = DefaultRouter()
router.register('events', TrackingEventViewSet, basename='tracking-event')
urlpatterns = router.urls
