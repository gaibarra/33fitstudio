from rest_framework import serializers
from .models import TrackingEvent

class TrackingEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrackingEvent
        fields = ['id', 'studio', 'user', 'event_type', 'utm', 'meta', 'created_at']
        read_only_fields = ['id', 'user', 'studio', 'created_at']
