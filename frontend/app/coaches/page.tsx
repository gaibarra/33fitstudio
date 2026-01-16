'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { apiFetch } from '../../lib/api';

type Coach = {
  id: string;
  full_name: string;
  bio?: string;
  is_active?: boolean;
};

export default function Coaches() {
  const router = useRouter();
  const [items, setItems] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/catalog/instructors/');
      const list = Array.isArray(data) ? data : data?.results || [];
      setItems(list);
    } catch (err: any) {
      const status = err?.status;
      const msg = err?.message || 'Error';
      if (status === 401) {
        await Swal.fire({ icon: 'warning', title: 'Inicia sesión', text: 'Ingresa para ver los coaches.' });
        router.push('/portal');
      } else {
        await Swal.fire({ icon: 'error', title: 'No se pudieron cargar los coaches', text: msg });
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
          <h1 className="text-2xl font-semibold">Coaches</h1>
          <p className="text-sm text-slate-700">Conoce a los coaches del estudio.</p>
        </div>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Actualizando…' : 'Recargar'}
        </button>
      </div>
      {items.length === 0 && !loading && <p className="text-sm text-slate-600">No hay coaches registrados.</p>}
      <div className="grid md:grid-cols-2 gap-3">
        {items.map((c) => (
          <div key={c.id} className="border border-primary/20 rounded-xl p-3 space-y-1">
            <div className="text-lg font-semibold">{c.full_name}</div>
            <div className="text-xs text-slate-600">{c.is_active ? 'Activo' : 'Inactivo'}</div>
            {c.bio && <p className="text-sm text-slate-700">{c.bio}</p>}
          </div>
        ))}
      </div>
    </main>
  );
}