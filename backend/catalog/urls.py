from rest_framework.routers import DefaultRouter
from .views import InstructorViewSet, ClassTypeViewSet, ProductViewSet

router = DefaultRouter()
router.register('instructors', InstructorViewSet, basename='instructor')
router.register('class-types', ClassTypeViewSet, basename='class-type')
router.register('products', ProductViewSet, basename='product')

urlpatterns = router.urls
