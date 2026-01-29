'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';

type Booking = {
    id: string;
    session: string;
    session_class_name: string;
    session_starts_at: string;
    status: string;
    has_checkin: boolean;
    booked_at: string;
};

type Balance = {
    credits_available: number;
    has_active_membership: boolean;
    membership_ends_at: string | null;
    next_credit_expiration: string | null;
};

type Membership = {
    id: string;
    status: string;
    product: string;
    starts_at: string;
    ends_at: string | null;
};

type User = {
    email: string;
    full_name: string | null;
    phone: string | null;
};

export default function ClienteDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
    const [pastBookings, setPastBookings] = useState<Booking[]>([]);
    const [balance, setBalance] = useState<Balance | null>(null);
    const [membership, setMembership] = useState<Membership | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const token = typeof window !== 'undefined' ? sessionStorage.getItem('access') : null;
        if (!token) {
            router.push('/portal');
            return;
        }
        try {
            setLoading(true);
            const [me, bookingsRes, balRes, memsRes] = await Promise.all([
                apiFetch('/api/auth/me/'),
                apiFetch('/api/scheduling/bookings/'),
                apiFetch('/api/commerce/credits/balance/').catch(() => null),
                apiFetch('/api/commerce/memberships/').catch(() => []),
            ]);

            setUser(me);

            const bookingList: Booking[] = Array.isArray(bookingsRes)
                ? bookingsRes
                : bookingsRes?.results || [];

            const now = new Date();
            const upcoming = bookingList
                .filter((b) => new Date(b.session_starts_at) >= now && b.status !== 'cancelled')
                .sort((a, b) => new Date(a.session_starts_at).getTime() - new Date(b.session_starts_at).getTime());
            const past = bookingList
                .filter((b) => new Date(b.session_starts_at) < now || b.status === 'cancelled')
                .sort((a, b) => new Date(b.session_starts_at).getTime() - new Date(a.session_starts_at).getTime())
                .slice(0, 10);

            setUpcomingBookings(upcoming);
            setPastBookings(past);
            setBalance(balRes);

            const memList = Array.isArray(memsRes) ? memsRes : memsRes?.results || [];
            const activeMem = memList.find((m: Membership) => m.status === 'active');
            setMembership(activeMem || null);
        } catch (err: any) {
            if (err?.status === 401) {
                sessionStorage.removeItem('access');
                sessionStorage.removeItem('refresh');
                router.push('/portal');
            }
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        load();
    }, [load]);

    const handleCancel = async (booking: Booking) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: '¿Cancelar reserva?',
            text: `Vas a cancelar tu reserva de ${booking.session_class_name}`,
            showCancelButton: true,
            confirmButtonColor: '#c0392b',
            cancelButtonColor: '#6b8a1f',
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'No, mantener',
        });
        if (!result.isConfirmed) return;

        try {
            setCancellingId(booking.id);
            await apiFetch(`/api/scheduling/bookings/${booking.id}/cancel/`, { method: 'POST' });
            await Swal.fire({
                icon: 'success',
                title: 'Reserva cancelada',
                timer: 1500,
                showConfirmButton: false,
            });
            load();
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudo cancelar' });
        } finally {
            setCancellingId(null);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('access');
        sessionStorage.removeItem('refresh');
        router.push('/portal');
    };

    const formatDate = (value: string) => {
        return new Date(value).toLocaleDateString('es-MX', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (booking: Booking) => {
        if (booking.has_checkin || booking.status === 'attended') {
            return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">✓ Asistí</span>;
        }
        if (booking.status === 'cancelled') {
            return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Cancelada</span>;
        }
        if (booking.status === 'no_show') {
            return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">No asistí</span>;
        }
        return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Confirmada</span>;
    };

    if (loading) {
        return (
            <main className="card min-h-[50vh] flex items-center justify-center">
                <p className="text-slate-600">Cargando tu información...</p>
            </main>
        );
    }

    return (
        <main className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-primary">Mi Portal</p>
                        <h1 className="text-2xl font-semibold">
                            ¡Hola, {user?.full_name || user?.email?.split('@')[0] || 'Cliente'}!
                        </h1>
                        <p className="text-sm text-slate-600">{user?.email}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Link href="/portal/perfil" className="rounded-full border border-primary/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 text-center">
                            Editar perfil
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-xl">🎟️</span>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{balance?.credits_available || 0}</p>
                            <p className="text-sm text-slate-600">Créditos disponibles</p>
                        </div>
                    </div>
                    {balance?.next_credit_expiration && (
                        <p className="mt-2 text-xs text-slate-500">
                            Expiran: {new Date(balance.next_credit_expiration).toLocaleDateString('es-MX')}
                        </p>
                    )}
                </div>

                <div className="card hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-xl">📅</span>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{upcomingBookings.length}</p>
                            <p className="text-sm text-slate-600">Próximas clases</p>
                        </div>
                    </div>
                </div>

                <div className="card hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl">
                            {membership ? '⭐' : '💫'}
                        </span>
                        <div>
                            <p className="text-lg font-bold text-slate-900">
                                {membership ? 'Activa' : 'Sin membresía'}
                            </p>
                            <p className="text-sm text-slate-600">Membresía</p>
                        </div>
                    </div>
                    {membership?.ends_at && (
                        <p className="mt-2 text-xs text-slate-500">
                            Vence: {new Date(membership.ends_at).toLocaleDateString('es-MX')}
                        </p>
                    )}
                </div>

                <Link href="/portal/compras" className="card hover:shadow-md transition-shadow group">
                    <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/30 text-xl">🛒</span>
                        <div>
                            <p className="text-lg font-bold text-slate-900 group-hover:text-primary">Comprar</p>
                            <p className="text-sm text-slate-600">Paquetes y membresías</p>
                        </div>
                    </div>
                </Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Upcoming Bookings */}
                <div className="card space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-lg font-semibold text-slate-800">Mis próximas clases</h2>
                        <Link href="/horarios" className="text-sm font-semibold text-primary hover:underline">
                            + Reservar
                        </Link>
                    </div>
                    {upcomingBookings.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                            <p className="text-slate-500">No tienes clases programadas</p>
                            <Link href="/horarios" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
                                ← Ver horarios disponibles
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[20rem] overflow-y-auto">
                            {upcomingBookings.map((b) => (
                                <div
                                    key={b.id}
                                    className="rounded-xl border border-primary/20 bg-white/80 px-4 py-3 hover:shadow-sm transition-shadow"
                                >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-900">{b.session_class_name}</p>
                                            <p className="text-sm text-slate-600">{formatDate(b.session_starts_at)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {getStatusBadge(b)}
                                            {b.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleCancel(b)}
                                                    disabled={cancellingId === b.id}
                                                    className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                                                >
                                                    {cancellingId === b.id ? 'Cancelando...' : 'Cancelar'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Past Bookings */}
                <div className="card space-y-4">
                    <h2 className="text-lg font-semibold text-slate-800">Historial de clases</h2>
                    {pastBookings.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                            <p className="text-slate-500">Aún no tienes historial</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[20rem] overflow-y-auto">
                            {pastBookings.map((b) => (
                                <div
                                    key={b.id}
                                    className={`rounded-xl border px-4 py-3 ${b.status === 'cancelled' ? 'border-slate-200 bg-slate-50' : 'border-primary/10 bg-white/60'
                                        }`}
                                >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="font-medium text-slate-800">{b.session_class_name}</p>
                                            <p className="text-sm text-slate-500">{formatDate(b.session_starts_at)}</p>
                                        </div>
                                        {getStatusBadge(b)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Links */}
            <div className="card">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                    <Link
                        href="/horarios"
                        className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors text-center"
                    >
                        📅 Ver horarios
                    </Link>
                    <Link
                        href="/portal/compras"
                        className="rounded-full border border-primary px-6 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors text-center"
                    >
                        🛒 Comprar paquete
                    </Link>
                    <Link
                        href="/clases"
                        className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-center"
                    >
                        💪 Ver clases
                    </Link>
                </div>
            </div>
        </main>
    );
}
