from django.urls import path
from rest_framework_simplejwt.views import TokenVerifyView
from .views import RegisterView, MeView, TokenView, TokenRefresh

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('token/', TokenView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefresh.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('me/', MeView.as_view(), name='me'),
]
