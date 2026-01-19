import requests
from django.conf import settings
from django.db import transaction, models
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from catalog.models import Product
from .models import Order, OrderItem, UserCredit, UserMembership
from core.utils import log_action

@transaction.atomic
def create_order(*, studio, user, items_payload, provider=None, provider_ref=None):
    if not items_payload:
        raise ValidationError('Se requieren productos')
    order = Order.objects.create(
        studio=studio,
        user=user,
        status=Order.OrderStatus.PENDING,
        provider=provider,
        provider_ref=provider_ref,
    )
    total = 0
    for item in items_payload:
        product_id = item.get('product')
        qty = int(item.get('quantity', 1))
        try:
            product = Product.objects.get(id=product_id, studio=studio)
        except Product.DoesNotExist:
            raise ValidationError('Producto no encontrado')
        line_total = product.price_cents * qty
        OrderItem.objects.create(
            order=order,
            product=product,
            quantity=qty,
            unit_price_cents=product.price_cents,
            line_total_cents=line_total,
        )
        total += line_total
    order.total_cents = total
    order.save(update_fields=['total_cents'])
    log_action(studio, user, 'order_created', 'order', order.id, {'total_cents': total})
    return order

@transaction.atomic
def mark_order_paid(order: Order, provider=None, provider_ref=None):
    if order.status == Order.OrderStatus.PAID:
        return order
    order.status = Order.OrderStatus.PAID
    order.paid_at = timezone.now()
    order.provider = provider or order.provider
    order.provider_ref = provider_ref or order.provider_ref
    order.save(update_fields=['status', 'paid_at', 'provider', 'provider_ref'])

    for item in order.items.select_related('product'):
        product = item.product
        meta = product.meta or {}
        if product.type == Product.ProductType.PACKAGE:
            credits = int(meta.get('credits', 0)) * item.quantity
            expires_days = meta.get('expiry_days')
            expires_at = timezone.now() + timezone.timedelta(days=int(expires_days)) if expires_days else None
            UserCredit.objects.create(
                studio=order.studio,
                user=order.user,
                source_order_item=item,
                credits_total=credits,
                credits_used=0,
                expires_at=expires_at,
            )
        elif product.type == Product.ProductType.MEMBERSHIP:
            duration_days = meta.get('duration_days')
            ends_at = timezone.now() + timezone.timedelta(days=int(duration_days)) if duration_days else None
            UserMembership.objects.create(
                studio=order.studio,
                user=order.user,
                product=product,
                status='active',
                starts_at=timezone.now(),
                ends_at=ends_at,
            )
        elif product.type == Product.ProductType.DROP_IN:
            # Cada drop-in otorga 1 crédito por unidad
            UserCredit.objects.create(
                studio=order.studio,
                user=order.user,
                source_order_item=item,
                credits_total=item.quantity,
                credits_used=0,
                expires_at=None,
            )
    log_action(order.studio, order.user, 'order_paid', 'order', order.id)
    return order


def get_user_balance(*, studio, user):
    now = timezone.now()
    credits_qs = UserCredit.objects.filter(studio=studio, user=user).filter(
        models.Q(expires_at__isnull=True) | models.Q(expires_at__gte=now)
    )
    credits_qs = credits_qs.annotate(remaining=models.F('credits_total') - models.F('credits_used')).filter(remaining__gt=0)
    credits_available = credits_qs.aggregate(total=models.Sum('remaining'))['total'] or 0
    next_expiration = credits_qs.order_by('expires_at').values_list('expires_at', flat=True).first()

    membership = UserMembership.objects.filter(
        studio=studio,
        user=user,
        status='active',
    ).filter(models.Q(ends_at__isnull=True) | models.Q(ends_at__gte=now)).order_by('ends_at').first()

    return {
        'credits_available': int(credits_available),
        'has_active_membership': bool(membership),
        'membership_ends_at': membership.ends_at if membership else None,
        'next_credit_expiration': next_expiration,
    }


def create_mp_preference(*, order: Order, success_url: str, failure_url: str, notification_url: str | None = None):
    access_token = getattr(settings, 'MP_ACCESS_TOKEN', None)
    if not access_token:
        raise ValidationError('Mercado Pago no está configurado (falta MP_ACCESS_TOKEN).')
    if order.status != Order.OrderStatus.PENDING:
        raise ValidationError('La orden debe estar pendiente para generar link de pago.')

    # Permite configurar un webhook fijo desde settings cuando no se envía explícito
    if not notification_url:
        notification_url = getattr(settings, 'MP_NOTIFICATION_URL', None)

    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }

    preference_payload = {
        'items': [
            {
                'id': str(order.id),
                'title': f"Orden {order.id}",
                'quantity': 1,
                'currency_id': order.currency,
                'unit_price': order.total_cents / 100.0,
            }
        ],
        'external_reference': str(order.id),
        'notification_url': notification_url,
        'back_urls': {
            'success': success_url,
            'failure': failure_url,
            'pending': failure_url,
        },
        'auto_return': 'approved',
    }

    resp = requests.post('https://api.mercadopago.com/checkout/preferences', json=preference_payload, headers=headers, timeout=15)
    if not resp.ok:
        detail = resp.text
        raise ValidationError(f'Error al crear preferencia de pago: {detail}')
    data = resp.json()

    # Persist provider info for trazabilidad
    order.provider = 'mercadopago'
    order.provider_ref = data.get('id') or order.provider_ref
    order.save(update_fields=['provider', 'provider_ref'])

    return {
        'preference_id': data.get('id'),
        'init_point': data.get('init_point'),
        'sandbox_init_point': data.get('sandbox_init_point'),
    }
