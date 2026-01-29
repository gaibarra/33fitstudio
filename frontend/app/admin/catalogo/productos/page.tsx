'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../lib/api';
import Swal from 'sweetalert2';

type Product = {
  id: string;
  type: 'drop_in' | 'package' | 'membership';
  name: string;
  description?: string;
  price_cents: number;
  currency: string;
  meta?: Record<string, any>;
};

export default function ProductosCatalogo() {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [type, setType] = useState<'drop_in' | 'package' | 'membership'>('drop_in');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState('MXN');
  const [credits, setCredits] = useState(1);
  const [validityDays, setValidityDays] = useState(30);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const didLoad = useRef(false);
  const didCheckAuth = useRef(false);

  useEffect(() => {
    if (didCheckAuth.current) return;
    didCheckAuth.current = true;
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access') : null;
    if (!token) {
      Swal.fire({ icon: 'warning', title: 'Sesión requerida', text: 'Inicia sesión como admin.' });
      router.replace('/portal');
    }
  }, [router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/catalog/products/');
      const list = Array.isArray(data) ? data : data?.results || [];
      setItems(list);
    } catch (err: any) {
      const status = err?.status;
      const msg = err?.message || '';
      if (status === 401) {
        Swal.fire({ icon: 'warning', title: 'Sesión requerida', text: 'Inicia sesión como admin.' });
        router.push('/portal');
      } else if (status === 429 || msg.includes('429')) {
        Swal.fire({ icon: 'info', title: 'Demasiadas peticiones', text: 'Intenta de nuevo en unos segundos.' });
      } else {
        Swal.fire({ icon: 'error', title: 'Error cargando productos', text: msg });
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (didLoad.current) return undefined;
    didLoad.current = true;
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const save = async () => {
    try {
      const meta =
        type === 'package'
          ? { credits, expiry_days: validityDays }
          : type === 'membership'
            ? { duration_days: validityDays }
            : {};
      const payload = {
        type,
        name,
        description,
        price_cents: Math.round(price * 100),
        currency,
        meta,
      };
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/catalog/products/${editingId}/` : '/api/catalog/products/';
      await apiFetch(url, { method, body: JSON.stringify(payload) });
      await Swal.fire({ icon: 'success', title: editingId ? 'Producto actualizado' : 'Producto creado' });
      setType('drop_in');
      setName('');
      setDescription('');
      setPrice(0);
      setCurrency('MXN');
      setCredits(1);
      setValidityDays(30);
      setEditingId(null);
      load();
    } catch (err: any) {
      const status = err?.status;
      if (status === 401) {
        Swal.fire({ icon: 'warning', title: 'Sesión requerida', text: 'Inicia sesión como admin.' });
        router.push('/portal');
      } else {
        Swal.fire({ icon: 'error', title: 'Error guardando', text: err.message });
      }
    }
  };

  const edit = (item: Product) => {
    setEditingId(item.id);
    setType(item.type);
    setName(item.name || '');
    setDescription(item.description || '');
    setPrice((item.price_cents || 0) / 100);
    setCurrency(item.currency || 'MXN');
    const meta = item.meta || {};
    if (item.type === 'package') {
      setCredits(meta.credits ?? 1);
      setValidityDays(meta.expiry_days ?? 30);
    } else if (item.type === 'membership') {
      setValidityDays(meta.duration_days ?? 30);
    } else {
      setCredits(1);
      setValidityDays(30);
    }
  };

  const remove = async (id: string) => {
    try {
      const confirm = await Swal.fire({
        icon: 'warning',
        title: 'Eliminar producto',
        text: '¿Seguro que deseas eliminarlo? Esta acción no se puede deshacer.',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#c0392b',
      });
      if (!confirm.isConfirmed) return;
      await apiFetch(`/api/catalog/products/${id}/`, { method: 'DELETE' });
      await Swal.fire({ icon: 'success', title: 'Producto eliminado' });
      load();
    } catch (err: any) {
      const status = err?.status;
      if (status === 401) {
        Swal.fire({ icon: 'warning', title: 'Sesión requerida', text: 'Inicia sesión como admin.' });
        router.push('/portal');
      } else {
        Swal.fire({ icon: 'error', title: 'No se pudo borrar', text: err.message });
      }
    }
  };

  return (
    <main className="card space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
        <Link href="/admin/catalogo" className="text-primary hover:underline">← Catálogos</Link>
        <span className="text-slate-400">/</span>
        <span className="font-semibold">Productos</span>
        <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-1">{items.length} en total</span>
        <span className="sm:ml-auto text-xs text-slate-500">{loading ? 'Actualizando…' : 'Sincronizado'}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3 p-4 rounded-xl border border-primary/20 bg-white/60">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-800">{editingId ? 'Editar producto' : 'Nuevo producto'}</p>
            {editingId && (
              <button className="text-xs text-primary hover:underline" onClick={() => { setEditingId(null); setType('drop_in'); setName(''); setDescription(''); setPrice(0); setCurrency('MXN'); setCredits(1); setValidityDays(30); }}>Cancelar</button>
            )}
          </div>
          <label className="text-xs text-slate-500">Tipo</label>
          <select
            className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base"
            value={type}
            onChange={(e) => setType(e.target.value as Product['type'])}
          >
            <option value="drop_in">Drop-in</option>
            <option value="package">Paquete</option>
            <option value="membership">Membresía</option>
          </select>
          <label className="text-xs text-slate-500">Nombre</label>
          <input
            className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base"
            placeholder="Ej. Clase suelta"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="text-xs text-slate-500">Descripción / beneficios</label>
          <textarea
            className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base"
            placeholder="Descripción / beneficios"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="text-xs text-slate-500">Precio y moneda</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base"
              type="number"
              min={0}
              placeholder="Precio"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
            <input
              className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base"
              placeholder="Moneda"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
          {type !== 'drop_in' && (
            <div className="grid grid-cols-2 gap-2">
              {type === 'package' && (
                <input
                  className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base"
                  type="number"
                  min={1}
                  placeholder="# créditos"
                  value={credits}
                  onChange={(e) => setCredits(Number(e.target.value))}
                />
              )}
              <input
                className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base"
                type="number"
                min={1}
                placeholder={type === 'package' ? 'Vigencia (días)' : 'Duración (días)'}
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value))}
              />
            </div>
          )}
          <button className="btn w-full" onClick={save}>{editingId ? 'Actualizar' : 'Guardar'}</button>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
                placeholder="Buscar por nombre o descripción"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {items
              .filter((item) => {
                const term = search.trim().toLowerCase();
                if (!term) return true;
                return (
                  item.name?.toLowerCase().includes(term) ||
                  (item.description || '').toLowerCase().includes(term)
                );
              })
              .map((item) => {
                const meta = item.meta || {};
                const extra =
                  item.type === 'package'
                    ? `${meta.credits ?? 0} créditos · ${meta.expiry_days ? meta.expiry_days + ' días' : 'sin vigencia'}`
                    : item.type === 'membership'
                      ? `${meta.duration_days ? meta.duration_days + ' días' : 'sin duración'}`
                      : 'sin extras';
                return (
                  <div key={item.id} className="rounded-xl border border-primary/20 bg-white/80 p-4 flex flex-col gap-2 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-600 flex items-center gap-2">
                          <span className="rounded-full bg-primary/10 text-primary px-2 py-1">{item.type}</span>
                          <span className="rounded-full bg-primary/10 text-primary px-2 py-1">{item.price_cents / 100} {item.currency}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button className="text-primary hover:underline" onClick={() => edit(item)}>Editar</button>
                        <button className="text-red-700 hover:underline" onClick={() => remove(item.id)}>Borrar</button>
                      </div>
                    </div>
                    {item.description && <p className="text-sm text-slate-700">{item.description}</p>}
                    <div className="text-xs text-slate-600">{extra}</div>
                  </div>
                );
              })}
          </div>
          {items.length === 0 && <p className="text-xs text-slate-500">Sin registros.</p>}
        </div>
      </div>
    </main>
  );
}
