"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiFetch } from '../../lib/api';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/clases', label: 'Clases' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/horarios', label: 'Horarios' },
  { href: '/precios', label: 'Precios' },
  { href: '/bio', label: 'Bio-Link', adminOnly: true },
  { href: '/admin', label: 'Admin', adminOnly: true },
];

export default function HeaderNav() {
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const didLoad = useRef(false);
  const pathname = usePathname();

  const loadUser = async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access') : null;
    if (!token) {
      setUser(null);
      setRoles([]);
      return;
    }
    try {
      setLoading(true);
      const me = await apiFetch('/api/auth/me/');
      setUser(me);
      setRoles(Array.isArray(me?.roles) ? me.roles : []);
    } catch (err) {
      // if token invalid, clear session
      sessionStorage.removeItem('access');
      sessionStorage.removeItem('refresh');
      setUser(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!didLoad.current) {
      didLoad.current = true;
    }
    loadUser();

    const onFocus = () => loadUser();
    const onStorage = () => loadUser();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      window.addEventListener('storage', onStorage);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('storage', onStorage);
      }
    };
  }, [pathname]);

  const handleLogout = () => {
    sessionStorage.removeItem('access');
    sessionStorage.removeItem('refresh');
    setUser(null);
    setRoles([]);
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const isAdmin = roles.includes('admin') || roles.includes('staff');
  const visibleLinks = isAdmin
    ? NAV_LINKS.filter((l) => l.adminOnly)
    : NAV_LINKS.filter((l) => !l.adminOnly);
  const showNav = Boolean(user);

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary text-white font-bold grid place-items-center">33</div>
        <div className="text-lg font-semibold">33 F/T Studio</div>
      </div>
      {showNav && (
        <div className="flex flex-col gap-2 sm:items-end sm:flex-row sm:gap-4 sm:justify-end w-full sm:w-auto">
          <nav className="flex gap-3 overflow-x-auto no-scrollbar text-sm font-semibold -mx-2 px-2 sm:mx-0 sm:px-0">
            {visibleLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:underline whitespace-nowrap">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            {loading && <span>Cargando…</span>}
            {!loading && user && (
              <>
                <span className="font-semibold text-slate-900">{user.email}</span>
                {roles.length > 0 && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{roles.join(', ')}</span>}
                <button type="button" className="text-primary font-semibold hover:underline" onClick={handleLogout}>
                  Salir
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
