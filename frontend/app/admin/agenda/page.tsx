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
  location?: string;
  notes?: string;
};

type ClassType = {
  id: string;
  name: string;
};

const PAGE_SIZE = 8;

const toInputValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

export default function AgendaAdmin() {
  const [classTypeId, setClassTypeId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [message, setMessage] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [classTypesMap, setClassTypesMap] = useState<Record<string, string>>({});
  const [instructorsMap, setInstructorsMap] = useState<Record<string, string>>({});
  const [locationsMap, setLocationsMap] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [dateFilter, setDateFilter] = useState<'ayer' | 'hoy' | 'manana' | 'semana_pasada' | 'semana_proxima' | ''>('');

  const resetForm = () => {
    setClassTypeId('');
    setStartsAt('');
    setCapacity(10);
    setEditingId(null);
  };

  const loadSessions = async (pageOverride?: number, filterOverride?: typeof dateFilter) => {
    const filter = filterOverride ?? dateFilter;
    const targetPage = pageOverride ?? page ?? 1;
    try {
      setLoading(true);
      const params = new URLSearchParams({ ordering: '-starts_at' });
      params.set('page', String(targetPage));
      if (PAGE_SIZE) params.set('page_size', String(PAGE_SIZE));
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 86400000);
      const toISODate = (value: Date) => value.toISOString().split('T')[0];
      if (filter === 'hoy') {
        params.set('date', toISODate(today));
      } else if (filter === 'ayer') {
        params.set('date', toISODate(addDays(today, -1)));
      } else if (filter === 'manana') {
        params.set('date', toISODate(addDays(today, 1)));
      } else if (filter === 'semana_pasada' || filter === 'semana_proxima') {
        const currentWeekDay = today.getDay();
        const mondayOffset = currentWeekDay === 0 ? -6 : 1 - currentWeekDay;
        const mondayThisWeek = addDays(today, mondayOffset);
        const monday = filter === 'semana_pasada' ? addDays(mondayThisWeek, -7) : addDays(mondayThisWeek, 7);
        const sunday = addDays(monday, 6);
        params.set('starts_at__date__gte', toISODate(monday));
        params.set('starts_at__date__lte', toISODate(sunday));
      }
      const [data, ct, ins, loc] = await Promise.all([
        apiFetch(`/api/scheduling/sessions/?${params.toString()}`),
        apiFetch('/api/catalog/class-types/'),
        apiFetch('/api/catalog/instructors/'),
        apiFetch('/api/studios/location/'),
      ]);

      const list = Array.isArray(data) ? data : data?.results || [];
      const ctList = Array.isArray(ct) ? ct : ct?.results || [];
      const insList = Array.isArray(ins) ? ins : ins?.results || [];
      const locList = Array.isArray(loc) ? loc : loc?.results || [];

      const ctMap: Record<string, string> = {};
      ctList.forEach((c: any) => {
        if (c?.id) ctMap[String(c.id)] = c.name;
      });
      const insMap: Record<string, string> = {};
      insList.forEach((i: any) => {
        if (i?.id) insMap[String(i.id)] = i.full_name;
      });
      const locMap: Record<string, string> = {};
      locList.forEach((l: any) => {
        if (l?.id) locMap[String(l.id)] = l.name;
      });

      setClassTypes(ctList);
      setClassTypesMap(ctMap);
      setInstructorsMap(insMap);
      setLocationsMap(locMap);
      setSessions(list);
      if (Array.isArray(data)) {
        setHasNext(false);
        setHasPrevious(false);
        setPage(1);
        setPageCount(null);
      } else {
        setHasNext(Boolean(data?.next));
        setHasPrevious(Boolean(data?.previous));
        const total = typeof data?.count === 'number' ? data.count : null;
        const size = Array.isArray(data?.results) ? data.results.length : list.length;
        if (total && size) {
          setPageCount(Math.max(1, Math.ceil(total / size)));
        } else {
          setPageCount(null);
        }
        setPage(targetPage);
      }
      setMessage('');
    } catch (err: any) {
      setMessage('Error cargando sesiones: ' + (err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!classTypeId || !startsAt) {
      setMessage('Selecciona un tipo de clase y horario.');
      await Swal.fire({
        icon: 'info',
        title: 'Datos incompletos',
        text: 'Selecciona el tipo de clase y fecha para continuar.',
        confirmButtonColor: '#6b8a1f',
      });
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        class_type: classTypeId,
        starts_at: new Date(startsAt).toISOString(),
        capacity,
      };
      const url = editingId ? `/api/scheduling/sessions/${editingId}/` : '/api/scheduling/sessions/';
      const method = editingId ? 'PATCH' : 'POST';
      await apiFetch(url, { method, body: JSON.stringify(payload) });
      setMessage(editingId ? 'Sesión actualizada.' : 'Sesión creada.');
      await Swal.fire({
        icon: 'success',
        title: editingId ? 'Sesión actualizada' : 'Sesión creada',
        text: 'Los cambios se guardaron correctamente.',
        confirmButtonColor: '#6b8a1f',
      });
      resetForm();
      const refreshPage = editingId ? page : 1;
      await loadSessions(refreshPage, dateFilter);
    } catch (err: any) {
      const detail = err?.message || 'Inténtalo de nuevo en unos segundos.';
      setMessage('Error guardando sesión: ' + detail);
      await Swal.fire({
        icon: 'error',
        title: 'Error guardando sesión',
        text: detail,
        confirmButtonColor: '#c0392b',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (session: Session) => {
    setEditingId(String(session.id));
    setClassTypeId(String(session.class_type || ''));
    setStartsAt(toInputValue(session.starts_at));
    setCapacity(session.capacity || 10);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (sessionId: string) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar esta sesión?',
      text: 'Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonColor: '#c0392b',
      cancelButtonColor: '#6b8a1f',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;
    try {
      await apiFetch(`/api/scheduling/sessions/${sessionId}/`, { method: 'DELETE' });
      setMessage('Sesión eliminada.');
      await Swal.fire({
        icon: 'success',
        title: 'Sesión eliminada',
        text: 'Se quitó del calendario.',
        confirmButtonColor: '#6b8a1f',
      });
      if (editingId === sessionId) {
        resetForm();
      }
      const shouldGoPrev = sessions.length === 1 && page > 1 && !hasNext;
      await loadSessions(shouldGoPrev ? page - 1 : page, dateFilter);
    } catch (err: any) {
      const detail = err?.message || 'No se pudo eliminar. Vuelve a intentar.';
      setMessage('Error eliminando sesión: ' + detail);
      await Swal.fire({
        icon: 'error',
        title: 'Error eliminando sesión',
        text: detail,
        confirmButtonColor: '#c0392b',
      });
    }
  };

  useEffect(() => {
    loadSessions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="card space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Agenda</p>
          <h1 className="text-2xl font-semibold">Programar sesiones</h1>
          <p className="text-sm text-slate-600">Selecciona un registro para editarlo o eliminalo al instante.</p>
        </div>
        {loading && <span className="text-sm text-slate-600">Actualizando…</span>}
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <div className="rounded-2xl border border-primary/15 bg-white/80 p-4 space-y-2">
            <p className="text-sm font-semibold">{editingId ? 'Editar sesión' : 'Crear nueva sesión'}</p>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-600">Tipo de clase</span>
              <select
                className="w-full rounded-xl border border-primary/30 px-3 py-2"
                value={classTypeId}
                onChange={(e) => setClassTypeId(e.target.value)}
              >
                <option value="" disabled>
                  Selecciona una opción
                </option>
                {classTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-600">Fecha y hora</span>
              <input
                className="w-full rounded-xl border border-primary/30 px-3 py-2"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-600">Capacidad</span>
              <input
                className="w-full rounded-xl border border-primary/30 px-3 py-2"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                className="btn"
                onClick={handleSubmit}
                disabled={submitting || !classTypeId || !startsAt}
              >
                {submitting ? 'Guardando…' : editingId ? 'Actualizar sesión' : 'Programar'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-500"
                  onClick={resetForm}
                >
                  Cancelar edición
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">Tip: selecciona una sesión de la lista para traerla al formulario.</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-slate-700">El listado se actualiza automáticamente después de crear, editar o eliminar. Todos los ajustes avanzados se mantienen en el backend.</p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            {[
              { value: '', label: 'Todas' },
              { value: 'ayer', label: 'Ayer' },
              { value: 'hoy', label: 'Hoy' },
              { value: 'manana', label: 'Mañana' },
              { value: 'semana_pasada', label: 'Semana anterior' },
              { value: 'semana_proxima', label: 'Semana próxima' },
            ].map((filter) => (
              <button
                key={filter.value || 'todas'}
                type="button"
                onClick={() => {
                  setDateFilter(filter.value as typeof dateFilter);
                  loadSessions(1, filter.value as typeof dateFilter);
                }}
                className={`rounded-full border px-3 py-1 ${
                  dateFilter === filter.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-300 hover:border-primary/40'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="max-h-[24rem] overflow-y-auto space-y-2 text-sm">
            {sessions.length === 0 && <p className="text-slate-700">Sin sesiones programadas.</p>}
            {sessions.map((s) => (
              <div key={s.id} className="rounded-2xl border border-primary/20 bg-white/80 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <p className="text-base font-bold text-slate-900">{classTypesMap[String(s.class_type)] || 'Sin nombre'}</p>
                    <span className="text-slate-600">
                      Inicio:{' '}
                      {s.starts_at
                        ? new Date(s.starts_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
                        : 'Sin horario'}
                    </span>
                    <span>Capacidad: {s.capacity}</span>
                    <span>Estatus: {s.status || 'sin estatus'}</span>
                    {s.instructor && (
                      <span>Coach: {instructorsMap[String(s.instructor)] || 'Sin coach'}</span>
                    )}
                    {s.location && <span>Sede: {locationsMap[String(s.location)] || 'Sin sede'}</span>}
                    {s.notes && <span className="text-slate-600">Notas: {s.notes}</span>}
                  </div>
                  <div className="flex gap-2 text-xs font-semibold">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => handleEdit(s)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-rose-600 hover:underline"
                      onClick={() => handleDelete(String(s.id))}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 pt-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Página {page}
              {pageCount ? ` de ${pageCount}` : ''}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1 font-semibold hover:border-slate-500 disabled:opacity-40"
                onClick={() => loadSessions(Math.max(1, page - 1))}
                disabled={!hasPrevious || loading}
              >
                Anterior
              </button>
              <button
                type="button"
                className="rounded-full border border-primary/30 px-3 py-1 font-semibold text-primary hover:border-primary/60 disabled:opacity-40"
                onClick={() => loadSessions(page + 1)}
                disabled={!hasNext || loading}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </main>
  );
}