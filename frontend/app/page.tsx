"use client";

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type ClassType = {
  id: string;
  name: string;
  description?: string;
  duration_minutes?: number;
};

type Product = {
  id: string;
  type: 'drop_in' | 'package' | 'membership';
  name: string;
  description?: string;
  price_cents: number;
  currency: string;
  meta?: Record<string, any>;
};

type IconProps = { className?: string };

const MailIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-6 w-6 ${className}`}>
    <rect x="3" y="5" width="18" height="14" rx="2" strokeLinejoin="round" />
    <path d="M5 7.5 12 12l7-4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MapPinIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-6 w-6 ${className}`}>
    <path d="M12 21s6-5.25 6-10.5A6 6 0 0 0 6 10.5C6 15.75 12 21 12 21Z" strokeLinejoin="round" />
    <circle cx="12" cy="10.5" r="2" />
  </svg>
);

const InstagramIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-6 w-6 ${className}`}>
    <rect x="5" y="5" width="14" height="14" rx="4" />
    <circle cx="12" cy="12" r="3" />
    <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const TiktokIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-6 w-6 ${className}`}>
    <path d="M15 4c0 2.5 2 4.5 4.5 4.5v2.2a6.2 6.2 0 0 1-3.8-1.2v5.3a5.8 5.8 0 1 1-5.8-5.8v2.4a3.4 3.4 0 1 0 3.4 3.4V4Z" strokeLinejoin="round" />
  </svg>
);

const FacebookIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-6 w-6 ${className}`}>
    <path d="M13 21v-7h3l.5-3H13V9a1.5 1.5 0 0 1 1.5-1.5H17V4.5h-2.5A4.5 4.5 0 0 0 10 9v2.5H7v3h3V21Z" strokeLinejoin="round" />
  </svg>
);

const WhatsappIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-6 w-6 ${className}`}>
    <path d="M12 21a8.5 8.5 0 0 0 0-17 8.5 8.5 0 0 0-7.4 12.7L4 21l4.5-1.2A8.5 8.5 0 0 0 12 21Z" strokeLinejoin="round" />
    <path d="M9.5 9.8c0 2.2 2.3 4.7 4.5 4.7.5 0 1.5-.4 1.7-.9l.2-.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type ContactItem = {
  label: string;
  value: string;
  href: string;
  icon: (props: IconProps) => JSX.Element;
};

const CONTACT_ITEMS: ContactItem[] = [
  {
    label: 'Correo',
    value: 'fit33studio@hotmail.com',
    href: 'mailto:fit33studio@hotmail.com',
    icon: MailIcon,
  },
  {
    label: 'Ubicación',
    value: 'Av. Benito Juárez 97, Col. Morelos, Uruapan',
    href: 'https://www.google.com/maps/search/?api=1&query=Av.+Benito+Juarez+97,+Uruapan,+Michoacan+60050',
    icon: MapPinIcon,
  },
  {
    label: 'Instagram',
    value: '@33.fitstudio',
    href: 'https://www.instagram.com/33.fitstudio',
    icon: InstagramIcon,
  },
  {
    label: 'TikTok',
    value: '@33fitstudio',
    href: 'https://www.tiktok.com/@33fitstudio',
    icon: TiktokIcon,
  },
  {
    label: 'Facebook',
    value: '33 F/T Studio',
    href: 'https://www.facebook.com/33FTStudio',
    icon: FacebookIcon,
  },
  {
    label: 'WhatsApp',
    value: '452 105 8879',
    href: 'https://wa.me/524521058879',
    icon: WhatsappIcon,
  },
];

const typeLabel: Record<Product['type'], string> = {
  drop_in: 'Clase suelta',
  package: 'Paquete',
  membership: 'Membresía',
};

const HERO_IMAGES = [
  '/IMG_6942.JPG.jpeg',
  '/IMG_6948.JPG.jpeg',
  '/IMG_6960.JPG.jpeg',
  '/IMG_6978.JPG.jpeg',
  '/IMG_7014.JPG.jpeg',
  '/IMG_7015.JPG.jpeg',
  '/IMG_7093.JPG.jpeg',
  '/IMG_7101.JPG.jpeg',
  '/IMG_7105.JPG.jpeg',
];

