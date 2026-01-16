'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

import { apiFetch } from '../../../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      const data = await apiFetch('/api/auth/token/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      sessionStorage.setItem('access', data.access);
      sessionStorage.setItem('refresh', data.refresh);

      const me = await apiFetch('/api/auth/me/');
      const roles: string[] = me?.roles || [];
      const destination = roles.includes('admin') || roles.includes('staff') ? '/admin' : '/clases';

      await Swal.fire({
        icon: 'success',
        title: 'Sesión iniciada',
        text: 'Bienvenido de vuelta a tu estudio.',
        timer: 1200,
        showConfirmButton: false,
      });
      router.push(destination);
    } catch (error: any) {
      await Swal.fire({
        icon: 'error',
        title: 'No pudimos autenticarte',
        text: error?.message || 'Verifica tus credenciales e inténtalo de nuevo.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="card w-full max-w-md space-y-6">
      <header className="space-y-1 text-center">
        <p className="text-sm uppercase tracking-wide text-primary">Acceso clientes</p>
        <h1 className="text-2xl font-semibold">Inicia sesión en tu portal</h1>
        <p className="text-sm text-slate-600">
          Consulta horarios, usa tus créditos y gestiona tus membresías directamente.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-left">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Correo electrónico</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-primary focus:outline-none"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
          />
        </label>

        <label className="block text-left">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contraseña</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-primary focus:outline-none"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </label>

        <button type="submit" className="btn w-full disabled:opacity-60" disabled={submitting}>
          {submitting ? 'Ingresando…' : 'Entrar a mi cuenta'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600">
        ¿Aún no tienes cuenta? <Link className="text-primary underline" href="/registro">Regístrate aquí</Link>
      </p>
      <p className="text-center text-xs text-slate-500">
        ¿Olvidaste tu contraseña? Escríbenos y te ayudamos a recuperarla.
      </p>
    </main>
  );
}