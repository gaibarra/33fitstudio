from django.db import models
from django.db.models.functions import Lower
from core.models import BaseModel

class Instructor(BaseModel):
    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='instructors')
    full_name = models.CharField(max_length=255)
    bio = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'instructors'
        indexes = [models.Index(fields=['studio'])]
        ordering = ['full_name']

    def __str__(self):
        return self.full_name

class ClassType(BaseModel):
    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='class_types')
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField()

    class Meta:
        db_table = 'class_types'
        unique_together = ('studio', 'name')
        indexes = [models.Index(fields=['studio'])]
        constraints = [
            models.UniqueConstraint(Lower('name'), 'studio', name='class_type_name_ci_unique')
        ]
        ordering = ['name']

    def __str__(self):
        return self.name

class Product(BaseModel):
    class ProductType(models.TextChoices):
        DROP_IN = 'drop_in', 'Drop-in'
        PACKAGE = 'package', 'Paquete'
        MEMBERSHIP = 'membership', 'Membresía'

    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='products')
    type = models.CharField(max_length=20, choices=ProductType.choices)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    price_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=8, default='MXN')
    is_active = models.BooleanField(default=True)
    meta = models.JSONField(default=dict)

    class Meta:
        db_table = 'products'
        unique_together = ('studio', 'type', 'name')
        indexes = [
            models.Index(fields=['studio']),
            models.Index(fields=['type']),
        ]
        ordering = ['name']

    def __str__(self):
        return self.name
