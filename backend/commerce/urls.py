from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, UserCreditViewSet, UserMembershipViewSet, mp_webhook

router = DefaultRouter()
router.register('orders', OrderViewSet, basename='order')
router.register('credits', UserCreditViewSet, basename='credit')
router.register('memberships', UserMembershipViewSet, basename='membership')

urlpatterns = router.urls

urlpatterns += [
	path('mp/webhook/', mp_webhook, name='mp-webhook'),
]
