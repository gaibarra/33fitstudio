from rest_framework import serializers
from .models import Order, OrderItem, UserCredit, UserMembership

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'quantity', 'unit_price_cents', 'line_total_cents']
        read_only_fields = ['id', 'unit_price_cents', 'line_total_cents']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'studio', 'user', 'status', 'total_cents', 'currency', 'provider', 'provider_ref', 'paid_at', 'items', 'created_at']
        read_only_fields = ['id', 'status', 'total_cents', 'paid_at', 'created_at', 'studio', 'user']

class CreateOrderSerializer(serializers.Serializer):
    items = serializers.ListField(child=serializers.DictField(), allow_empty=False)
    provider = serializers.CharField(required=False, allow_blank=True)
    provider_ref = serializers.CharField(required=False, allow_blank=True)

class UserCreditSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserCredit
        fields = ['id', 'studio', 'user', 'source_order_item', 'credits_total', 'credits_used', 'expires_at', 'created_at']
        read_only_fields = ['id', 'studio', 'user', 'created_at']

class UserMembershipSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserMembership
        fields = ['id', 'studio', 'user', 'product', 'status', 'starts_at', 'ends_at', 'next_billing_at', 'provider', 'provider_ref', 'created_at']
        read_only_fields = ['id', 'studio', 'user', 'created_at']
