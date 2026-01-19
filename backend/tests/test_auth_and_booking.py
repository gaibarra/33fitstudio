from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient

from users.models import User, Role
from studios.models import Studio
from catalog.models import ClassType
from scheduling.models import Session, Booking

class AuthAndBookingTests(APITestCase):
    def setUp(self):
        self.studio = Studio.objects.create(name='Test Studio', brand_json={})
        Role.objects.get_or_create(code='customer', defaults={'name': 'Customer'})
        self.client = APIClient()
        self.client.credentials(HTTP_X_STUDIO_ID=str(self.studio.id))

    def test_register_and_token(self):
        payload = {
            'email': 'user1@example.com',
            'password': 'Pass12345!A',
            'password_confirmation': 'Pass12345!A',
        }

        with patch('notifications.tasks.send_onboarding_email.delay') as onboarding_task:
            resp = self.client.post(reverse('register'), payload)

        self.assertEqual(resp.status_code, 201)
        onboarding_task.assert_called_once()

        token_resp = self.client.post(
            reverse('token_obtain_pair'),
            {'email': 'user1@example.com', 'password': 'Pass12345!A'},
        )
        self.assertEqual(token_resp.status_code, 200)
        self.assertIn('access', token_resp.data)

    def test_register_requires_matching_passwords(self):
        payload = {
            'email': 'mismatch@example.com',
            'password': 'Pass12345!A',
            'password_confirmation': 'Pass12345!B',
        }
        resp = self.client.post(reverse('register'), payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('password_confirmation', resp.json())

    def test_register_requires_studio_scope(self):
        self.client.credentials()
        payload = {
            'email': 'nostudio@example.com',
            'password': 'Pass12345!A',
            'password_confirmation': 'Pass12345!A',
        }
        resp = self.client.post(reverse('register'), payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('studio_id', resp.json())

    def test_register_rejects_cross_tenant_payload(self):
        second_studio = Studio.objects.create(name='Other', brand_json={})
        payload = {
            'email': 'hacker@example.com',
            'password': 'Pass12345!A',
            'password_confirmation': 'Pass12345!A',
            'studio_id': str(second_studio.id),
        }
        resp = self.client.post(reverse('register'), payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('studio_id', resp.json())

    def test_register_enforces_password_strength(self):
        payload = {
            'email': 'weak@example.com',
            'password': '12345',
            'password_confirmation': '12345',
        }
        resp = self.client.post(reverse('register'), payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('password', resp.json())

    def test_booking_waitlist_promotion(self):
        class_type = ClassType.objects.create(studio=self.studio, name='Clase', duration_minutes=60)
        session = Session.objects.create(studio=self.studio, class_type=class_type, starts_at=timezone.now() + timedelta(hours=2), capacity=1)

        user1 = User.objects.create_user(email='a@example.com', password='pass')
        user2 = User.objects.create_user(email='b@example.com', password='pass')

        self.client.force_authenticate(user=user1)
        resp1 = self.client.post('/api/scheduling/bookings/', {'session': str(session.id)})
        self.assertEqual(resp1.status_code, 201)
        booking1 = Booking.objects.get(id=resp1.data['id'])
        self.assertEqual(booking1.status, Booking.BookingStatus.BOOKED)

        self.client.force_authenticate(user=user2)
        resp2 = self.client.post('/api/scheduling/bookings/', {'session': str(session.id)})
        self.assertEqual(resp2.status_code, 201)
        booking2 = Booking.objects.get(id=resp2.data['id'])
        self.assertEqual(booking2.status, Booking.BookingStatus.WAITLIST)

        # cancel first booking -> promote waitlist
        self.client.force_authenticate(user=user1)
        cancel_resp = self.client.post(f"/api/scheduling/bookings/{booking1.id}/cancel/")
        self.assertEqual(cancel_resp.status_code, 200)
        booking2.refresh_from_db()
        self.assertEqual(booking2.status, Booking.BookingStatus.BOOKED)

    def test_booking_does_not_exceed_capacity(self):
        class_type = ClassType.objects.create(studio=self.studio, name='Clase Cap', duration_minutes=60)
        session = Session.objects.create(
            studio=self.studio,
            class_type=class_type,
            starts_at=timezone.now() + timedelta(hours=4),
            capacity=2,
        )

        users = [
            User.objects.create_user(email='cap1@example.com', password='pass'),
            User.objects.create_user(email='cap2@example.com', password='pass'),
            User.objects.create_user(email='cap3@example.com', password='pass'),
        ]

        for idx, user in enumerate(users):
            self.client.force_authenticate(user=user)
            resp = self.client.post('/api/scheduling/bookings/', {'session': str(session.id)})
            self.assertEqual(resp.status_code, 201)
            expected_status = Booking.BookingStatus.BOOKED if idx < session.capacity else Booking.BookingStatus.WAITLIST
            self.assertEqual(resp.data['status'], expected_status)

        booked_count = Booking.objects.filter(session=session, status=Booking.BookingStatus.BOOKED).count()
        self.assertEqual(booked_count, session.capacity)

    def test_booking_rejects_cross_studio_session(self):
        other_studio = Studio.objects.create(name='Other Studio', brand_json={})
        class_type = ClassType.objects.create(studio=other_studio, name='Clase Ajena', duration_minutes=45)
        foreign_session = Session.objects.create(
            studio=other_studio,
            class_type=class_type,
            starts_at=timezone.now() + timedelta(hours=3),
            capacity=5,
        )

        user = User.objects.create_user(email='tenant@example.com', password='pass')
        self.client.force_authenticate(user=user)
        resp = self.client.post('/api/scheduling/bookings/', {'session': str(foreign_session.id)})
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(Booking.objects.count(), 0)
