"use client";

import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';

const parseError = (err: any, fallback: string) => {
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

export default function PerfilPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access') : null;
    if (!token) {
      setNeedsLogin(true);
      setError('Inicia sesión en el portal para editar tu perfil.');
      return;
    }
    try {
      setLoading(true);
      const me = await apiFetch('/api/auth/me/');
      setFullName(me?.full_name || '');
      setPhone(me?.phone || '');
      setEmail(me?.email || '');
      setNeedsLogin(false);
      setError('');
    } catch (err: any) {
      if (err?.status === 401) {
        setNeedsLogin(true);
        sessionStorage.removeItem('access');
        sessionStorage.removeItem('refresh');
        setError('Tu sesión caducó. Vuelve a iniciar sesión.');
        return;
      }
      setError(parseError(err, 'No se pudo cargar tu perfil.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsLogin) return;
    try {
      setSaving(true);
      setError('');
      await apiFetch('/api/auth/me/', {
        method: 'PUT',
        body: JSON.stringify({ email, full_name: fullName, phone }),
      });
      await Swal.fire({
        icon: 'success',
        title: 'Perfil actualizado',
        text: 'Tus datos se guardaron correctamente.',
        confirmButtonColor: '#6b8a1f',
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('focus'));
      }
    } catch (err: any) {
      setError(parseError(err, 'No se pudo actualizar tu perfil.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="card max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tu perfil</h1>
        <p className="text-sm text-slate-600">Actualiza tu nombre y teléfono para que el equipo pueda contactarte.</p>
      </div>
      {needsLogin && (
        <p className="text-sm text-amber-700">Inicia sesión en el portal para administrar tu perfil.</p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-500">Correo</span>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-500">Nombre completo</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
            placeholder="Tu nombre"
            required
            disabled={loading || needsLogin}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-500">Teléfono</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
            placeholder="10 dígitos"
            disabled={loading || needsLogin}
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            className="btn"
            disabled={saving || loading || needsLogin}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </main>
  );
}
