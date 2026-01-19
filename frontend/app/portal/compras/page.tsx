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
  items?: Array<{ id: string; product: string; product_name?: string; quantity: number; unit_price_cents: number; line_total_cents: number }>;
};

type Booking = {
  id: string;
  status: string;
  session: string;
  session_starts_at?: string;
  session_class_name?: string;
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [provider, setProvider] = useState('manual');
  const [providerRef, setProviderRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

      const [ordsRes, balRes, memsRes, bksRes] = await Promise.allSettled([
        apiFetch('/api/commerce/orders/'),
        apiFetch('/api/commerce/credits/balance/'),
        apiFetch('/api/commerce/memberships/'),
        apiFetch('/api/scheduling/bookings/'),
      ]);

      const ords = ordsRes.status === 'fulfilled' ? ordsRes.value : [];
      const bal = balRes.status === 'fulfilled' ? balRes.value : null;
      const mems = memsRes.status === 'fulfilled' ? memsRes.value : [];
      const bks = bksRes.status === 'fulfilled' ? bksRes.value : [];

      const ordList = Array.isArray(ords) ? ords : ords?.results || [];
      const memList = Array.isArray(mems) ? mems : mems?.results || [];
      const bksList = Array.isArray(bks) ? bks : bks?.results || [];
      setProducts(prodList);
      setOrders(ordList);
      setBalance(bal || null);
      setMemberships(memList);
      setBookings(bksList);
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

  useEffect(() => {
    const paymentStatus = params.get('payment');
    const orderId = params.get('order');
    if (!paymentStatus) return;
    if (paymentStatus === 'mp_success') {
      Swal.fire({ icon: 'success', title: 'Pago aprobado', text: 'Tu orden fue pagada en Mercado Pago.' });
    } else if (paymentStatus === 'mp_failed') {
      Swal.fire({ icon: 'error', title: 'Pago no completado', text: 'No se pudo completar el pago en Mercado Pago.' });
    }
    load();
    router.replace('/portal/compras');
  }, [load, params, router]);

  const selectedProductObj = useMemo(() => products.find((p) => p.id === selectedProduct), [products, selectedProduct]);

  const paidOrders = useMemo(() => orders.filter((o) => o.status === 'paid'), [orders]);
  const purchasedProductIds = useMemo(() => {
    const set = new Set<string>();
    paidOrders.forEach((o) => {
      (o.items || []).forEach((it) => {
        if (it.product) set.add(it.product);
      });
    });
    return set;
  }, [paidOrders]);
  const canBookAnyProduct = useMemo(() => {
    // Crédito suelto o membresía activa permiten reservar cualquier clase
    return (balance?.credits_available || 0) > 0 || !!balance?.has_active_membership;
  }, [balance]);
  const hasFutureBooking = useMemo(() => {
    const now = new Date();
    return bookings.some((b) => b.status === 'booked' && b.session_starts_at && new Date(b.session_starts_at) > now);
  }, [bookings]);

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
      const order = await apiFetch('/api/commerce/orders/', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ product: selectedProductObj.id, quantity }],
          provider,
          provider_ref: providerRef || undefined,
        }),
      });
      if (provider === 'mercadopago') {
        const link = await apiFetch(`/api/commerce/orders/${order.id}/mp_link/`, { method: 'POST' });
        if (link?.init_point) {
          window.location.href = link.init_point;
          return;
        }
        await Swal.fire({ icon: 'error', title: 'No se pudo iniciar pago', text: 'Intenta nuevamente o usa otro método.' });
      } else {
        await Swal.fire({
          icon: 'success',
          title: 'Orden creada',
          text: 'Quedó pendiente para validación del equipo. Se activará al confirmarla.',
        });
      }
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

  const handleDelete = async (orderId: string) => {
    const confirm = await Swal.fire({
      icon: 'question',
      title: '¿Eliminar orden pendiente?',
      text: 'Esta orden se eliminará y no se podrá recuperar.',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!confirm.isConfirmed) return;

    try {
      setDeletingId(orderId);
      await apiFetch(`/api/commerce/orders/${orderId}/`, { method: 'DELETE' });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      await Swal.fire({ icon: 'success', title: 'Orden eliminada', text: 'Se quitó la orden pendiente.' });
    } catch (err: any) {
      await Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: err?.message || 'Inténtalo más tarde.' });
    } finally {
      setDeletingId(null);
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
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
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
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs uppercase text-slate-500">Forma de pago</span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="mercadopago">Mercado Pago (en línea)</option>
              <option value="manual">Manual / mostrador</option>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
            </select>
            {provider === 'mercadopago' && <span className="text-xs text-slate-500">Te redirigiremos a Mercado Pago para completar el pago.</span>}
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs uppercase text-slate-500">Referencia (opcional)</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
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

          <div className="p-4 rounded-xl border border-primary/20 bg-white/70 space-y-3">
            <p className="font-semibold">Estado por producto</p>
            {canBookAnyProduct && (
              <p className="text-xs text-slate-600">Tienes créditos o membresía activa: puedes reservar cualquier clase disponible.</p>
            )}
            <div className="grid md:grid-cols-2 gap-3">
              {products.map((p) => {
                const boughtSpecific = purchasedProductIds.has(p.id);
                const availableByCredits = !boughtSpecific && canBookAnyProduct;
                const bought = boughtSpecific || availableByCredits;
                const reserved = bought && hasFutureBooking;
                return (
                  <div key={p.id} className="border border-slate-200 rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{p.name}</div>
                      <span className={`text-xs px-2 py-1 rounded-full ${boughtSpecific ? 'bg-emerald-100 text-emerald-800' : availableByCredits ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-700'}`}>
                        {boughtSpecific ? 'Comprado' : availableByCredits ? 'Disponible con créditos' : 'Sin compra'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">Tipo: {typeLabel[p.type] || p.type}</div>
                    {bought && (
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span>{reserved ? 'Ya tienes una reserva próxima' : boughtSpecific ? 'Compra activa sin reserva' : 'Tienes créditos para reservar'}</span>
                        {!reserved && (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => router.push('/horarios')}
                          >
                            Reservar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {products.length === 0 && <p className="text-xs text-slate-600">No hay productos.</p>}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Tus compras</p>
            <div className="grid md:grid-cols-2 gap-3">
              {orders.map((o) => (
                <div key={o.id} className="border border-primary/20 rounded-xl p-3 bg-white/70 space-y-1 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">Orden #{o.id.slice(0, 6)}</div>
                      <div className="text-xs text-slate-600">{formatMoney(o.total_cents, o.currency)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.status === 'pending' && (
                        <button
                          type="button"
                          className="text-xs text-rose-700 hover:underline disabled:opacity-50"
                          onClick={() => handleDelete(o.id)}
                          disabled={deletingId === o.id || loading}
                        >
                          {deletingId === o.id ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${o.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {o.status === 'paid' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                  {o.paid_at && <div className="text-xs text-slate-600">Pagada: {formatDate(o.paid_at)}</div>}
                  {o.provider && <div className="text-xs text-slate-600">Método: {o.provider}</div>}
                  {o.provider_ref && <div className="text-xs text-slate-600">Ref: {o.provider_ref}</div>}
                  {o.items && o.items.length > 0 && (
                    <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                      {o.items.map((it) => (
                        <li key={it.id}>
                          {it.quantity} x {it.product_name || 'Producto'} ({formatMoney(it.unit_price_cents, o.currency)})
                        </li>
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
