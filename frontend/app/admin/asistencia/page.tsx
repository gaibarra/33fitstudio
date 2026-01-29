'use client';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';

type Session = {
    id: string;
    class_type: string;
    starts_at: string;
    capacity: number;
    status?: string;
    instructor?: string;
};

type Booking = {
    id: string;
    user: string;
    user_email: string;
    user_name: string | null;
    status: string;
    has_checkin: boolean;
    checkin_id: string | null;
    booked_at: string;
};

type ClassType = { id: string; name: string };
type Instructor = { id: string; full_name: string };

export default function AsistenciaAdmin() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingBookings, setLoadingBookings] = useState(false);
    const [classTypesMap, setClassTypesMap] = useState<Record<string, string>>({});
    const [instructorsMap, setInstructorsMap] = useState<Record<string, string>>({});
    const [dateFilter, setDateFilter] = useState<'ayer' | 'hoy' | 'manana' | ''>('hoy');
    const [processingCheckin, setProcessingCheckin] = useState<string | null>(null);

    const loadSessions = async (filter: typeof dateFilter) => {
        try {
            setLoading(true);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 86400000);
            const toISODate = (value: Date) => value.toISOString().split('T')[0];

            const params = new URLSearchParams({ ordering: 'starts_at' });
            if (filter === 'hoy') {
                params.set('date', toISODate(today));
            } else if (filter === 'ayer') {
                params.set('date', toISODate(addDays(today, -1)));
            } else if (filter === 'manana') {
                params.set('date', toISODate(addDays(today, 1)));
            }

            const [data, ct, ins] = await Promise.all([
                apiFetch(`/api/scheduling/sessions/?${params.toString()}`),
                apiFetch('/api/catalog/class-types/'),
                apiFetch('/api/catalog/instructors/'),
            ]);

            const list = Array.isArray(data) ? data : data?.results || [];
            const ctList = Array.isArray(ct) ? ct : ct?.results || [];
            const insList = Array.isArray(ins) ? ins : ins?.results || [];

            const ctMap: Record<string, string> = {};
            ctList.forEach((c: ClassType) => { if (c?.id) ctMap[String(c.id)] = c.name; });
            const insMap: Record<string, string> = {};
            insList.forEach((i: Instructor) => { if (i?.id) insMap[String(i.id)] = i.full_name; });

            setClassTypesMap(ctMap);
            setInstructorsMap(insMap);
            setSessions(list);
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudieron cargar las sesiones' });
        } finally {
            setLoading(false);
        }
    };

    const loadBookings = async (session: Session) => {
        try {
            setLoadingBookings(true);
            setSelectedSession(session);
            const data = await apiFetch(`/api/scheduling/sessions/${session.id}/bookings/`);
            setBookings(Array.isArray(data) ? data : []);
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudieron cargar las reservas' });
        } finally {
            setLoadingBookings(false);
        }
    };

    const handleCheckin = async (booking: Booking) => {
        try {
            setProcessingCheckin(booking.id);
            if (booking.has_checkin && booking.checkin_id) {
                // Remove check-in
                await apiFetch(`/api/scheduling/checkins/${booking.checkin_id}/`, { method: 'DELETE' });
                await Swal.fire({
                    icon: 'info',
                    title: 'Check-in removido',
                    text: `Se quitó el check-in de ${booking.user_name || booking.user_email}`,
                    timer: 1500,
                    showConfirmButton: false,
                });
            } else {
                // Create check-in
                await apiFetch('/api/scheduling/checkins/', {
                    method: 'POST',
                    body: JSON.stringify({ booking: booking.id, method: 'manual' }),
                });
                await Swal.fire({
                    icon: 'success',
                    title: '¡Check-in registrado!',
                    text: `${booking.user_name || booking.user_email} ha llegado`,
                    timer: 1500,
                    showConfirmButton: false,
                });
            }
            // Reload bookings
            if (selectedSession) {
                await loadBookings(selectedSession);
            }
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudo procesar el check-in' });
        } finally {
            setProcessingCheckin(null);
        }
    };

    const handleMarkNoShow = async (booking: Booking) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: '¿Marcar como No-Show?',
            text: `${booking.user_name || booking.user_email} no se presentó a la clase.`,
            showCancelButton: true,
            confirmButtonColor: '#c0392b',
            cancelButtonColor: '#6b8a1f',
            confirmButtonText: 'Sí, marcar',
            cancelButtonText: 'Cancelar',
        });
        if (!result.isConfirmed) return;

        try {
            setProcessingCheckin(booking.id);
            await apiFetch(`/api/scheduling/bookings/${booking.id}/mark_no_show/`, { method: 'POST' });
            await Swal.fire({
                icon: 'info',
                title: 'Marcado como No-Show',
                timer: 1500,
                showConfirmButton: false,
            });
            if (selectedSession) {
                await loadBookings(selectedSession);
            }
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudo marcar' });
        } finally {
            setProcessingCheckin(null);
        }
    };

    useEffect(() => {
        loadSessions(dateFilter);
    }, []);

    const getStatusBadge = (status: string, hasCheckin: boolean) => {
        if (hasCheckin || status === 'attended') {
            return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">✓ Asistió</span>;
        }
        if (status === 'no_show') {
            return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">✗ No-Show</span>;
        }
        if (status === 'waitlist') {
            return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">En espera</span>;
        }
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Reservado</span>;
    };

    const attendedCount = bookings.filter(b => b.has_checkin || b.status === 'attended').length;
    const totalCount = bookings.length;

    return (
        <main className="card space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-primary">Asistencia</p>
                    <h1 className="text-2xl font-semibold">Control de Asistencia</h1>
                    <p className="text-sm text-slate-600">Selecciona una sesión para ver y registrar la asistencia de los clientes.</p>
                </div>
                {loading && <span className="text-sm text-slate-600">Cargando...</span>}
            </div>

            {/* Date Filter */}
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                {[
                    { value: 'ayer', label: 'Ayer' },
                    { value: 'hoy', label: 'Hoy' },
                    { value: 'manana', label: 'Mañana' },
                    { value: '', label: 'Todas' },
                ].map((filter) => (
                    <button
                        key={filter.value || 'todas'}
                        type="button"
                        onClick={() => {
                            setDateFilter(filter.value as typeof dateFilter);
                            setSelectedSession(null);
                            setBookings([]);
                            loadSessions(filter.value as typeof dateFilter);
                        }}
                        className={`rounded-full border px-4 py-1.5 transition-all ${dateFilter === filter.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-slate-300 hover:border-primary/40'
                            }`}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Sessions List */}
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-slate-800">Sesiones</h2>
                    <div className="max-h-[28rem] overflow-y-auto space-y-2">
                        {sessions.length === 0 && !loading && (
                            <p className="text-slate-600 py-4">No hay sesiones programadas para este día.</p>
                        )}
                        {sessions.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => loadBookings(s)}
                                className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${selectedSession?.id === s.id
                                        ? 'border-primary bg-primary/10 shadow-md'
                                        : 'border-primary/20 bg-white/80 hover:border-primary/40 hover:shadow-sm'
                                    }`}
                            >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-base font-bold text-slate-900">
                                            {classTypesMap[String(s.class_type)] || 'Sin nombre'}
                                        </p>
                                        <p className="text-sm text-slate-600">
                                            {s.starts_at
                                                ? new Date(s.starts_at).toLocaleString('es-MX', {
                                                      day: 'numeric',
                                                      month: 'short',
                                                      year: 'numeric',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                  })
                                                : 'Sin horario'}
                                            {s.instructor && ` • ${instructorsMap[String(s.instructor)] || 'Coach'}`}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-semibold text-primary">
                                            {s.capacity} lugares
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Attendance List */}
                <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-lg font-semibold text-slate-800">
                            {selectedSession ? 'Lista de Asistencia' : 'Selecciona una sesión'}
                        </h2>
                        {selectedSession && (
                            <span className="text-sm font-semibold text-primary">
                                {attendedCount}/{totalCount} presentes
                            </span>
                        )}
                    </div>

                    {loadingBookings && (
                        <div className="flex items-center justify-center py-8">
                            <span className="text-slate-600">Cargando reservas...</span>
                        </div>
                    )}

                    {!loadingBookings && selectedSession && (
                        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                            {bookings.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center">
                                    <p className="text-slate-600">No hay reservas para esta sesión.</p>
                                </div>
                            ) : (
                                bookings.map((booking) => (
                                    <div
                                        key={booking.id}
                                        className={`rounded-2xl border px-4 py-3 transition-all ${booking.has_checkin || booking.status === 'attended'
                                                ? 'border-green-300 bg-green-50'
                                                : booking.status === 'no_show'
                                                    ? 'border-red-200 bg-red-50'
                                                    : 'border-primary/20 bg-white/80'
                                            }`}
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${booking.has_checkin || booking.status === 'attended'
                                                            ? 'bg-green-200 text-green-700'
                                                            : 'bg-primary/20 text-primary'
                                                        }`}
                                                >
                                                    {(booking.user_name || booking.user_email || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900">
                                                        {booking.user_name || 'Sin nombre'}
                                                    </p>
                                                    <p className="text-sm text-slate-600">{booking.user_email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(booking.status, booking.has_checkin)}
                                            </div>
                                        </div>
                                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            {booking.status !== 'no_show' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCheckin(booking)}
                                                        disabled={processingCheckin === booking.id}
                                                        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all disabled:opacity-50 ${booking.has_checkin
                                                                ? 'border border-slate-300 text-slate-600 hover:border-slate-400'
                                                                : 'bg-primary text-white hover:bg-primary-dark'
                                                            }`}
                                                    >
                                                        {processingCheckin === booking.id
                                                            ? 'Procesando...'
                                                            : booking.has_checkin
                                                                ? 'Quitar Check-in'
                                                                : '✓ Check-in'}
                                                    </button>
                                                    {!booking.has_checkin && booking.status !== 'attended' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMarkNoShow(booking)}
                                                            disabled={processingCheckin === booking.id}
                                                            className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                        >
                                                            No-Show
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {!selectedSession && !loadingBookings && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
                            <p className="text-slate-500">← Selecciona una sesión de la lista para ver los asistentes</p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
