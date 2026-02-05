"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import Swal from 'sweetalert2';

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

export default function Horarios() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState('');
  const [classTypesMap, setClassTypesMap] = useState<Record<string, string>>({});
  const [instructorsMap, setInstructorsMap] = useState<Record<string, string>>({});
  const [locationsMap, setLocationsMap] = useState<Record<string, string>>({});
  const [selectedClassType, setSelectedClassType] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [onlyScheduled, setOnlyScheduled] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [balance, setBalance] = useState<any>(null);
  const [userBookings, setUserBookings] = useState<any[]>([]);

  const load = useCallback(async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access') : null;
    if (!token) {
      setNeedsLogin(true);
      setIsAdminUser(false);
      return;
    }
    try {
      setLoading(true);
      const [me, data, ct, ins, loc, bal, myBookings] = await Promise.all([
        apiFetch('/api/auth/me/'),
        apiFetch('/api/scheduling/sessions/'),
        apiFetch('/api/catalog/class-types/'),
        apiFetch('/api/catalog/instructors/'),
        apiFetch('/api/studios/location/'),
        apiFetch('/api/commerce/user-credits/balance/').catch(() => null),
        apiFetch('/api/scheduling/bookings/').catch(() => []),
      ]);

      const roles = Array.isArray(me?.roles) ? me.roles : [];
      setIsAdminUser(roles.includes('admin') || roles.includes('staff'));

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
      setBalance(bal);
      setUserBookings(Array.isArray(myBookings) ? myBookings : myBookings?.results || []);
      setError('');
    } catch (err: any) {
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
      .filter((s) => (selectedClassType ? String(s.class_type) === selectedClassType : true))
      .filter((s) => (selectedInstructor ? String(s.instructor) === selectedInstructor : true))
      .filter((s) => {
        if (!selectedDate) return true;
        const starts = s.starts_at ? new Date(s.starts_at) : null;
        if (!starts) return false;
        const iso = starts.toISOString().slice(0, 10);
        return iso === selectedDate;
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [sessions, onlyScheduled, selectedClassType, selectedInstructor, selectedDate]);

  const sessionMap = useMemo(() => {
    const map = new Map<string, any>();
    sessions.forEach((s) => map.set(String(s.id), s));
    return map;
  }, [sessions]);

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

  const cancelSession = async (sessionId: string) => {
    const booking = userBookings.find(b => String(b.session) === String(sessionId) && b.status !== 'cancelled');
    if (!booking) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Cancelar reserva?',
      text: 'Se liberará tu lugar y se devolverá tu crédito (si aplica).',
      showCancelButton: true,
      confirmButtonColor: '#c0392b',
      cancelButtonColor: '#6b8a1f',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No, mantener',
    });

    if (!result.isConfirmed) return;

    try {
      await apiFetch(`/api/scheduling/bookings/${booking.id}/cancel/`, { method: 'POST' });
      await Swal.fire({
        icon: 'success',
        title: 'Reserva cancelada',
        timer: 1500,
        showConfirmButton: false,
      });
      load();
    } catch (err: any) {
      const parsed = parseErrorMessage(err, 'No se pudo cancelar');
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: parsed,
        confirmButtonColor: '#c0392b',
      });
    }
  };

  const isBooked = (sessionId: string) => {
    return userBookings.some(b => String(b.session) === String(sessionId) && b.status !== 'cancelled');
  };

  return (
    <main className="space-y-5 sm:space-y-6 card">
      <h1 className="text-2xl font-semibold">Horarios</h1>
      {needsLogin && <p className="text-sm text-slate-700">Inicia sesión en el portal para ver tus horarios.</p>}
      {isAdminUser && !needsLogin && (
        <p className="text-sm text-amber-700">Tu cuenta admin no puede reservar. Usa un perfil de cliente para agendar.</p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-700">Cargando…</p>}

      {!loading && !isAdminUser && balance && (
        <div className="flex flex-wrap items-center gap-6 p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/10 shadow-sm mb-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Tu Balance</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-primary">{balance.credits_available}</span>
              <span className="text-xs font-medium text-slate-600 uppercase">Clases</span>
            </div>
          </div>
          {balance.has_active_membership && (
            <div className="flex flex-col border-l border-primary/20 pl-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Membresía Activa</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-sm font-semibold text-slate-800">Hasta {balance.membership_ends_at ? new Date(balance.membership_ends_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : 'S/F'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <label className="space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500 tracking-tight">Clase</span>
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-primary/20 transition-all outline-none" value={selectedClassType} onChange={(e) => setSelectedClassType(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(classTypesMap).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500 tracking-tight">Coach</span>
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-primary/20 transition-all outline-none" value={selectedInstructor} onChange={(e) => setSelectedInstructor(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(instructorsMap).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500 tracking-tight">Fecha</span>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-primary/20 transition-all outline-none" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500 tracking-tight cursor-pointer pt-6">
          <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary" checked={onlyScheduled} onChange={(e) => setOnlyScheduled(e.target.checked)} />
          Solo disponibles
        </label>
      </div>

      {!loading && filteredSessions.length === 0 && !needsLogin && <p className="text-sm text-slate-700 py-10 text-center">No hay sesiones que coincidan con los filtros.</p>}

      <div className="grid gap-4">
        {filteredSessions.map((s) => {
          const time = formatCardTime(s);
          const title = classTypesMap[String(s.class_type)] || 'Clase';
          const instructor = s.instructor ? instructorsMap[String(s.instructor)] : '';
          const location = s.location ? locationsMap[String(s.location)] : '';
          const statusLabel = s.status === 'scheduled' ? 'Disponible' : s.status;
          const booked = isBooked(String(s.id));

          return (
            <div
              key={s.id}
              className={`group overflow-hidden relative p-5 rounded-2xl border transition-all duration-300 ${booked
                ? 'bg-emerald-50/50 border-emerald-200 shadow-sm'
                : 'bg-white border-slate-100 hover:border-primary/30 hover:shadow-md'
                }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">{title}</h3>
                    {booked && (
                      <span className="flex items-center gap-1 text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                        Reservado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 font-medium">{time}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {instructor && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                        <span className="font-semibold uppercase text-[10px] text-slate-400">Coach</span>
                        <span>{instructor}</span>
                      </div>
                    )}
                    {location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                        <span className="font-semibold uppercase text-[10px] text-slate-400">Sede</span>
                        <span>{location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-row items-center justify-between sm:flex-col sm:items-end gap-3 pt-4 sm:pt-0 border-t sm:border-0 border-slate-50">
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Capacidad</span>
                    <span className="text-sm font-bold text-slate-700">{s.capacity} Lugares</span>
                  </div>

                  <button
                    className={`btn px-6 py-2.5 rounded-xl font-bold transition-all ${booked
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 hover:shadow-sm'
                      : 'bg-primary text-white hover:bg-primary-dark hover:-translate-y-0.5 shadow-sm active:translate-y-0'
                      }`}
                    onClick={() => {
                      if (booked) {
                        cancelSession(String(s.id));
                      } else {
                        bookSession(String(s.id));
                      }
                    }}
                    disabled={loading || (s.status !== 'scheduled' && !booked) || (isAdminUser && !booked)}
                  >
                    {isAdminUser ? 'Solo clientes' : booked ? 'Cancelar' : s.status === 'scheduled' ? 'Reservar Lugar' : 'Agotado'}
                  </button>
                </div>
              </div>

              {booked && (
                <div className="absolute top-0 right-0 p-1 opacity-5">
                  <svg className="w-24 h-24 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}