const EXTRA_INFO: Record<string, {
  level: string;
  intensity: string;
  focus: string;
  calories: string;
  equipment?: string;
  benefits: string[];
}> = {
  'body jump': {
    level: 'Intermedio',
    intensity: 'Alta',
    focus: 'Cardio en trampolín con tonificación',
    calories: '500-650 kcal',
    equipment: 'Mini trampolín',
    benefits: ['Impacto bajo en articulaciones', 'Mejora de equilibrio y core', 'Quema calórica acelerada'],
  },
  'fit training': {
    level: 'Intermedio',
    intensity: 'Media-Alta',
    focus: 'Fuerza y resistencia funcional',
    calories: '450-600 kcal',
    equipment: 'Mancuernas, ligas, peso corporal',
    benefits: ['Incremento de fuerza global', 'Estabilidad y movilidad', 'Tonificación'],
  },
  rush: {
    level: 'Avanzado',
    intensity: 'Alta',
    focus: 'Cardio HIIT en trampolín',
    calories: '550-700 kcal',
    equipment: 'Mini trampolín',
    benefits: ['Capacidad cardiovascular', 'Explosividad y agilidad', 'Quema grasa post-entreno'],
  },
  'burn 50% 50%': {
    level: 'Todos',
    intensity: 'Media',
    focus: 'Cardio + fuerza equilibrada',
    calories: '400-550 kcal',
    equipment: 'Trampolín y peso corporal',
    benefits: ['Balance entre resistencia y fuerza', 'Mejora coordinación', 'Sesión versátil'],
  },
};

