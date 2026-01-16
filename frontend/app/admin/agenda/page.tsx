'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

export default function AgendaAdmin() {
  const [classTypeId, setClassTypeId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [message, setMessage] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [classTypesMap, setClassTypesMap] = useState<Record<string, string>>({});
  const [instructorsMap, setInstructorsMap] = useState<Record<string, string>>({});
  const [locationsMap, setLocationsMap] = useState<Record<string, string>>({});

  const createSession = async () => {
    try {
      await apiFetch('/api/scheduling/sessions/', { method: 'POST', body: JSON.stringify({ class_type: classTypeId, starts_at: startsAt, capacity }) });
      setMessage('Sesión creada');
      loadSessions();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const [data, ct, ins, loc] = await Promise.all([
        apiFetch('/api/scheduling/sessions/?ordering=-starts_at'),
        apiFetch('/api/catalog/class-types/'),
        apiFetch('/api/catalog/instructors/'),
        apiFetch('/api/studios/location/'),
      ]);
      const list = Array.isArray(data) ? data : data.results || [];
      const ctMap: Record<string, string> = {};
      (Array.isArray(ct) ? ct : []).forEach((c: any) => {
        if (c?.id) ctMap[String(c.id)] = c.name;
      });
      const insMap: Record<string, string> = {};
      (Array.isArray(ins) ? ins : []).forEach((i: any) => {
        if (i?.id) insMap[String(i.id)] = i.full_name;
      });
      const locMap: Record<string, string> = {};
      (Array.isArray(loc) ? loc : []).forEach((l: any) => {
        if (l?.id) locMap[String(l.id)] = l.name;
      });
      setClassTypesMap(ctMap);
      setInstructorsMap(insMap);
      setLocationsMap(locMap);
      setSessions(list);
    } catch (err: any) {
      setMessage('Error cargando sesiones: ' + (err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <main className="card space-y-4">
      <h1 className="text-2xl font-semibold">Agenda</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <input className="w-full rounded-xl border border-primary/40 px-3 py-2" placeholder="ID Tipo de clase" value={classTypeId} onChange={(e) => setClassTypeId(e.target.value)} />
          <input className="w-full rounded-xl border border-primary/40 px-3 py-2" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <input className="w-full rounded-xl border border-primary/40 px-3 py-2" type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          <button className="btn" onClick={createSession}>Programar</button>
        </div>
        <div>
          <p className="text-sm text-slate-700">Configura cancelación, waitlist y capacidad desde el backend. Esta UI es un panel mínimo.</p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold">Panorama completo</h2>
              <button className="btn" onClick={loadSessions} disabled={loading}>{loading ? 'Cargando…' : 'Recargar'}</button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 text-sm">
              {sessions.length === 0 && <p className="text-slate-700">Sin sesiones.</p>}
              {sessions.map((s) => (
                <div key={s.id} className="rounded-xl border border-primary/20 p-3 bg-white/70">
                  <div className="font-semibold">Clase: {classTypesMap[String(s.class_type)] || 'Sin nombre'}</div>
                  <div>Inicio: {s.starts_at ? new Date(s.starts_at).toLocaleString() : 'Sin horario'}</div>
                  <div>Capacidad: {s.capacity}</div>
                  <div>Estatus: {s.status}</div>
                  {s.instructor && <div>Coach: {instructorsMap[String(s.instructor)] || 'Sin coach'}</div>}
                  {s.location && <div>Sede: {locationsMap[String(s.location)] || 'Sin sede'}</div>}
                  {s.notes && <div className="text-slate-700">Notas: {s.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </main>
  );
}