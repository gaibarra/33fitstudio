from rest_framework.routers import DefaultRouter
from .views import StudioViewSet, LocationViewSet, LinkButtonViewSet

router = DefaultRouter()
router.register('studio', StudioViewSet, basename='studio')
router.register('location', LocationViewSet, basename='location')
router.register('linkbutton', LinkButtonViewSet, basename='linkbutton')

urlpatterns = router.urls
