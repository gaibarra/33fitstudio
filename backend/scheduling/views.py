from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Session, Booking, WaitlistEntry, Checkin
from .serializers import SessionSerializer, BookingSerializer, WaitlistEntrySerializer, CheckinSerializer
from .services import book_session, cancel_booking
from users.permissions import IsAdmin, IsStaff
from rest_framework.exceptions import PermissionDenied

class SessionViewSet(viewsets.ModelViewSet):
    serializer_class = SessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['notes']
    ordering_fields = ['starts_at', 'capacity']

    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return Session.objects.none()
        qs = Session.objects.filter(studio=studio)
        start_gte = self.request.query_params.get('start_gte')
        if start_gte:
            qs = qs.filter(starts_at__gte=start_gte)

        exact_date = self.request.query_params.get('date')
        if exact_date:
            qs = qs.filter(starts_at__date=exact_date)

        date_gte = self.request.query_params.get('starts_at__date__gte')
        if date_gte:
            qs = qs.filter(starts_at__date__gte=date_gte)

        date_lte = self.request.query_params.get('starts_at__date__lte')
        if date_lte:
            qs = qs.filter(starts_at__date__lte=date_lte)
        return qs

    def perform_create(self, serializer):
        serializer.save(studio=self.request.studio)

class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return Booking.objects.none()
        return Booking.objects.filter(studio=studio, user=self.request.user)

    def create(self, request, *args, **kwargs):
        # Admin/staff users should not create client bookings
        if request.user.is_staff or request.user.has_role('admin') or request.user.has_role('staff'):
            raise PermissionDenied('Los usuarios admin no pueden crear reservas.')

        session_id = request.data.get('session')
        if not session_id:
            return Response({'detail': 'session requerido'}, status=400)
        try:
            session = Session.objects.get(id=session_id, studio=request.studio)
        except Session.DoesNotExist:
            return Response({'detail': 'Sesión no encontrada'}, status=404)
        booking = book_session(studio=request.studio, session=session, user=request.user, source=request.data.get('source', 'web'))
        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        booking = self.get_queryset().filter(pk=pk).first()
        if not booking:
            return Response({'detail': 'Reserva no encontrada'}, status=404)
        cancel_booking(booking=booking, actor=request.user)
        return Response({'detail': 'Reserva cancelada'})

class WaitlistEntryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WaitlistEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return WaitlistEntry.objects.none()
        return WaitlistEntry.objects.filter(studio=studio, user=self.request.user)

class CheckinViewSet(viewsets.ModelViewSet):
    serializer_class = CheckinSerializer
    permission_classes = [IsStaff | IsAdmin]

    def get_queryset(self):
        studio = self.request.studio
        if not studio:
            return Checkin.objects.none()
        return Checkin.objects.filter(studio=studio)

    def perform_create(self, serializer):
        serializer.save(studio=self.request.studio, checked_in_at=timezone.now())
