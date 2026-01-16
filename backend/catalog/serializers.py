from rest_framework import serializers
from .models import Instructor, ClassType, Product

class InstructorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Instructor
        fields = ['id', 'studio', 'full_name', 'bio', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at', 'studio']

class ClassTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassType
        fields = ['id', 'studio', 'name', 'description', 'duration_minutes', 'created_at']
        read_only_fields = ['id', 'created_at', 'studio']

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'studio', 'type', 'name', 'description', 'price_cents', 'currency', 'is_active', 'meta', 'created_at']
        read_only_fields = ['id', 'created_at', 'studio']
