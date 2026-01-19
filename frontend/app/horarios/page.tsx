"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { apiFetch } from '../../lib/api';

type Balance = {
  credits_available: number;
  has_active_membership: boolean;
  membership_ends_at: string | null;
  next_credit_expiration: string | null;
};

type Booking = {
  id: string;
  status: string;
  session: string;
  session_starts_at?: string;
  session_class_name?: string;
};

type Product = {
  id: string;
  name: string;
  type: 'drop_in' | 'package' | 'membership';
  description?: string;
  price_cents: number;
  currency: string;
  meta?: Record<string, any>;
};

const parseErrorMessage = (err: any, fallback: string) => {
  const raw = err?.message || fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.join(' ');
    if (parsed && typeof parsed === 'object') return Object.values(parsed).flat().join(' ');
    return String(parsed);
  } catch (e) {
    return raw;
  }
};

const capitalize = (value?: string | null) => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export default function Horarios() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState('');
  const [classTypesMap, setClassTypesMap] = useState<Record<string, string>>({});
  const [instructorsMap, setInstructorsMap] = useState<Record<string, string>>({});
  const [locationsMap, setLocationsMap] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [onlyScheduled, setOnlyScheduled] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerName, setCustomerName] = useState('');

  const load = useCallback(async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access') : null;
    if (!token) {
      setNeedsLogin(true);
      setIsAdminUser(false);
      setBalance(null);
      setBookings([]);
      setProducts([]);
      return;
    }
    try {
      setLoading(true);
      const me = await apiFetch('/api/auth/me/');
      setCustomerName(me?.full_name || me?.email || 'Cliente');
      const [data, ct, ins, loc] = await Promise.all([
        apiFetch('/api/scheduling/sessions/'),
        apiFetch('/api/catalog/class-types/'),
        apiFetch('/api/catalog/instructors/'),
        apiFetch('/api/studios/location/'),
      ]);

      const [balanceRes, bookingsRes, productsRes] = await Promise.allSettled([
        apiFetch('/api/commerce/credits/balance/'),
        apiFetch('/api/scheduling/bookings/'),
        apiFetch('/api/catalog/products/'),
      ]);

      const roles = Array.isArray(me?.roles) ? me.roles : [];
      setIsAdminUser(roles.includes('admin') || roles.includes('staff'));
      setNeedsLogin(false);

      const list = Array.isArray(data) ? data : data?.results || [];

      const ctList = Array.isArray(ct) ? ct : ct?.results || [];
      const ctMap: Record<string, string> = {};
      ctList.forEach((c: any) => {
        if (c?.id) ctMap[String(c.id)] = c.name;
      });

      const insList = Array.isArray(ins) ? ins : ins?.results || [];
      const insMap: Record<string, string> = {};
      insList.forEach((i: any) => {
        if (i?.id) insMap[String(i.id)] = i.full_name;
      });

      const locList = Array.isArray(loc) ? loc : loc?.results || [];
      const locMap: Record<string, string> = {};
      locList.forEach((l: any) => {
        if (l?.id) locMap[String(l.id)] = l.name;
      });
      setClassTypesMap(ctMap);
      setInstructorsMap(insMap);
      setLocationsMap(locMap);
      setSessions(list);
      setBalance(balanceRes.status === 'fulfilled' ? balanceRes.value || null : null);
      const bookingsList = bookingsRes.status === 'fulfilled' ? (Array.isArray(bookingsRes.value) ? bookingsRes.value : bookingsRes.value?.results || []) : [];
      setBookings(bookingsList);
      const prodList = productsRes.status === 'fulfilled' ? (Array.isArray(productsRes.value) ? productsRes.value : productsRes.value?.results || []) : [];
      setProducts(prodList);
      setError('');
    } catch (err: any) {
      if (err?.status === 401) {
        setNeedsLogin(true);
        setIsAdminUser(false);
        setBalance(null);
        setBookings([]);
        setProducts([]);
        setError('');
        sessionStorage.removeItem('access');
        sessionStorage.removeItem('refresh');
        return;
      }
      setError(err?.message || 'No se pudieron cargar las sesiones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
    };
  }, [load]);

  const filteredSessions = useMemo(() => {
    const now = new Date();
    return sessions
      .filter((s) => {
        if (!s.starts_at) return false;
        const starts = new Date(s.starts_at);
        return starts.getTime() >= now.getTime();
      })
      .filter((s) => (onlyScheduled ? s.status === 'scheduled' : true))
      .filter((s) => {
        if (!selectedDate) return true;
        const starts = s.starts_at ? new Date(s.starts_at) : null;
        if (!starts) return false;
        const iso = starts.toISOString().slice(0, 10);
        return iso === selectedDate;
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [sessions, onlyScheduled, selectedDate]);

  const sessionMap = useMemo(() => {
    const map = new Map<string, any>();
    sessions.forEach((s) => map.set(String(s.id), s));
    return map;
  }, [sessions]);
  const sessionsLength = sessions.length;

  const formatSessionTime = (sessionId: string) => {
    const s = sessionMap.get(sessionId);
    if (!s?.starts_at) return '';
    const d = new Date(s.starts_at);
    return d.toLocaleString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatCardTime = (s: any) => {
    if (!s?.starts_at) return 'Sin horario';
    const d = new Date(s.starts_at);
    return d.toLocaleString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDateTime = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
    if (!value) return '';
    const d = new Date(value);
    return d.toLocaleString('es-MX', options || { dateStyle: 'medium', timeStyle: 'short' });
  };

  const describeBookingSlot = useCallback(
    (booking: Booking) => {
      if (!booking.session_starts_at) return '';
      const session = sessionMap.get(String(booking.session));
      const start = new Date(booking.session_starts_at);
      const weekday = capitalize(start.toLocaleDateString('es-MX', { weekday: 'long' }));
      const time = start.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
      const instructorId = session?.instructor ? String(session.instructor) : '';
      const instructorName = instructorId ? instructorsMap[instructorId] : '';
      const locationName = session?.location ? locationsMap[String(session.location)] : '';
      const slot = weekday && time ? `${weekday} ${time}` : '';
      return [slot, instructorName ? `Coach ${instructorName}` : '', locationName].filter(Boolean).join(' · ');
    },
    [sessionMap, instructorsMap, locationsMap]
  );

  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return bookings
      .filter((b) => b.status === 'booked' && b.session_starts_at && new Date(b.session_starts_at) >= now)
      .sort((a, b) => new Date(a.session_starts_at || '').getTime() - new Date(b.session_starts_at || '').getTime());
  }, [bookings]);

  const assignedScheduleSummary = useMemo(() => {
    if (loading) return 'Cargando tu horario asignado...';
    const slots = upcomingBookings.slice(0, 3).map(describeBookingSlot).filter(Boolean);
    if (slots.length) {
      return slots.join(' | ');
    }
    if (sessionsLength) {
      return 'Aún no confirmas un bloque. Usa el calendario para agendar en los horarios programados.';
    }
    return 'El estudio te notificará tu horario en cuanto esté listo.';
  }, [loading, upcomingBookings, describeBookingSlot, sessionsLength]);

  const nextBooking = upcomingBookings[0] || null;
  const creditsAvailable = balance?.credits_available ?? 0;
  const membershipActive = Boolean(balance?.has_active_membership);

  const creditSummary = useMemo(() => {
    if (!balance) return 'Sin créditos activos aún. Compra un paquete o membresía para reservar.';
    const parts: string[] = [];
    if (creditsAvailable) parts.push(`${creditsAvailable} créditos disponibles`);
    if (balance.next_credit_expiration) {
      parts.push(`Expiran ${formatDateTime(balance.next_credit_expiration, { dateStyle: 'medium' })}`);
    }
    if (membershipActive) {
      const expires = balance.membership_ends_at
        ? `hasta ${formatDateTime(balance.membership_ends_at, { dateStyle: 'medium' })}`
        : 'activa';
      parts.push(`Membresía ${expires}`);
    }
    return parts.length ? parts.join(' · ') : 'Sin créditos activos aún. Compra un paquete o membresía para reservar.';
  }, [balance, creditsAvailable, membershipActive]);

  const recommendedProduct = useMemo(() => {
    if (!products.length) return null;
    const membership = products.find((p) => p.type === 'membership');
    if (membership) return membership;
    const packageProduct = products.find((p) => p.type === 'package');
    return packageProduct || products[0];
  }, [products]);

  const agendaByDate = useMemo(() => {
    const buckets: Record<string, { label: string; timestamp: number; items: Booking[] }> = {};
    upcomingBookings.forEach((booking) => {
      if (!booking.session_starts_at) return;
      const d = new Date(booking.session_starts_at);
      const key = d.toISOString().slice(0, 10);
      if (!buckets[key]) {
        buckets[key] = {
          label: d.toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' }),
          timestamp: new Date(d.toDateString()).getTime(),
          items: [],
        };
      }
      buckets[key].items.push(booking);
    });
    return Object.values(buckets).sort((a, b) => a.timestamp - b.timestamp);
  }, [upcomingBookings]);

  const buildCalendarLink = (booking: Booking) => {
    if (!booking?.session_starts_at) return '#';
    const start = new Date(booking.session_starts_at);
    const session = sessionMap.get(String(booking.session));
    const durationMinutes = session?.duration_minutes || 60;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const formatCal = (value: Date) => value.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const details = encodeURIComponent('Reserva confirmada desde el portal 33 F/T Studio.');
    const title = encodeURIComponent(booking.session_class_name || 'Sesión 33 F/T');
    const location = session?.location ? encodeURIComponent(locationsMap[String(session.location)] || '') : '';
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatCal(start)}/${formatCal(end)}&details=${details}&location=${location}`;
  };

  const scrollToFilters = () => {
    if (typeof window === 'undefined') return;
    const target = document.getElementById('buscador');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const bookSession = async (sessionId: string) => {
    if (isAdminUser) {
      await Swal.fire({
        icon: 'info',
        title: 'Solo clientes',
        text: 'Los usuarios admin no pueden reservar. Usa una cuenta de cliente.',
        confirmButtonColor: '#6b8a1f',
      });
      return;
    }
    try {
      await apiFetch('/api/scheduling/bookings/', { method: 'POST', body: JSON.stringify({ session: sessionId }) });
      await load();
      await Swal.fire({
        icon: 'success',
        title: 'Reserva creada',
        text: 'Tu lugar quedó agendado.',
        confirmButtonColor: '#6b8a1f',
      });
    } catch (err: any) {
      const parsed = parseErrorMessage(err, 'No se pudo reservar');
      const startedOrEnded = /inici[oó]|termin[oó]/i.test(parsed);
      const when = formatSessionTime(sessionId);
      const detail = startedOrEnded
        ? `Esta sesión ya inició o terminó${when ? ` (inicio: ${when})` : ''}. Elige otra clase disponible.`
        : parsed;
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo reservar',
        text: detail,
        confirmButtonColor: '#c0392b',
      });
    }
  };

  if (needsLogin) {
    return (
      <main className="card space-y-4">
        <h1 className="text-2xl font-semibold">Tus reservas</h1>
        <p className="text-sm text-slate-700">Inicia sesión en el portal para ver y administrar tus sesiones.</p>
        <button className="btn w-full sm:w-auto" onClick={() => router.push('/portal')}>
          Ir al portal de acceso
        </button>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="card space-y-5 bg-white/90">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Tus Reservas</p>
            <h1 className="text-3xl font-semibold leading-tight">Planifica tu entrenamiento, {customerName.split(' ')[0] || 'cliente'}</h1>
            <p className="text-sm text-slate-700 max-w-xl">
              Agenda tus clases, consulta tu saldo y compra lo que necesites en un solo flujo pensado para clientes 33 F/T Studio.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a className="btn" href="#buscador">Reservar ahora</a>
              <a className="btn bg-accent text-slate-900 hover:bg-[#f7df5f]" href="/portal/compras">Comprar créditos</a>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/30 bg-white/90 p-4 space-y-2">
              <p className="text-xs uppercase text-slate-500">Créditos disponibles</p>
              <p className="text-3xl font-semibold text-primary">{creditsAvailable}</p>
              <p className="text-xs text-slate-600 leading-relaxed">{creditSummary}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-xs uppercase text-emerald-700">Próxima sesión</p>
              {nextBooking ? (
                <>
                  <p className="text-lg font-semibold text-emerald-900">{nextBooking.session_class_name || 'Clase confirmada'}</p>
                  <p className="text-sm text-emerald-800">{formatDateTime(nextBooking.session_starts_at)}</p>
                  <div className="flex flex-wrap gap-2 pt-2 text-xs">
                    <a
                      className="rounded-full bg-white px-3 py-1 text-emerald-700 font-semibold"
                      target="_blank"
                      rel="noreferrer"
                      href={buildCalendarLink(nextBooking)}
                    >
                      Agregar a calendario
                    </a>
                    <a className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800" href="#agenda">Ver agenda</a>
                  </div>
                </>
              ) : (
                <p className="text-sm text-emerald-800">Aún no tienes sesiones confirmadas. Reserva tu próxima clase 👇</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card space-y-3">
          <p className="font-semibold">Acciones rápidas</p>
          <div className="flex flex-col gap-2 text-sm">
            <a className="rounded-xl border border-primary/20 px-3 py-2 hover:border-primary/60" href="#buscador">
              <span className="block font-semibold">Reservar una clase</span>
              <span className="text-slate-600">Explora el calendario y asegura tu lugar hoy mismo.</span>
            </a>
            <a className="rounded-xl border border-primary/20 px-3 py-2 hover:border-primary/60" href="/portal/compras">
              <span className="block font-semibold">Comprar o renovar</span>
              <span className="text-slate-600">Paquetes, clases sueltas y membresías activas.</span>
            </a>
            <a className="rounded-xl border border-primary/20 px-3 py-2 hover:border-primary/60" href="#agenda">
              <span className="block font-semibold">Consultar mi calendario</span>
              <span className="text-slate-600">Revisa tu agenda confirmada y agrega recordatorios.</span>
            </a>
          </div>
        </div>
        <div className="card space-y-3">
          <p className="font-semibold">Agenda próxima</p>
          {upcomingBookings.length ? (
            <ul className="space-y-2 text-sm max-h-48 overflow-auto pr-1">
              {upcomingBookings.slice(0, 4).map((booking) => (
                <li key={booking.id} className="rounded-xl border border-slate-200 px-3 py-2">
                  <div className="font-semibold">{booking.session_class_name || 'Clase'}</div>
                  <div className="text-xs text-slate-600">{formatDateTime(booking.session_starts_at)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">Aún no tienes reservas futuras.</p>
          )}
          {upcomingBookings.length > 4 && <a className="text-sm text-primary hover:underline" href="#agenda">Ver agenda completa</a>}
        </div>
        <div className="card space-y-3">
          <p className="font-semibold">Recomendado para ti</p>
          {recommendedProduct ? (
            <div className="space-y-2 text-sm">
              <p className="text-lg font-semibold">{recommendedProduct.name}</p>
              <p className="text-slate-600">{recommendedProduct.description || 'Activa este producto para tener prioridad al reservar.'}</p>
              <button
                type="button"
                className="btn w-full"
                onClick={() => router.push(`/portal/compras?product=${recommendedProduct.id}`)}
              >
                Comprar {recommendedProduct.type === 'membership' ? 'membresía' : 'paquete'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Visita la sección de compras para ver nuevas promociones.</p>
          )}
        </div>
      </section>

      {isAdminUser && (
        <section className="card bg-amber-50 border border-amber-200 text-amber-900">
          Tu cuenta admin no puede reservar. Usa un perfil de cliente para agendar.
        </section>
      )}
      {error && <section className="card bg-rose-50 border border-rose-200 text-rose-700">{error}</section>}

      <section id="buscador" className="card space-y-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Tu horario asignado</h2>
          <p className="text-sm text-slate-600">La administración definió el bloque que te corresponde; aquí lo puedes revisar y confirmar asistencia.</p>
        </div>
        <div className="rounded-2xl border border-lime-200 bg-lime-50 p-4 space-y-1">
          <p className="text-xs uppercase font-semibold text-lime-800">Horario programado por el estudio</p>
          <p className="text-sm text-lime-900 font-medium">{assignedScheduleSummary}</p>
          <p className="text-xs text-lime-900/80">¿Necesitas un cambio? Escríbenos antes para validar disponibilidad.</p>
        </div>
        {loading && <p className="text-sm text-slate-700">Cargando calendario…</p>}
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase text-slate-500">Fecha</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <input type="checkbox" checked={onlyScheduled} onChange={(e) => setOnlyScheduled(e.target.checked)} />
            Solo disponibles
          </label>
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-600">
            Este horario es fijo. Si no puedes asistir marca la fecha y contáctanos para reprogramar.
          </div>
        </div>
      </section>

      <section id="resultados" className="card space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Agenda abierta</h2>
          <p className="text-sm text-slate-600">Selecciona el horario que mejor funcione para ti.</p>
        </div>
        {!loading && filteredSessions.length === 0 && <p className="text-sm text-slate-700">No hay sesiones con esos filtros. Ajusta los criterios o compra un nuevo paquete.</p>}
        <div className="grid gap-3">
          {filteredSessions.map((s) => {
            const time = formatCardTime(s);
            const title = classTypesMap[String(s.class_type)] || 'Clase';
            const instructor = s.instructor ? instructorsMap[String(s.instructor)] : '';
            const location = s.location ? locationsMap[String(s.location)] : '';
            const statusLabel = s.status === 'scheduled' ? 'Disponible' : s.status;
            return (
              <div key={s.id} className="p-4 rounded-xl bg-white/80 border border-primary/20 space-y-2">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-lg font-semibold">{title}</div>
                    <div className="text-xs text-slate-600">{time}</div>
                    {location && <div className="text-xs text-slate-600">Sede: {location}</div>}
                    {instructor && <div className="text-xs text-slate-600">Coach: {instructor}</div>}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-primary/10 text-primary px-3 py-1">Capacidad {s.capacity}</span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1">{statusLabel}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <button className="btn" onClick={() => bookSession(String(s.id))} disabled={loading || s.status !== 'scheduled' || isAdminUser}>
                    {isAdminUser ? 'Solo clientes' : s.status === 'scheduled' ? 'Reservar' : 'No disponible'}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary hover:underline"
                    onClick={() => router.push('/portal/compras')}
                  >
                    Necesito créditos
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="agenda" className="card space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Mi calendario confirmado</h2>
          <p className="text-sm text-slate-600">Consulta tus próximas reservas y súmalas a tu agenda personal.</p>
        </div>
        {agendaByDate.length === 0 ? (
          <p className="text-sm text-slate-600">Cuando reserves una sesión aparecerá aquí.</p>
        ) : (
          <div className="space-y-3">
            {agendaByDate.map((bucket) => (
              <div key={bucket.timestamp} className="rounded-2xl border border-slate-200 bg-white/90 p-4 space-y-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{bucket.label}</p>
                <div className="space-y-2">
                  {bucket.items.map((booking) => (
                    <div key={booking.id} className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold">{booking.session_class_name || 'Clase'}</p>
                        <p className="text-xs text-slate-600">{formatDateTime(booking.session_starts_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a
                          className="text-xs font-semibold text-primary hover:underline"
                          target="_blank"
                          rel="noreferrer"
                          href={buildCalendarLink(booking)}
                        >
                          Agregar a Google Calendar
                        </a>
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:underline"
                          onClick={scrollToFilters}
                        >
                          Reservar otra
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}