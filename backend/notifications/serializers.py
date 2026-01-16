from rest_framework import serializers
from .models import NotificationTemplate, WebhookEndpoint

class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = ['id', 'studio', 'code', 'channel', 'subject', 'body', 'created_at']
        read_only_fields = ['id', 'studio', 'created_at']

class WebhookEndpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookEndpoint
        fields = ['id', 'studio', 'event', 'target_url', 'is_active', 'created_at']
        read_only_fields = ['id', 'studio', 'created_at']
