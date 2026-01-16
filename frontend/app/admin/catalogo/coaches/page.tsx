'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../lib/api';
import Swal from 'sweetalert2';

type Coach = {
  id: string;
  full_name: string;
  bio?: string;
  is_active?: boolean;
};

export default function CoachesCatalogo() {
  const router = useRouter();
  const [items, setItems] = useState<Coach[]>([]);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [active, setActive] = useState(true);
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
      const data = await apiFetch('/api/catalog/instructors/');
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
        Swal.fire({ icon: 'error', title: 'Error cargando coaches', text: msg });
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

  const reset = () => {
    setName('');
    setBio('');
    setActive(true);
    setEditingId(null);
  };

  const save = async () => {
    try {
      const payload = { full_name: name, bio, is_active: active };
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/catalog/instructors/${editingId}/` : '/api/catalog/instructors/';
      await apiFetch(url, { method, body: JSON.stringify(payload) });
      await Swal.fire({ icon: 'success', title: editingId ? 'Coach actualizado' : 'Coach creado' });
      reset();
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

  const edit = (item: Coach) => {
    setEditingId(item.id);
    setName(item.full_name || '');
    setBio(item.bio || '');
    setActive(Boolean(item.is_active));
  };

  const remove = async (id: string) => {
    try {
      const confirm = await Swal.fire({
        icon: 'warning',
        title: 'Eliminar coach',
        text: '¿Seguro que deseas eliminarlo? Esta acción no se puede deshacer.',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#c0392b',
      });
      if (!confirm.isConfirmed) return;
      await apiFetch(`/api/catalog/instructors/${id}/`, { method: 'DELETE' });
      await Swal.fire({ icon: 'success', title: 'Coach eliminado' });
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
      <div className="flex items-center gap-3 text-sm text-slate-700">
        <Link href="/admin/catalogo" className="text-primary hover:underline">← Catálogos</Link>
        <span className="text-slate-400">/</span>
        <span className="font-semibold">Coaches</span>
        <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-1">{items.length} en total</span>
        <span className="ml-auto text-xs text-slate-500">{loading ? 'Actualizando…' : 'Sincronizado'}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3 p-4 rounded-xl border border-primary/20 bg-white/60">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-800">{editingId ? 'Editar coach' : 'Nuevo coach'}</p>
            {editingId && (
              <button className="text-xs text-primary hover:underline" onClick={reset}>Cancelar</button>
            )}
          </div>
          <label className="text-xs text-slate-500">Nombre completo</label>
          <input
            className="w-full rounded-xl border border-primary/40 px-3 py-2"
            placeholder="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="text-xs text-slate-500">Bio corta / certificaciones</label>
          <textarea
            className="w-full rounded-xl border border-primary/40 px-3 py-2"
            placeholder="Bio corta / certificaciones"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activo
          </label>
          <button className="btn w-full" onClick={save}>{editingId ? 'Actualizar' : 'Guardar'}</button>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Buscar por nombre o bio"
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
                  item.full_name?.toLowerCase().includes(term) ||
                  (item.bio || '').toLowerCase().includes(term)
                );
              })
              .map((item) => (
                <div key={item.id} className="rounded-xl border border-primary/20 bg-white/80 p-4 flex flex-col gap-2 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">{item.full_name}</div>
                      <div className="text-xs text-slate-600 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {item.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button className="text-primary hover:underline" onClick={() => edit(item)}>Editar</button>
                      <button className="text-red-700 hover:underline" onClick={() => remove(item.id)}>Borrar</button>
                    </div>
                  </div>
                  {item.bio && <p className="text-sm text-slate-700">{item.bio}</p>}
                </div>
              ))}
          </div>
          {items.length === 0 && <p className="text-xs text-slate-500">Sin registros.</p>}
        </div>
      </div>
    </main>
  );
}
