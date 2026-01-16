from studios.models import Studio
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse

class StudioMiddleware(MiddlewareMixin):
    def process_request(self, request):
        studio_id = request.headers.get('X-Studio-Id') or request.GET.get('studio_id')
        if not studio_id:
            request.studio = None
            return None
        try:
            request.studio = Studio.objects.get(id=studio_id)
        except Studio.DoesNotExist:
            return JsonResponse({'detail': 'Studio no encontrado'}, status=400)
        return None
