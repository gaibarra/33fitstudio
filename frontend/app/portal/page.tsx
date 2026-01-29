'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getApiBase } from '../../lib/api';
import Swal from 'sweetalert2';

export default function Portal() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'login' | 'register' | null>(null);
  const [apiBase, setApiBase] = useState<string>('');
  const studioId = process.env.NEXT_PUBLIC_STUDIO_ID || '';
  const router = useRouter();

  useEffect(() => {
    setApiBase(getApiBase());
  }, []);

  const handleRegister = async () => {
    router.push('/registro');
  };

  const handleLogin = async () => {
    try {
      setLoading('login');
      const data = await apiFetch('/api/auth/token/', { method: 'POST', body: JSON.stringify({ email, password }) });
      sessionStorage.setItem('access', data.access);
      sessionStorage.setItem('refresh', data.refresh);

      // obtener perfil para saber rol y decidir destino
      const me = await apiFetch('/api/auth/me/');
      const roles: string[] = Array.isArray(me?.roles) ? me.roles : [];
      const isAdmin = roles.includes('admin') || roles.includes('staff');
      const destination = isAdmin ? '/admin' : '/portal/dashboard';
      await Swal.fire({
        icon: 'success',
        title: 'Bienvenido',
        text: isAdmin ? 'Accediendo al panel administrativo.' : 'Accediendo a tu portal.',
        timer: 900,
        showConfirmButton: false,
      });
      setTimeout(() => router.push(destination), 400);
    } catch (err: any) {
      await Swal.fire({ icon: 'error', title: 'Error de acceso', text: err?.message || 'Sin detalle' });
    }
    setLoading(null);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <main className="card space-y-5 w-full max-w-md text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Bienvenido a 33 F/T Studio</h1>
          <p className="text-sm text-slate-700">Accede a tu cuenta o crea una nueva.</p>
        </div>
        <input className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded-xl border border-primary/40 px-3 py-2 text-base" placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" className="btn w-full sm:w-auto disabled:opacity-50" onClick={handleLogin} disabled={loading !== null}>
            {loading === 'login' ? 'Ingresando…' : 'Ingresar'}
          </button>
          <button type="button" className="btn w-full sm:w-auto bg-accent text-slate-900 hover:bg-[#f7df5f] disabled:opacity-50" onClick={handleRegister} disabled={loading !== null}>
            Crear cuenta
          </button>
        </div>
      </main>
    </div>
  );
}