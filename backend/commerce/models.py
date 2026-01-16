from django.db import models
from django.utils import timezone
from core.models import BaseModel

class Order(BaseModel):
    class OrderStatus(models.TextChoices):
        PENDING = 'pending', 'Pendiente'
        PAID = 'paid', 'Pagado'
        FAILED = 'failed', 'Fallido'
        REFUNDED = 'refunded', 'Reembolsado'
        CANCELLED = 'cancelled', 'Cancelado'

    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='orders')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)
    total_cents = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=8, default='MXN')
    provider = models.CharField(max_length=50, null=True, blank=True)
    provider_ref = models.CharField(max_length=100, null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'orders'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['status']),
        ]

class OrderItem(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('catalog.Product', on_delete=models.PROTECT, related_name='order_items')
    quantity = models.PositiveIntegerField(default=1)
    unit_price_cents = models.PositiveIntegerField()
    line_total_cents = models.PositiveIntegerField()
    meta = models.JSONField(default=dict)

    class Meta:
        db_table = 'order_items'
        indexes = [models.Index(fields=['order'])]

class UserCredit(BaseModel):
    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='user_credits')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='credits')
    source_order_item = models.ForeignKey(OrderItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='credits')
    credits_total = models.PositiveIntegerField()
    credits_used = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'user_credits'
        indexes = [models.Index(fields=['user'])]
        constraints = [models.CheckConstraint(check=models.Q(credits_used__lte=models.F('credits_total')), name='credits_not_overflow')]

class UserMembership(BaseModel):
    STATUS_CHOICES = (
        ('active', 'Activa'),
        ('paused', 'Pausada'),
        ('cancelled', 'Cancelada'),
        ('expired', 'Expirada'),
    )
    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='user_memberships')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='memberships')
    product = models.ForeignKey('catalog.Product', on_delete=models.PROTECT, related_name='memberships')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)
    next_billing_at = models.DateTimeField(null=True, blank=True)
    provider = models.CharField(max_length=50, null=True, blank=True)
    provider_ref = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'user_memberships'
        indexes = [models.Index(fields=['user']), models.Index(fields=['status'])]
