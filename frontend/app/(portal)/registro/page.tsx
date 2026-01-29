'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

import { apiFetch } from '../../../lib/api';

export default function RegistroPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [acceptPolicies, setAcceptPolicies] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!acceptPolicies) {
      await Swal.fire({
        icon: 'info',
        title: 'Acepta las políticas',
        text: 'Necesitamos tu consentimiento para crear la cuenta.',
      });
      return;
    }

    if (password !== passwordConfirmation) {
      await Swal.fire({
        icon: 'error',
        title: 'Las contraseñas no coinciden',
        text: 'Verifica ambos campos antes de continuar.',
      });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/api/auth/register/', {
        method: 'POST',
        body: JSON.stringify({
          email,
          full_name: fullName,
          phone,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      await Swal.fire({
        icon: 'success',
        title: 'Cuenta creada',
        text: 'Revisa tu correo para más detalles e inicia sesión cuando gustes.',
      });
      router.push('/login');
    } catch (error: any) {
      await Swal.fire({
        icon: 'error',
        title: 'No pudimos crear tu cuenta',
        text: error?.message || 'Inténtalo de nuevo en unos minutos.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="card w-full max-w-md mx-auto space-y-6 sm:space-y-8">
      <header className="space-y-1 text-center">
        <p className="text-sm uppercase tracking-wide text-primary">Portal clientes</p>
        <h1 className="text-2xl font-semibold">Crea tu cuenta</h1>
        <p className="text-sm text-slate-600">
          Reserva tus clases, consulta el calendario del estudio y lleva control de tus créditos.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-left">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre completo</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base focus:border-primary focus:outline-none"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Tu nombre como aparecerá en reservas"
          />
        </label>

        <label className="block text-left">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Correo electrónico</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base focus:border-primary focus:outline-none"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
          />
        </label>

        <label className="block text-left">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teléfono móvil</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base focus:border-primary focus:outline-none"
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="10 dígitos"
          />
        </label>

        <label className="block text-left">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contraseña</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base focus:border-primary focus:outline-none"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </label>

        <label className="block text-left">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmar contraseña</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base focus:border-primary focus:outline-none"
            type="password"
            autoComplete="new-password"
            required
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            placeholder="Repite tu contraseña"
          />
        </label>

        <label className="flex items-start gap-3 text-sm text-slate-600">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            checked={acceptPolicies}
            onChange={(event) => setAcceptPolicies(event.target.checked)}
          />
          <span>
            Acepto las{' '}
            <Link className="underline" href="/politicas/privacidad">
              políticas de privacidad
            </Link>{' '}
            y el{' '}
            <Link className="underline" href="/politicas/terminos">
              aviso de uso del portal
            </Link>
            .
          </span>
        </label>

        <button type="submit" className="btn w-full disabled:opacity-60" disabled={submitting}>
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600">
        ¿Ya tienes acceso? <Link className="text-primary underline" href="/login">Inicia sesión</Link>
      </p>
    </main>
  );
}