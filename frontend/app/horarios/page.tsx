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

  const load = useCallback(async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access') : null;
    if (!token) {
      setNeedsLogin(true);
      setIsAdminUser(false);
      return;
    }
    try {
      setLoading(true);
      const [me, data, ct, ins, loc] = await Promise.all([
        apiFetch('/api/auth/me/'),
        apiFetch('/api/scheduling/sessions/'),
        apiFetch('/api/catalog/class-types/'),
        apiFetch('/api/catalog/instructors/'),
        apiFetch('/api/studios/location/'),
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

  return (
    <main className="space-y-5 sm:space-y-6 card">
      <h1 className="text-2xl font-semibold">Horarios</h1>
      {needsLogin && <p className="text-sm text-slate-700">Inicia sesión en el portal para ver tus horarios.</p>}
      {isAdminUser && !needsLogin && (
        <p className="text-sm text-amber-700">Tu cuenta admin no puede reservar. Usa un perfil de cliente para agendar.</p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-700">Cargando…</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-500">Clase</span>
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={selectedClassType} onChange={(e) => setSelectedClassType(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(classTypesMap).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-500">Coach</span>
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={selectedInstructor} onChange={(e) => setSelectedInstructor(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(instructorsMap).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-500">Fecha</span>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
          <input type="checkbox" checked={onlyScheduled} onChange={(e) => setOnlyScheduled(e.target.checked)} />
          Solo disponibles
        </label>
      </div>

      {!loading && filteredSessions.length === 0 && !needsLogin && <p className="text-sm text-slate-700">No hay sesiones con esos filtros.</p>}
      <div className="grid gap-3">
        {filteredSessions.map((s) => {
          const time = formatCardTime(s);
          const title = classTypesMap[String(s.class_type)] || 'Clase';
          const instructor = s.instructor ? instructorsMap[String(s.instructor)] : '';
          const location = s.location ? locationsMap[String(s.location)] : '';
          const statusLabel = s.status === 'scheduled' ? 'Disponible' : s.status;
          return (
            <div key={s.id} className="p-4 rounded-xl bg-white/80 border border-primary/20 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-lg font-semibold">{title}</div>
                  <div className="text-xs text-slate-600">{time}</div>
                  {location && <div className="text-xs text-slate-600">Sede: {location}</div>}
                  {instructor && <div className="text-xs text-slate-600">Coach: {instructor}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs sm:flex-col sm:items-end">
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-1">Capacidad {s.capacity}</span>
                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-1">{statusLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button className="btn w-full sm:w-auto" onClick={() => bookSession(String(s.id))} disabled={loading || s.status !== 'scheduled' || isAdminUser}>
                  {isAdminUser ? 'Solo clientes' : s.status === 'scheduled' ? 'Reservar' : 'No disponible'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}