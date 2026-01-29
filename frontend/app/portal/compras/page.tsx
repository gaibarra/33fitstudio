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
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

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

      const [ordsRes, balRes, memsRes] = await Promise.allSettled([
        apiFetch('/api/commerce/orders/'),
        apiFetch('/api/commerce/credits/balance/'),
        apiFetch('/api/commerce/memberships/'),
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
    if (balance?.credits_available) parts.push(`${balance.credits_available} créditos disponibles`);
    if (balance?.next_credit_expiration) parts.push(`Expiran: ${new Date(balance.next_credit_expiration).toLocaleDateString('es-MX')}`);
    const activeMembership = memberships.find((m) => m.status === 'active');
    if (activeMembership) {
      parts.push('Membresía activa');
      if (activeMembership.ends_at) parts.push(`Vence: ${new Date(activeMembership.ends_at).toLocaleDateString('es-MX')}`);
    }
    if (parts.length === 0) return 'Sin productos activos aún.';
    return parts.join(' · ');
  }, [balance, memberships]);

  if (!authChecked && loading) return null;

  return (
    <main className="card space-y-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Comprar productos</h1>
        <p className="text-sm text-slate-700">Activa paquetes, clases sueltas o membresías y revisa tu estado de cuenta.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3 p-4 rounded-xl border border-primary/20 bg-white/70">
          <p className="font-semibold">Nueva compra</p>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs uppercase text-slate-500">Producto</span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              <option value="">Selecciona</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {typeLabel[p.type]} · {formatMoney(p.price_cents, p.currency)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs uppercase text-slate-500">Cantidad</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs uppercase text-slate-500">Forma de pago</span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="manual">Manual / mostrador</option>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs uppercase text-slate-500">Referencia (opcional)</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
              placeholder="Folio o nota"
              value={providerRef}
              onChange={(e) => setProviderRef(e.target.value)}
            />
          </label>
          <button className="btn w-full" onClick={handlePurchase} disabled={loading}>
            {loading ? 'Procesando…' : 'Comprar y activar'}
          </button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded-xl border border-primary/20 bg-white/70 space-y-2">
            <div className="flex items-center gap-2">
              <p className="font-semibold">Estado de cuenta</p>
              {loading && <span className="text-xs text-slate-500">Actualizando…</span>}
            </div>
            <p className="text-sm text-slate-700">{entitlementSummary}</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Tus compras</p>
            <div className="grid gap-3 md:grid-cols-2">
              {orders.map((o) => (
                <div key={o.id} className="border border-primary/20 rounded-xl p-4 bg-white/70 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">Orden #{o.id.slice(0, 6)}</div>
                      <div className="text-xs text-slate-600">{formatMoney(o.total_cents, o.currency)}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${o.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {o.status === 'paid' ? 'Pagada' : 'Pendiente'}
                    </span>
                  </div>
                  {o.paid_at && <div className="text-xs text-slate-600">Pagada: {formatDate(o.paid_at)}</div>}
                  {o.provider && <div className="text-xs text-slate-600">Método: {o.provider}</div>}
                  {o.provider_ref && <div className="text-xs text-slate-600">Ref: {o.provider_ref}</div>}
                  {o.items && o.items.length > 0 && (
                    <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                      {o.items.map((it) => (
                        <li key={it.id}>{it.quantity} x {formatMoney(it.unit_price_cents, o.currency)}</li>
                      ))}
                    </ul>
                  )}
                  <div className="text-xs text-slate-500">Creada: {formatDate(o.created_at)}</div>
                </div>
              ))}
              {orders.length === 0 && <p className="text-xs text-slate-600">Aún no tienes compras registradas.</p>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
