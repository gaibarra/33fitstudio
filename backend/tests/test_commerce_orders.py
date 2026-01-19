from datetime import timedelta

from django.test import TestCase

from catalog.models import Product
from commerce.models import Order, UserCredit, UserMembership
from commerce.services import create_order, mark_order_paid, get_user_balance
from studios.models import Studio
from users.models import User


class CommerceOrderTests(TestCase):
    def setUp(self):
        self.studio = Studio.objects.create(name='Studio', brand_json={})
        self.user = User.objects.create_user(email='wallet@example.com', password='pass', studio=self.studio)

    def test_mark_order_paid_creates_credits(self):
        package = Product.objects.create(
            studio=self.studio,
            type=Product.ProductType.PACKAGE,
            name='Paquete 5',
            price_cents=5000,
            meta={'credits': 5, 'expiry_days': 15},
        )
        drop_in = Product.objects.create(
            studio=self.studio,
            type=Product.ProductType.DROP_IN,
            name='Clase suelta',
            price_cents=1200,
            meta={},
        )

        order = create_order(
            studio=self.studio,
            user=self.user,
            items_payload=[
                {'product': str(package.id), 'quantity': 1},
                {'product': str(drop_in.id), 'quantity': 2},
            ],
        )

        mark_order_paid(order)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.OrderStatus.PAID)

        credits = UserCredit.objects.filter(user=self.user)
        self.assertEqual(credits.count(), 2)
        package_credit = credits.filter(source_order_item__product=package).first()
        self.assertIsNotNone(package_credit)
        self.assertEqual(package_credit.credits_total, 5)
        self.assertEqual(package_credit.source_order_item.quantity, 1)

        dropin_credit = credits.filter(source_order_item__product=drop_in).first()
        self.assertIsNotNone(dropin_credit)
        self.assertEqual(dropin_credit.credits_total, 2)
        self.assertIsNone(dropin_credit.expires_at)

    def test_mark_order_paid_creates_membership_and_balance(self):
        membership = Product.objects.create(
            studio=self.studio,
            type=Product.ProductType.MEMBERSHIP,
            name='Membresia',
            price_cents=15000,
            meta={'duration_days': 30},
        )

        order = create_order(
            studio=self.studio,
            user=self.user,
            items_payload=[{'product': str(membership.id), 'quantity': 1}],
        )

        mark_order_paid(order)

        membership_record = UserMembership.objects.get(user=self.user, product=membership)
        self.assertEqual(membership_record.status, 'active')
        self.assertIsNotNone(membership_record.ends_at)
        self.assertLess(abs((membership_record.ends_at - (membership_record.starts_at + timedelta(days=30))).total_seconds()), 5)

        balance = get_user_balance(studio=self.studio, user=self.user)
        self.assertTrue(balance['has_active_membership'])
        self.assertIsNotNone(balance['membership_ends_at'])
