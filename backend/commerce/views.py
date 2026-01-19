import logging
import requests
from django.urls import reverse
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from django.views.decorators.csrf import csrf_exempt
from .models import Order, UserCredit, UserMembership
from .serializers import OrderSerializer, CreateOrderSerializer, UserCreditSerializer, UserMembershipSerializer
from django.conf import settings
from .services import create_order, mark_order_paid, get_user_balance, create_mp_preference
from users.permissions import IsAdmin, IsStaff

logger = logging.getLogger(__name__)

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return Order.objects.none()
        qs = Order.objects.filter(studio=studio)
        if not (self.request.user.has_role('staff') or self.request.user.has_role('admin')):
            qs = qs.filter(user=self.request.user)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = create_order(
            studio=request.studio,
            user=request.user,
            items_payload=serializer.validated_data['items'],
            provider=serializer.validated_data.get('provider'),
            provider_ref=serializer.validated_data.get('provider_ref'),
        )
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        order = self.get_queryset().filter(pk=kwargs.get('pk')).first()
        if not order:
            return Response({'detail': 'Orden no encontrada'}, status=404)
        if order.status != Order.OrderStatus.PENDING:
            return Response({'detail': 'Solo se pueden eliminar órdenes pendientes'}, status=400)
        order.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def mark_paid(self, request, pk=None):
        order = self.get_queryset().filter(pk=pk).first()
        if not order:
            return Response({'detail': 'Orden no encontrada'}, status=404)
        is_staff_admin = request.user.has_role('staff') or request.user.has_role('admin')
        if not is_staff_admin:
            return Response({'detail': 'Solo staff/admin pueden certificar pagos'}, status=403)
        provider = request.data.get('provider') or 'manual'
        provider_ref = request.data.get('provider_ref')
        mark_order_paid(order, provider=provider, provider_ref=provider_ref)
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def mp_link(self, request, pk=None):
        order = self.get_queryset().filter(pk=pk).first()
        if not order:
            return Response({'detail': 'Orden no encontrada'}, status=404)
        # Owner or staff/admin can solicitar link
        is_staff_admin = request.user.has_role('staff') or request.user.has_role('admin')
        if not is_staff_admin and order.user != request.user:
            return Response({'detail': 'No autorizado'}, status=403)

        frontend_base = getattr(settings, 'FRONTEND_URL', '').rstrip('/') or 'https://33fitstudio.online'
        success_url = f"{frontend_base}/portal?payment=mp_success&order={order.id}"
        failure_url = f"{frontend_base}/portal?payment=mp_failed&order={order.id}"
        # Usa override desde settings o arma URL absoluta al endpoint de webhook
        notification_url = getattr(settings, 'MP_NOTIFICATION_URL', None)
        if not notification_url:
            notification_url = request.build_absolute_uri(reverse('mp-webhook'))

        link_data = create_mp_preference(order=order, success_url=success_url, failure_url=failure_url, notification_url=notification_url)
        return Response(link_data)


