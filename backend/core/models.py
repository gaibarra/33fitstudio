import uuid
from django.db import models
from django.utils import timezone

class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        abstract = True

class AuditLog(BaseModel):
    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='audit_logs', null=True)
    actor_user = models.ForeignKey('users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='acted_logs')
    action = models.CharField(max_length=120)
    entity = models.CharField(max_length=120, null=True, blank=True)
    entity_id = models.UUIDField(null=True, blank=True)
    meta = models.JSONField(default=dict)

    class Meta:
        indexes = [
            models.Index(fields=['studio', 'created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} ({self.entity})"
