from rest_framework import serializers
from .models import Studio, Location, LinkButton

class StudioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Studio
        fields = ['id', 'name', 'brand_json', 'created_at']
        read_only_fields = ['id', 'created_at']

class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ['id', 'studio', 'name', 'address', 'tz', 'created_at']
        read_only_fields = ['id', 'created_at', 'studio']

class LinkButtonSerializer(serializers.ModelSerializer):
    class Meta:
        model = LinkButton
        fields = ['id', 'studio', 'label', 'url', 'kind', 'is_active', 'position', 'created_at']
        read_only_fields = ['id', 'created_at', 'studio']
