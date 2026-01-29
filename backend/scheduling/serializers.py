from rest_framework import serializers
from .models import Session, Booking, WaitlistEntry, Checkin

class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ['id', 'studio', 'location', 'class_type', 'instructor', 'starts_at', 'capacity', 'status', 'notes', 'created_at']
        read_only_fields = ['id', 'studio', 'status', 'created_at']

class BookingSerializer(serializers.ModelSerializer):
    session_starts_at = serializers.DateTimeField(source='session.starts_at', read_only=True)
    session_class_name = serializers.CharField(source='session.class_type.name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    has_checkin = serializers.SerializerMethodField()
    checkin_id = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'studio', 'session', 'user', 'status', 'booked_at', 'cancelled_at', 'source', 'credit', 'membership', 'created_at',
            'session_starts_at', 'session_class_name', 'user_email', 'user_name', 'has_checkin', 'checkin_id'
        ]
        read_only_fields = ['id', 'studio', 'status', 'booked_at', 'cancelled_at', 'credit', 'membership', 'created_at', 'session_starts_at', 'session_class_name', 'user_email', 'user_name', 'has_checkin', 'checkin_id']

    def get_has_checkin(self, obj):
        return hasattr(obj, 'checkin') and obj.checkin is not None

    def get_checkin_id(self, obj):
        if hasattr(obj, 'checkin') and obj.checkin:
            return str(obj.checkin.id)
        return None

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