@csrf_exempt
@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def mp_webhook(request):
    # Mercado Pago envía data.id en query (GET) o body (POST); topic/type define el recurso
    topic = request.query_params.get('type') or request.query_params.get('topic') or request.data.get('type') or request.data.get('topic')
    if topic and topic != 'payment':
        logger.info('mp_webhook ignored non-payment topic', extra={'topic': topic})
        return Response({'detail': 'Topic ignorado'}, status=status.HTTP_200_OK)

    payment_id = request.query_params.get('data.id') or request.query_params.get('id') or request.data.get('data', {}).get('id') or request.data.get('id')
    if not payment_id:
        return Response({'detail': 'No payment id'}, status=status.HTTP_400_BAD_REQUEST)

    # Firma simple via shared secret opcional
    webhook_secret = getattr(settings, 'MP_WEBHOOK_SECRET', None)
    if webhook_secret:
        provided_secret = request.headers.get('X-Webhook-Secret')
        if provided_secret != webhook_secret:
            logger.warning('mp_webhook invalid secret', extra={'payment_id': payment_id})
            return Response({'detail': 'Firma inválida'}, status=status.HTTP_401_UNAUTHORIZED)

    access_token = getattr(settings, 'MP_ACCESS_TOKEN', None)
    if not access_token:
        return Response({'detail': 'MP_ACCESS_TOKEN no configurado'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    headers = {
        'Authorization': f'Bearer {access_token}',
    }
    resp = requests.get(f'https://api.mercadopago.com/v1/payments/{payment_id}', headers=headers, timeout=10)
    if not resp.ok:
        logger.warning('mp_webhook payment fetch failed', extra={'payment_id': payment_id, 'response': resp.text})
        return Response({'detail': f'No se pudo obtener pago {payment_id}', 'mp_response': resp.text}, status=status.HTTP_502_BAD_GATEWAY)

    data = resp.json()
    external_ref = data.get('external_reference')
    status_mp = data.get('status')
    amount = data.get('transaction_amount')
    currency = data.get('currency_id')

    if not external_ref:
        logger.warning('mp_webhook missing external_reference', extra={'payment_id': payment_id})
        return Response({'detail': 'Sin external_reference'}, status=status.HTTP_200_OK)

    order = Order.objects.filter(id=external_ref).first()
    if not order:
        logger.warning('mp_webhook order not found', extra={'payment_id': payment_id, 'external_ref': external_ref})
        return Response({'detail': 'Orden no encontrada para external_reference'}, status=status.HTTP_200_OK)

    # Idempotencia si ya está pagada con mismo pago
    if order.status == Order.OrderStatus.PAID and str(order.provider_ref or '') == str(payment_id):
        return Response({'detail': 'Ya procesado'}, status=status.HTTP_200_OK)

    # Validación de monto y moneda
    expected_amount = order.total_cents / 100.0
    if amount is not None and abs(float(amount) - expected_amount) > 0.01:
        logger.warning('mp_webhook amount mismatch', extra={'payment_id': payment_id, 'amount': amount, 'expected': expected_amount})
        return Response({'detail': 'Monto no coincide'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
    if currency and currency != order.currency:
        logger.warning('mp_webhook currency mismatch', extra={'payment_id': payment_id, 'currency': currency, 'order_currency': order.currency})
        return Response({'detail': 'Moneda no coincide'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    if status_mp == 'approved':
        mark_order_paid(order, provider='mercadopago', provider_ref=str(payment_id))
        logger.info('mp_webhook order marked paid', extra={'payment_id': payment_id, 'order_id': order.id})
        return Response({'detail': 'Orden marcada pagada'}, status=status.HTTP_200_OK)

    logger.info('mp_webhook received non-approved status', extra={'payment_id': payment_id, 'status': status_mp})
    return Response({'detail': f'Estado MP {status_mp}'}, status=status.HTTP_200_OK)

class UserCreditViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserCreditSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return UserCredit.objects.none()
        qs = UserCredit.objects.filter(studio=studio)
        if not (self.request.user.has_role('staff') or self.request.user.has_role('admin')):
            qs = qs.filter(user=self.request.user)
        return qs

    @action(detail=False, methods=['get'])
    def balance(self, request):
        studio = request.studio
        if not studio:
            return Response({'detail': 'Studio requerido'}, status=400)
        if request.user.has_role('staff') or request.user.has_role('admin'):
            user_id = request.query_params.get('user')
            user = request.user.__class__.objects.filter(id=user_id).first() if user_id else request.user
        else:
            user = request.user
        if not user:
            return Response({'detail': 'Usuario no encontrado'}, status=404)
        data = get_user_balance(studio=studio, user=user)
        return Response(data)

class UserMembershipViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return UserMembership.objects.none()
        qs = UserMembership.objects.filter(studio=studio)
        if not (self.request.user.has_role('staff') or self.request.user.has_role('admin')):
            qs = qs.filter(user=self.request.user)
        return qs
