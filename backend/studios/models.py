from django.db import models
from core.models import BaseModel

class Studio(BaseModel):
    name = models.CharField(max_length=255)
    brand_json = models.JSONField(default=dict)

    def __str__(self):
        return self.name

class Location(BaseModel):
    studio = models.ForeignKey(Studio, on_delete=models.CASCADE, related_name='locations')
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, null=True)
    tz = models.CharField(max_length=64, default='America/Merida')

    class Meta:
        indexes = [
            models.Index(fields=['studio']),
        ]

    def __str__(self):
        return self.name

class LinkButton(BaseModel):
    studio = models.ForeignKey(Studio, on_delete=models.CASCADE, related_name='link_buttons')
    label = models.CharField(max_length=100)
    url = models.URLField()
    kind = models.CharField(max_length=50, help_text='reservar|comprar|whatsapp|instagram|ubicacion|sitio|custom')
    is_active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['position']
        indexes = [
            models.Index(fields=['studio', 'position']),
        ]

    def __str__(self):
        return f"{self.label}"
