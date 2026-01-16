from django.db import models
from core.models import BaseModel

class NotificationTemplate(BaseModel):
    CHANNEL_CHOICES = (
        ('email', 'Email'),
        ('whatsapp', 'WhatsApp'),
        ('sms', 'SMS'),
    )
    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='notification_templates')
    code = models.CharField(max_length=100)
    channel = models.CharField(max_length=30, choices=CHANNEL_CHOICES)
    subject = models.CharField(max_length=255, blank=True, default='')
    body = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'notification_templates'
        unique_together = ('studio', 'code', 'channel')

class WebhookEndpoint(BaseModel):
    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='webhook_endpoints')
    event = models.CharField(max_length=100)
    target_url = models.URLField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'webhook_endpoints'
        indexes = [models.Index(fields=['studio', 'event'])]
