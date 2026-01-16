from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/auth/', include('users.auth_urls')),
    path('api/studios/', include('studios.urls')),
    path('api/catalog/', include('catalog.urls')),
    path('api/scheduling/', include('scheduling.urls')),
    path('api/commerce/', include('commerce.urls')),
    path('api/tracking/', include('tracking.urls')),
    path('api/notifications/', include('notifications.urls')),
]
