'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { apiFetch } from '../../lib/api';

type ClassType = {
  id: string;
  name: string;
  description?: string;
  duration_minutes?: number;
};

const EXTRA_INFO: Record<string, {
  level: string;
  intensity: string;
  focus: string;
  calories: string;
  equipment?: string;
  benefits: string[];
}> = {
  'body jump': {
    level: 'Intermedio',
    intensity: 'Alta',
    focus: 'Cardio en trampolín con tonificación',
    calories: '500-650 kcal',
    equipment: 'Mini trampolín',
    benefits: ['Impacto bajo en articulaciones', 'Mejora de equilibrio y core', 'Quema calórica acelerada'],
  },
  'fit training': {
    level: 'Intermedio',
    intensity: 'Media-Alta',
    focus: 'Fuerza y resistencia funcional',
    calories: '450-600 kcal',
    equipment: 'Mancuernas, ligas, peso corporal',
    benefits: ['Incremento de fuerza global', 'Estabilidad y movilidad', 'Tonificación'],
  },
  'rush': {
    level: 'Avanzado',
    intensity: 'Alta',
    focus: 'Cardio HIIT en trampolín',
    calories: '550-700 kcal',
    equipment: 'Mini trampolín',
    benefits: ['Capacidad cardiovascular', 'Explosividad y agilidad', 'Quema grasa post-entreno'],
  },
  'burn 50% 50%': {
    level: 'Todos',
    intensity: 'Media',
    focus: 'Cardio + fuerza equilibrada',
    calories: '400-550 kcal',
    equipment: 'Trampolín y peso corporal',
    benefits: ['Balance entre resistencia y fuerza', 'Mejora coordinación', 'Sesión versátil'],
  },
};

export default function Clases() {
  const router = useRouter();
  const [items, setItems] = useState<ClassType[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/catalog/class-types/');
      const list = Array.isArray(data) ? data : data?.results || [];
      setItems(list);
    } catch (err: any) {
      const status = err?.status;
      const msg = err?.message || 'Error';
      if (status === 401) {
        await Swal.fire({ icon: 'warning', title: 'Inicia sesión', text: 'Ingresa para ver las clases.' });
        router.push('/portal');
      } else {
        await Swal.fire({ icon: 'error', title: 'No se pudieron cargar las clases', text: msg });
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="space-y-4 card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clases y método</h1>
          <p className="text-sm text-slate-700">Explora las clases activas del estudio.</p>
        </div>
      </div>
      {items.length === 0 && !loading && <p className="text-sm text-slate-600">No hay clases registradas.</p>}
      <div className="grid md:grid-cols-2 gap-3">
        {items.map((c) => (
          <div key={c.id} className="border border-primary/20 rounded-xl p-4 space-y-2 bg-white/40">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">{c.name}</div>
                <div className="text-xs text-slate-600">Duración: {c.duration_minutes ?? 0} min</div>
              </div>
            </div>
            {(() => {
              const info = EXTRA_INFO[c.name?.trim().toLowerCase()] || null;
              return info ? (
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-primary/10 text-primary px-2 py-1">Intensidad: {info.intensity}</span>
                    <span className="rounded-full bg-slate-200 text-slate-800 px-2 py-1">Nivel: {info.level}</span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-1">{info.calories}</span>
                  </div>
                  <p className="leading-relaxed"><strong>Enfoque:</strong> {info.focus}</p>
                  {info.equipment && <p className="text-xs text-slate-600">Equipo: {info.equipment}</p>}
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {info.benefits.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                c.description && <p className="text-sm text-slate-700">{c.description}</p>
              );
            })()}
          </div>
        ))}
      </div>
    </main>
  );
}