const formatMoney = (cents: number, currency?: string) => {
  const total = ((cents || 0) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency || 'MXN'} $${total}`;
};

const formatProductExtras = (p: Product) => {
  const meta = p.meta || {};
  if (p.type === 'package') {
    const credits = meta.credits ?? 0;
    const expiry = meta.expiry_days ? `${meta.expiry_days} días` : 'sin vigencia';
    return `${credits} créditos · ${expiry}`;
  }
  if (p.type === 'membership') {
    return meta.duration_days ? `${meta.duration_days} días de acceso` : 'Sin duración definida';
  }
  return 'Paga por clase';
};

export default function Home() {
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [needsClassLogin, setNeedsClassLogin] = useState(false);
  const [needsProductLogin, setNeedsProductLogin] = useState(false);
  const [classError, setClassError] = useState('');
  const [productError, setProductError] = useState('');
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  const hasToken = () => (typeof window !== 'undefined' ? sessionStorage.getItem('access') : null);
  const bookingHref = hasToken() ? '/horarios' : '/portal';

  const loadClassTypes = useCallback(async () => {
    if (!hasToken()) {
      setNeedsClassLogin(true);
      setClasses([]);
      return;
    }
    try {
      setLoadingClasses(true);
      setNeedsClassLogin(false);
      setClassError('');
      const data = await apiFetch('/api/catalog/class-types/');
      const list = Array.isArray(data) ? data : data?.results || [];
      setClasses(list);
    } catch (err: any) {
      if (err?.status === 401) {
        setNeedsClassLogin(true);
      } else {
        setClassError(err?.message || 'No se pudieron cargar las clases');
      }
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    if (!hasToken()) {
      setNeedsProductLogin(true);
      setProducts([]);
      return;
    }
    try {
      setLoadingProducts(true);
      setNeedsProductLogin(false);
      setProductError('');
      const data = await apiFetch('/api/catalog/products/');
      const list = Array.isArray(data) ? data : data?.results || [];
      setProducts(list);
    } catch (err: any) {
      if (err?.status === 401) {
        setNeedsProductLogin(true);
      } else {
        setProductError(err?.message || 'No se pudieron cargar los productos');
      }
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    const reload = () => {
      loadClassTypes();
      loadProducts();
    };
    reload();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', reload);
      window.addEventListener('storage', reload);
      return () => {
        window.removeEventListener('focus', reload);
        window.removeEventListener('storage', reload);
      };
    }
  }, [loadClassTypes, loadProducts]);

  useEffect(() => {
    if (HERO_IMAGES.length <= 1) return undefined;
    const interval = setInterval(() => {
      setActiveHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="space-y-8 sm:space-y-10">
      <section className="card grid gap-6 items-center md:grid-cols-2">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-primary sm:text-sm">33 F/T Studio</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight">
            Fortalece tu cuerpo, equilibra tu mente.
          </h1>
          <p className="text-sm sm:text-base text-slate-900">
            Agenda tus clases, gestiona membresías y lleva control de asistencia en un solo lugar.
          </p>
          <div className="flex gap-3 flex-wrap">
            <a className="btn w-full sm:w-auto text-center" href={bookingHref}>Reservar</a>
            <a className="btn w-full sm:w-auto bg-accent text-slate-900 hover:bg-[#f7df5f] text-center" href="#paquetes">Paquetes</a>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="relative w-full max-w-[320px] aspect-square overflow-hidden rounded-2xl bg-primary/10">
            <Image
              key={HERO_IMAGES[activeHeroIndex]}
              src={HERO_IMAGES[activeHeroIndex]}
              alt="Galería 33 F/T Studio"
              width={640}
              height={640}
              priority
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex items-center gap-2">
            {HERO_IMAGES.map((_, index) => (
              <button
                key={`hero-dot-${index}`}
                type="button"
                onClick={() => setActiveHeroIndex(index)}
                className={`h-2.5 w-2.5 rounded-full transition ${
                  index === activeHeroIndex ? 'bg-primary' : 'bg-primary/30'
                }`}
                aria-label={`Ver imagen ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="paquetes" className="card space-y-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Catálogo</p>
          <h2 className="text-2xl font-semibold">Paquetes y membresías</h2>
          <p className="text-sm text-slate-700">Activa créditos y mantiene tu membresía al día para reservar desde el portal.</p>
        </div>
        {needsProductLogin && (
          <p className="text-sm text-slate-600">
            Inicia sesión en el <a className="text-primary underline" href="/portal">portal</a> para ver y comprar tus productos activos.
          </p>
        )}
        {productError && <p className="text-sm text-rose-600">{productError}</p>}
        {loadingProducts && <p className="text-sm text-slate-600">Cargando productos…</p>}
        {!needsProductLogin && !loadingProducts && !productError && products.length === 0 && (
          <p className="text-sm text-slate-600">No hay productos registrados.</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {products.map((p) => (
            <div key={p.id} className="border border-primary/20 rounded-xl p-4 space-y-2 bg-white/80">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-600">{typeLabel[p.type]} · {formatMoney(p.price_cents, p.currency)}</div>
                </div>
                <span className="text-[11px] uppercase tracking-wide text-primary bg-primary/10 px-2 py-1 rounded-full">{typeLabel[p.type]}</span>
              </div>
              <div className="text-sm text-slate-700">{p.description || 'Sin descripción'}</div>
              <div className="text-xs text-slate-600">{formatProductExtras(p)}</div>
              <div className="pt-2">
                <a className="btn w-full text-center" href={`/portal/compras?product=${p.id}`}>
                  Comprar
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="clases" className="card space-y-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Clases</p>
          <h2 className="text-2xl font-semibold">Método y experiencias</h2>
          <p className="text-sm text-slate-700">Descubre las sesiones activas del estudio sin salir de Home.</p>
        </div>
        {needsClassLogin && (
          <p className="text-sm text-slate-600">
            Inicia sesión en el <a className="text-primary underline" href="/portal">portal</a> para consultar el catálogo de clases.
          </p>
        )}
        {classError && <p className="text-sm text-rose-600">{classError}</p>}
        {loadingClasses && <p className="text-sm text-slate-600">Cargando clases…</p>}
        {!needsClassLogin && !loadingClasses && !classError && classes.length === 0 && (
          <p className="text-sm text-slate-600">No hay clases registradas.</p>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          {classes.map((c) => (
            <div key={c.id} className="border border-primary/20 rounded-xl p-4 space-y-3 bg-white/90">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">{c.name}</div>
                  <div className="text-xs text-slate-600">Duración: {c.duration_minutes ?? 0} min</div>
                </div>
              </div>
              {(() => {
                const info = EXTRA_INFO[c.name?.trim().toLowerCase()] || null;
                return info ? (
                  <div className="space-y-2 text-sm text-slate-700">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-primary/10 text-primary px-2 py-1">Intensidad: {info.intensity}</span>
                      <span className="rounded-full bg-slate-200 text-slate-800 px-2 py-1">Nivel: {info.level}</span>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-1">{info.calories}</span>
                    </div>
                    <p className="leading-relaxed"><strong>Enfoque:</strong> {info.focus}</p>
                    {info.equipment && <p className="text-xs text-slate-600">Equipo: {info.equipment}</p>}
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {info.benefits.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  c.description && <p className="text-sm text-slate-700">{c.description}</p>
                );
              })()}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="text-lg font-semibold mb-3">Contacto directo</h3>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {CONTACT_ITEMS.map((item) => {
            const Icon = item.icon;
            const isExternal = item.href.startsWith('http');
            return (
              <a
                key={item.label}
                href={item.href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noreferrer' : undefined}
                className="flex items-start gap-3 rounded-xl border border-primary/20 bg-white/80 px-4 py-3 hover:border-primary/60 hover:bg-white transition"
              >
                <Icon className="text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-primary/80">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                </div>
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
}