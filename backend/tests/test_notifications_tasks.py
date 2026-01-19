from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from catalog.models import ClassType
from notifications.tasks import schedule_reminders, send_booking_reminder
from scheduling.models import Session, Booking
from studios.models import Studio
from users.models import User


class NotificationTasksTests(TestCase):
    def setUp(self):
        self.studio = Studio.objects.create(name='Reminders Studio', brand_json={})
        self.class_type = ClassType.objects.create(studio=self.studio, name='HIIT', duration_minutes=45)
        self.user = User.objects.create_user(email='notify@example.com', password='pass')

    def test_schedule_reminders_counts_future_bookings(self):
        future_session = Session.objects.create(
            studio=self.studio,
            class_type=self.class_type,
            starts_at=timezone.now() + timedelta(hours=6),
            capacity=10,
        )
        past_session = Session.objects.create(
            studio=self.studio,
            class_type=self.class_type,
            starts_at=timezone.now() - timedelta(hours=2),
            capacity=10,
        )

        Booking.objects.create(
            studio=self.studio,
            session=future_session,
            user=self.user,
            status=Booking.BookingStatus.BOOKED,
        )
        Booking.objects.create(
            studio=self.studio,
            session=past_session,
            user=self.user,
            status=Booking.BookingStatus.BOOKED,
        )
        Booking.objects.create(
            studio=self.studio,
            session=future_session,
            user=User.objects.create_user(email='cancel@example.com', password='pass'),
            status=Booking.BookingStatus.CANCELLED,
        )

        count = schedule_reminders()
        self.assertEqual(count, 1)

    @patch('notifications.tasks.Booking')
    def test_send_booking_reminder_targets_booking(self, booking_model):
        result = send_booking_reminder('booking-id')
        booking_model.objects.filter.assert_called_once_with(id='booking-id')
        booking_model.objects.filter.return_value.update.assert_called_once_with()
        self.assertEqual(result, 'queued')
