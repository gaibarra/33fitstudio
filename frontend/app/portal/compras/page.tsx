'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';

type Product = {
  id: string;
  type: 'drop_in' | 'package' | 'membership';
  name: string;
  description?: string;
  price_cents: number;
  currency: string;
  meta?: Record<string, any>;
};

type Order = {
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  total_cents: number;
  currency: string;
  provider?: string | null;
  provider_ref?: string | null;
  paid_at?: string | null;
  created_at?: string;
  items?: Array<{ id: string; product: string; quantity: number; unit_price_cents: number; line_total_cents: number }>;
};

type Balance = {
  credits_available: number;
  has_active_membership: boolean;
  membership_ends_at: string | null;
  next_credit_expiration: string | null;
};

const typeLabel: Record<Product['type'], string> = {
  drop_in: 'Clase suelta',
  package: 'Paquete',
  membership: 'Membresía',
};

export default function Compras() {
  const router = useRouter();
  const params = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [provider, setProvider] = useState('manual');
  const [providerRef, setProviderRef] = useState('');
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [viewMode, setViewMode] = useState<'movements' | 'orders'>('movements');

  const load = useCallback(async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access') : null;
    if (!token) {
      await Swal.fire({ icon: 'warning', title: 'Inicia sesión', text: 'Accede para comprar productos.' });
      router.push('/portal');
      return;
    }
    try {
      setLoading(true);
      const prods = await apiFetch('/api/catalog/products/');
      const prodList = Array.isArray(prods) ? prods : prods?.results || [];

      const [ordsRes, balRes, memsRes, bksRes] = await Promise.allSettled([
        apiFetch('/api/commerce/orders/'),
        apiFetch('/api/commerce/credits/balance/'),
        apiFetch('/api/commerce/memberships/'),
        apiFetch('/api/scheduling/bookings/'),
      ]);

      const ords = ordsRes.status === 'fulfilled' ? ordsRes.value : [];
      const bal = balRes.status === 'fulfilled' ? balRes.value : null;
      const mems = memsRes.status === 'fulfilled' ? memsRes.value : [];

      const ordList = Array.isArray(ords) ? ords : ords?.results || [];
      const memList = Array.isArray(mems) ? mems : mems?.results || [];
      setProducts(prodList);
      setOrders(ordList);
      setBalance(bal || null);
      setMemberships(memList);
      setUserBookings(bksRes.status === 'fulfilled' ? (Array.isArray(bksRes.value) ? bksRes.value : bksRes.value?.results || []) : []);
      if (!selectedProduct) {
        const pre = params.get('product');
        if (pre && prodList.some((p: Product) => p.id === pre)) setSelectedProduct(pre);
      }
    } catch (err: any) {
      const status = err?.status;
      const msg = err?.message || 'No se pudo cargar información';
      if (status === 401) {
        await Swal.fire({ icon: 'warning', title: 'Sesión requerida', text: 'Accede para comprar.' });
        router.push('/portal');
      } else {
        await Swal.fire({ icon: 'error', title: 'Error al cargar', text: msg });
      }
    } finally {
      setAuthChecked(true);
      setLoading(false);
    }
  }, [params, router, selectedProduct]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedProductObj = useMemo(() => products.find((p) => p.id === selectedProduct), [products, selectedProduct]);

  const formatMoney = (cents: number, currency?: string) => `${currency || 'MXN'} $${(cents || 0) / 100}`;

  const formatDate = (value?: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const handlePurchase = async () => {
    if (!selectedProductObj) {
      await Swal.fire({ icon: 'info', title: 'Selecciona un producto', text: 'Elige qué deseas comprar.' });
      return;
    }
    if (quantity < 1) {
      await Swal.fire({ icon: 'info', title: 'Cantidad inválida', text: 'Usa una cantidad mayor o igual a 1.' });
      return;
    }
    try {
      setLoading(true);
      await apiFetch('/api/commerce/orders/', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ product: selectedProductObj.id, quantity }],
          provider,
          provider_ref: providerRef || undefined,
        }),
      });
      await Swal.fire({
        icon: 'success',
        title: 'Orden creada',
        text: 'Quedó pendiente para validación del equipo. Se activará al confirmarla.',
      });
      setProvider('manual');
      setProviderRef('');
      setQuantity(1);
      load();
    } catch (err: any) {
      await Swal.fire({ icon: 'error', title: 'No se pudo completar la compra', text: err?.message || 'Inténtalo más tarde.' });
    } finally {
      setLoading(false);
    }
  };

  const entitlementSummary = useMemo(() => {
    const parts: string[] = [];
    if (balance?.credits_available) parts.push(`${balance.credits_available} créditos`);
    return parts.join(' · ');
  }, [balance]);

  const movements = useMemo(() => {
    const list: any[] = [];

    // Add paid orders as credit increments
    orders.filter(o => o.status === 'paid').forEach(o => {
      list.push({
        type: 'purchase',
        date: o.paid_at || o.created_at,
        title: `Compra de ${o.items?.map(it => it.quantity).reduce((a, b) => a + b, 0)} producto(s)`,
        detail: o.id.slice(0, 6),
        amount: formatMoney(o.total_cents, o.currency),
        icon: '💰',
        isPositive: true
      });
    });

    // Add bookings as usage
    userBookings.filter(b => b.status !== 'cancelled').forEach(b => {
      list.push({
        type: 'usage',
        date: b.booked_at,
        title: b.session_class_name || 'Clase entrenada',
        detail: `${new Date(b.session_starts_at).toLocaleDateString('es-MX')}`,
        amount: b.membership ? 'Membresía' : '-1 crédito',
        icon: '💪',
        isPositive: false
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, userBookings]);

  if (!authChecked && loading) return null;

  return (
    <main className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Estado de Cuenta</h1>
        <p className="text-slate-500 font-medium">Administra tus créditos, revisa tus consumos y activa nuevos paquetes.</p>
      </div>

      {/* Balance Section */}
      {!loading && balance && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/20 flex flex-col justify-between min-h-[140px]">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Créditos Disponibles</span>
            <div>
              <span className="text-4xl font-black">{balance.credits_available}</span>
              <span className="ml-2 text-sm font-medium opacity-90 uppercase tracking-tighter">Clases</span>
            </div>
            {balance.next_credit_expiration && (
              <p className="text-[10px] font-medium opacity-70 mt-2 italic">Próximo vencimiento: {new Date(balance.next_credit_expiration).toLocaleDateString()}</p>
            )}
          </div>

          {memberships.some(m => m.status === 'active') ? (
            memberships.filter(m => m.status === 'active').map(m => (
              <div key={m.id} className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Membresía Activa</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                </div>
                <p className="text-lg font-bold text-slate-800">Acceso Ilimitado</p>
                <p className="text-xs text-slate-500 font-medium">Vence el {m.ends_at ? new Date(m.ends_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : 'S/F'}</p>
              </div>
            ))
          ) : (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-center items-center text-center space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin Membresía</span>
              <p className="text-xs text-slate-500 max-w-[180px]">Obtén beneficios exclusivos con un plan mensual.</p>
            </div>
          )}

          <div className="hidden lg:flex p-6 rounded-2xl bg-accent/10 border border-accent/20 flex-col justify-center items-center text-center space-y-3">
            <span className="text-2xl">⚡</span>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">¿Listo para entrenar?</p>
            <button className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors" onClick={() => router.push('/horarios')}>Reservar Clase</button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Purchase Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="card !p-6 space-y-4 shadow-sm border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">＋</span>
              Nueva Compra
            </h2>
            <div className="space-y-4 pt-2">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Seleccionar Plan</span>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                >
                  <option value="">Elegir producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatMoney(p.price_cents, p.currency)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cantidad</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pago</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                  >
                    <option value="manual">Mostrador</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Referencia / Folio</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  placeholder="Número de pago o nota"
                  value={providerRef}
                  onChange={(e) => setProviderRef(e.target.value)}
                />
              </label>

              <button
                className="btn w-full !py-3 bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200 font-bold transition-all disabled:opacity-50"
                onClick={handlePurchase}
                disabled={loading}
              >
                {loading ? 'Procesando…' : 'Solicitar Activación'}
              </button>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-3">
            <p className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              <span className="text-lg">💡</span> ¿Cómo comprar?
            </p>
            <p className="text-xs text-emerald-800 leading-relaxed opacity-80">
              Elige tu paquete, realiza el pago y envía tu referencia. Un administrador validará tu pago y activará tus créditos en unos minutos.
            </p>
          </div>
        </div>

        {/* Right Column: Statement / Movements */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'movements' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setViewMode('movements')}
            >
              Movimientos
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setViewMode('orders')}
            >
              Historial de Compras
            </button>
          </div>

          {viewMode === 'movements' ? (
            <div className="space-y-4">
              {movements.length > 0 ? (
                <div className="relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-[2px] before:bg-slate-100">
                  {movements.map((mov, idx) => (
                    <div key={idx} className="relative flex gap-5 pb-8 last:pb-0 group">
                      <div className={`mt-1 w-10 h-10 rounded-xl flex items-center justify-center text-lg z-10 shadow-sm border transition-transform group-hover:scale-110 ${mov.isPositive ? 'bg-emerald-50 border-emerald-100' : 'bg-primary/5 border-primary/10'}`}>
                        {mov.icon}
                      </div>
                      <div className="flex-1 pt-1.5 flex justify-between items-start gap-4">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{mov.title}</p>
                          <p className="text-xs text-slate-400 font-medium">{formatDate(mov.date)} · ID: {mov.detail}</p>
                        </div>
                        <div className={`text-sm font-black whitespace-nowrap px-3 py-1 rounded-lg ${mov.isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                          {mov.isPositive ? '+' : ''} {mov.amount}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4 bg-white rounded-2xl border border-dashed border-slate-200">
                  <div className="text-4xl">📄</div>
                  <p className="text-slate-400 font-medium">No hay movimientos registrados en tu cuenta.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {orders.map((o) => (
                <div key={o.id} className="card !p-5 space-y-4 border-slate-100 shadow-sm group hover:border-primary/30 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Orden #{o.id.slice(0, 6)}</div>
                      <div className="text-lg font-bold text-slate-900">{formatMoney(o.total_cents, o.currency)}</div>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${o.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {o.status === 'paid' ? 'Pagada' : 'Pendiente'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Fecha</p>
                      <p className="text-xs font-semibold text-slate-700">{new Date(o.created_at || '').toLocaleDateString()}</p>
                    </div>
                    {o.provider && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Método</p>
                        <p className="text-xs font-semibold text-slate-700 capitalize">{o.provider}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-400 font-medium">Ref: {o.provider_ref || 'N/A'}</span>
                    {o.paid_at && <span className="text-emerald-600 font-bold">✓ Activo</span>}
                  </div>
                </div>
              ))}
              {orders.length === 0 && <p className="text-center py-20 text-slate-400 italic">No has realizado compras aún.</p>}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
