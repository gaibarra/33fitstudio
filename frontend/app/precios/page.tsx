'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { apiFetch } from '../../lib/api';

type Product = {
  id: string;
  type: 'drop_in' | 'package' | 'membership';
  name: string;
  description?: string;
  price_cents: number;
  currency: string;
  meta?: Record<string, any>;
};

const typeLabel: Record<Product['type'], string> = {
  drop_in: 'Clase suelta',
  package: 'Paquete',
  membership: 'Membresía',
};

export default function Precios() {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/catalog/products/');
      const list = Array.isArray(data) ? data : data?.results || [];
      setItems(list);
    } catch (err: any) {
      const status = err?.status;
      const msg = err?.message || 'Error';
      if (status === 401) {
        await Swal.fire({ icon: 'warning', title: 'Inicia sesión', text: 'Ingresa para ver los precios.' });
        router.push('/portal');
      } else {
        await Swal.fire({ icon: 'error', title: 'No se pudieron cargar los precios', text: msg });
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const formatExtras = (p: Product) => {
    const meta = p.meta || {};
    if (p.type === 'package') return `${meta.credits ?? 0} créditos · ${meta.expiry_days ? meta.expiry_days + ' días' : 'sin vigencia'}`;
    if (p.type === 'membership') return `${meta.duration_days ? meta.duration_days + ' días' : 'sin duración definida'}`;
    return 'Paga por clase';
  };

  return (
    <main className="space-y-5 sm:space-y-6 card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Precios</h1>
          <p className="text-sm text-slate-700">Productos activos del estudio.</p>
        </div>
      </div>
      {items.length === 0 && !loading && <p className="text-sm text-slate-600">No hay productos registrados.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((p) => (
          <div key={p.id} className="border border-primary/20 rounded-xl p-4 space-y-2">
            <div className="text-lg font-semibold">{p.name}</div>
            <div className="text-xs text-slate-600">{typeLabel[p.type]} · {p.currency} ${(p.price_cents || 0) / 100}</div>
            <div className="text-sm text-slate-700">{p.description || 'Sin descripción'}</div>
            <div className="text-xs text-slate-600">{formatExtras(p)}</div>
            <div className="pt-1">
              <a
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                href={`/portal/compras?product=${p.id}`}
              >
                Comprar
              </a>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}