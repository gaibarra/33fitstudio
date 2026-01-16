from rest_framework.routers import DefaultRouter
from .views import SessionViewSet, BookingViewSet, WaitlistEntryViewSet, CheckinViewSet

router = DefaultRouter()
router.register('sessions', SessionViewSet, basename='session')
router.register('bookings', BookingViewSet, basename='booking')
router.register('waitlist', WaitlistEntryViewSet, basename='waitlist')
router.register('checkins', CheckinViewSet, basename='checkin')

urlpatterns = router.urls
