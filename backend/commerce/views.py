import requests
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from django.views.decorators.csrf import csrf_exempt
from .models import Order, UserCredit, UserMembership
from .serializers import OrderSerializer, CreateOrderSerializer, UserCreditSerializer, UserMembershipSerializer
from django.conf import settings
from .services import create_order, mark_order_paid, get_user_balance, create_mp_preference
from users.permissions import IsAdmin, IsStaff

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
        # Webhook opcional (no implementado aún); dejar None para ahora
        notification_url = None

        link_data = create_mp_preference(order=order, success_url=success_url, failure_url=failure_url, notification_url=notification_url)
        return Response(link_data)


@csrf_exempt
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def mp_webhook(request):
    # Mercado Pago envía data.id en query o en el body
    payment_id = request.query_params.get('data.id') or request.data.get('data', {}).get('id') or request.data.get('id')
    if not payment_id:
        return Response({'detail': 'No payment id'}, status=status.HTTP_400_BAD_REQUEST)

    access_token = getattr(settings, 'MP_ACCESS_TOKEN', None)
    if not access_token:
        return Response({'detail': 'MP_ACCESS_TOKEN no configurado'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    headers = {
        'Authorization': f'Bearer {access_token}',
    }
    resp = requests.get(f'https://api.mercadopago.com/v1/payments/{payment_id}', headers=headers, timeout=10)
    if not resp.ok:
        return Response({'detail': f'No se pudo obtener pago {payment_id}', 'mp_response': resp.text}, status=status.HTTP_502_BAD_GATEWAY)

    data = resp.json()
    external_ref = data.get('external_reference')
    status_mp = data.get('status')
    if not external_ref:
        return Response({'detail': 'Sin external_reference'}, status=status.HTTP_200_OK)

    order = Order.objects.filter(id=external_ref).first()
    if not order:
        return Response({'detail': 'Orden no encontrada para external_reference'}, status=status.HTTP_200_OK)

    if status_mp == 'approved':
        mark_order_paid(order, provider='mercadopago', provider_ref=str(payment_id))
        return Response({'detail': 'Orden marcada pagada'}, status=status.HTTP_200_OK)

    # Para otros estados, solo acuse recibo
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
