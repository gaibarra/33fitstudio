from django.db import models
from core.models import BaseModel

class TrackingEvent(BaseModel):
    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='tracking_events', null=True, blank=True)
    user = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='tracking_events')
    event_type = models.CharField(max_length=50)
    utm = models.JSONField(default=dict)
    meta = models.JSONField(default=dict)

    class Meta:
        db_table = 'tracking_events'
        indexes = [models.Index(fields=['studio', 'created_at'])]
