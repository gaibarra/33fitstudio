from django.db import models, transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import Session, Booking, WaitlistEntry
from commerce.models import UserCredit, UserMembership
from core.utils import log_action


def _claim_entitlement(*, studio, user, consume_credit=True):
    now = timezone.now()
    membership = UserMembership.objects.select_for_update().filter(
        studio=studio,
        user=user,
        status='active',
    ).filter(Q(ends_at__isnull=True) | Q(ends_at__gte=now)).order_by('ends_at').first()
    if membership:
        return None, membership

    credit = (
        UserCredit.objects.select_for_update()
        .filter(studio=studio, user=user)
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gte=now))
        .filter(credits_used__lt=F('credits_total'))
        .order_by('expires_at', 'created_at')
        .first()
    )
    if not credit:
        raise ValidationError('No tienes clases disponibles. Compra una clase suelta, paquete o membresía.')

    if consume_credit:
        UserCredit.objects.filter(id=credit.id).update(credits_used=F('credits_used') + 1)
        credit.refresh_from_db()
    return credit, None

@transaction.atomic
def book_session(*, studio, session: Session, user, source='web') -> Booking:
    if session.status != Session.SessionStatus.SCHEDULED:
        raise ValidationError('La sesión no está disponible.')
    if session.starts_at <= timezone.now():
        raise ValidationError('La sesión ya inició o terminó.')
    active_count = Booking.objects.select_for_update().filter(session=session, status=Booking.BookingStatus.BOOKED).count()
    existing = Booking.objects.filter(session=session, user=user).first()

    if existing:
        if existing.status == Booking.BookingStatus.CANCELLED and active_count < session.capacity:
            credit, membership = _claim_entitlement(studio=studio, user=user, consume_credit=True)
            existing.status = Booking.BookingStatus.BOOKED
            existing.booked_at = timezone.now()
            existing.cancelled_at = None
            existing.credit = credit
            existing.membership = membership
            existing.save(update_fields=['status', 'booked_at', 'cancelled_at', 'credit', 'membership'])
            log_action(studio, user, 'booking_reactivated', 'session', session.id)
        return existing

    if active_count >= session.capacity:
        # Aseguramos que el usuario tenga derecho aunque quede en espera
        _claim_entitlement(studio=studio, user=user, consume_credit=False)
        booking = Booking.objects.create(
            studio=studio,
            session=session,
            user=user,
            status=Booking.BookingStatus.WAITLIST,
            source=source,
        )
        position = WaitlistEntry.objects.select_for_update().filter(session=session).count() + 1
        WaitlistEntry.objects.create(studio=studio, session=session, user=user, position=position)
        log_action(studio, user, 'waitlist_joined', 'session', session.id, {'position': position})
        return booking

    credit, membership = _claim_entitlement(studio=studio, user=user, consume_credit=True)

    booking = Booking.objects.create(
        studio=studio,
        session=session,
        user=user,
        status=Booking.BookingStatus.BOOKED,
        credit=credit,
        membership=membership,
        source=source,
    )
    log_action(studio, user, 'booking_created', 'session', session.id, {'source': source})
    return booking

@transaction.atomic
def cancel_booking(*, booking: Booking, actor=None):
    if booking.status == Booking.BookingStatus.CANCELLED:
        return booking
    booking.status = Booking.BookingStatus.CANCELLED
    booking.cancelled_at = timezone.now()
    booking.save(update_fields=['status', 'cancelled_at'])
    if booking.credit_id:
        UserCredit.objects.filter(id=booking.credit_id).update(credits_used=models.Case(
            models.When(credits_used__gt=0, then=F('credits_used') - 1),
            default=0,
        ))
    promote_waitlist(booking.session)
    log_action(booking.studio, actor or booking.user, 'booking_cancelled', 'booking', booking.id)
    return booking

@transaction.atomic
def promote_waitlist(session: Session):
    active_count = Booking.objects.select_for_update().filter(session=session, status=Booking.BookingStatus.BOOKED).count()
    if active_count >= session.capacity:
        return None
    entry = WaitlistEntry.objects.select_for_update().filter(session=session).order_by('position', 'created_at').first()
    if not entry:
        return None
    booking = Booking.objects.filter(session=session, user=entry.user).first()
    if booking:
        try:
            credit, membership = _claim_entitlement(studio=session.studio, user=entry.user, consume_credit=True)
        except ValidationError:
            return None
        booking.status = Booking.BookingStatus.BOOKED
        booking.credit = credit
        booking.membership = membership
        booking.save(update_fields=['status', 'credit', 'membership'])
    entry.delete()
    log_action(session.studio, entry.user, 'waitlist_promoted', 'session', session.id)
    return booking
