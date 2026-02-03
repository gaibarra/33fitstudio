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
    <main className="space-y-8 max-w-5xl mx-auto px-4 py-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Elige tu Plan</h1>
        <p className="text-slate-500 font-medium max-w-xl mx-auto">Selecciona el paquete que mejor se adapte a tu ritmo de entrenamiento y comienza hoy mismo.</p>
      </div>

      {items.length === 0 && !loading && (
        <div className="py-20 text-center space-y-4 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
          <div className="text-4xl">🏷️</div>
          <p className="text-slate-400 font-medium">No hay productos disponibles en este momento.</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => {
          const isMembership = p.type === 'membership';
          return (
            <div
              key={p.id}
              className={`relative flex flex-col p-8 rounded-3xl transition-all duration-300 hover:scale-[1.02] ${isMembership
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-200'
                  : 'bg-white border border-slate-100 shadow-lg shadow-slate-100'
                }`}
            >
              {isMembership && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-slate-900 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                  Recomendado
                </div>
              )}

              <div className="space-y-1 mb-6">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isMembership ? 'text-primary' : 'text-slate-400'}`}>
                  {typeLabel[p.type]}
                </span>
                <h3 className="text-xl font-bold">{p.name}</h3>
              </div>

              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-black">${(p.price_cents || 0) / 100}</span>
                <span className={`text-sm font-medium ${isMembership ? 'text-slate-400' : 'text-slate-500'}`}>
                  {p.currency}
                </span>
              </div>

              <div className={`space-y-4 flex-1 text-sm font-medium leading-relaxed ${isMembership ? 'text-slate-300' : 'text-slate-600'}`}>
                <p>{p.description || 'Acceso a todas las instalaciones y clases seleccionadas.'}</p>
                <div className={`pt-4 border-t ${isMembership ? 'border-slate-800' : 'border-slate-50'} flex items-center gap-3`}>
                  <span className={`p-1.5 rounded-lg ${isMembership ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'}`}>
                    {isMembership ? '🔁' : '🎟️'}
                  </span>
                  {formatExtras(p)}
                </div>
              </div>

              <div className="mt-8 pt-6">
                <button
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isMembership
                      ? 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20'
                      : 'bg-slate-50 text-slate-900 hover:bg-slate-100 border border-slate-200'
                    }`}
                  onClick={() => router.push(`/portal/compras?product=${p.id}`)}
                >
                  Continuar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center">
        <p className="text-slate-400 text-sm font-medium">¿Tienes alguna duda sobre nuestros planes?</p>
        <button className="text-primary font-bold hover:underline transition-all mt-1">Contactar con soporte</button>
      </div>
    </main>
  );
}