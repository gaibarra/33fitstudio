from rest_framework import serializers
from .models import Session, Booking, WaitlistEntry, Checkin

class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ['id', 'studio', 'location', 'class_type', 'instructor', 'starts_at', 'capacity', 'status', 'notes', 'created_at']
        read_only_fields = ['id', 'studio', 'status', 'created_at']

class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['id', 'studio', 'session', 'user', 'status', 'booked_at', 'cancelled_at', 'source', 'credit', 'membership', 'created_at']
        read_only_fields = ['id', 'studio', 'status', 'booked_at', 'cancelled_at', 'credit', 'membership', 'created_at']

class WaitlistEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = WaitlistEntry
        fields = ['id', 'studio', 'session', 'user', 'position', 'offered_until', 'created_at']
        read_only_fields = ['id', 'studio', 'position', 'created_at']

class CheckinSerializer(serializers.ModelSerializer):
    class Meta:
        model = Checkin
        fields = ['id', 'studio', 'booking', 'checked_in_at', 'method', 'created_at']
        read_only_fields = ['id', 'studio', 'checked_in_at', 'created_at']
