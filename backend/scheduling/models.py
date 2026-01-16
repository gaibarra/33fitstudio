from django.db import models
from django.utils import timezone
from core.models import BaseModel

class Session(BaseModel):
    class SessionStatus(models.TextChoices):
        SCHEDULED = 'scheduled', 'Programada'
        CANCELLED = 'cancelled', 'Cancelada'
        DONE = 'done', 'Realizada'

    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='sessions')
    location = models.ForeignKey('studios.Location', on_delete=models.SET_NULL, null=True, blank=True, related_name='sessions')
    class_type = models.ForeignKey('catalog.ClassType', on_delete=models.CASCADE, related_name='sessions')
    instructor = models.ForeignKey('catalog.Instructor', on_delete=models.SET_NULL, null=True, blank=True, related_name='sessions')
    starts_at = models.DateTimeField()
    capacity = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=SessionStatus.choices, default=SessionStatus.SCHEDULED)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'sessions'
        indexes = [
            models.Index(fields=['studio', 'starts_at']),
            models.Index(fields=['status']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['studio', 'class_type', 'starts_at'], name='session_unique_per_class_time'),
        ]
        ordering = ['starts_at']

    def __str__(self):
        return f"{self.class_type.name} {self.starts_at}"

class Booking(BaseModel):
    class BookingStatus(models.TextChoices):
        BOOKED = 'booked', 'Reservado'
        WAITLIST = 'waitlist', 'Espera'
        CANCELLED = 'cancelled', 'Cancelado'
        NO_SHOW = 'no_show', 'No show'
        ATTENDED = 'attended', 'Asistió'

    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='bookings')
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='bookings')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='bookings')
    credit = models.ForeignKey('commerce.UserCredit', on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    membership = models.ForeignKey('commerce.UserMembership', on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    status = models.CharField(max_length=20, choices=BookingStatus.choices, default=BookingStatus.BOOKED)
    booked_at = models.DateTimeField(default=timezone.now)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    source = models.CharField(max_length=30, null=True, blank=True)

    class Meta:
        db_table = 'bookings'
        unique_together = ('session', 'user')
        indexes = [
            models.Index(fields=['session']),
            models.Index(fields=['user']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.session_id}"

class WaitlistEntry(BaseModel):
    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='waitlist_entries')
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='waitlist_entries')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='waitlist_entries')
    position = models.PositiveIntegerField()
    offered_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'waitlist_entries'
        unique_together = ('session', 'user')
        indexes = [models.Index(fields=['session', 'position'])]
        ordering = ['position', 'created_at']

class Checkin(BaseModel):
    studio = models.ForeignKey('studios.Studio', on_delete=models.CASCADE, related_name='checkins')
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='checkin')
    checked_in_at = models.DateTimeField(default=timezone.now)
    method = models.CharField(max_length=20, null=True, blank=True)

    class Meta:
        db_table = 'checkins'
        indexes = [models.Index(fields=['studio'])]
