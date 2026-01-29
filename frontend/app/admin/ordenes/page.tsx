'use client';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';

type OrderItem = {
    id: string;
    product: string;
    product_name: string;
    product_type: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
};

type Order = {
    id: string;
    user: string;
    user_email: string;
    user_name: string | null;
    status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
    total_cents: number;
    currency: string;
    provider: string | null;
    provider_ref: string | null;
    paid_at: string | null;
    items: OrderItem[];
    created_at: string;
};

const statusLabels: Record<Order['status'], { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800' },
    paid: { label: 'Pagada', color: 'bg-green-100 text-green-800' },
    failed: { label: 'Fallida', color: 'bg-red-100 text-red-800' },
    refunded: { label: 'Reembolsada', color: 'bg-purple-100 text-purple-800' },
    cancelled: { label: 'Cancelada', color: 'bg-slate-100 text-slate-600' },
};

const statusOptions: { value: Order['status']; label: string }[] = [
    { value: 'pending', label: 'Pendiente' },
    { value: 'paid', label: 'Pagada' },
    { value: 'failed', label: 'Fallida' },
    { value: 'refunded', label: 'Reembolsada' },
    { value: 'cancelled', label: 'Cancelada' },
];

const PAGE_SIZE = 10;

export default function OrdenesAdmin() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrevious, setHasPrevious] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    const loadOrders = async (pageNum = 1, status = '') => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: String(pageNum),
                page_size: String(PAGE_SIZE),
                ordering: '-created_at',
            });
            if (status) params.set('status', status);

            const data = await apiFetch(`/api/commerce/orders/?${params.toString()}`);
            const list = Array.isArray(data) ? data : data?.results || [];
            setOrders(list);
            setPage(pageNum);
            setHasNext(Boolean(data?.next));
            setHasPrevious(Boolean(data?.previous));
            setTotalCount(data?.count || list.length);
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudieron cargar las órdenes' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders(1, statusFilter);
    }, []);

    const handleUpdateStatus = async (order: Order) => {
        const { value: formValues } = await Swal.fire({
            title: 'Actualizar estado',
            html: `
        <div class="space-y-3 text-left">
          <p class="text-sm text-slate-600">Orden #${order.id.slice(0, 8)} - ${formatMoney(order.total_cents, order.currency)}</p>
          <label class="block">
            <span class="text-xs font-semibold text-slate-500">Estado</span>
            <select id="swal-status" class="w-full rounded-lg border border-slate-300 px-3 py-2 mt-1">
              ${statusOptions
                    .map(
                        (opt) =>
                            `<option value="${opt.value}" ${opt.value === order.status ? 'selected' : ''}>${opt.label}</option>`
                    )
                    .join('')}
            </select>
          </label>
          <div id="swal-paid-fields" class="space-y-3 ${order.status === 'paid' ? '' : 'hidden'}">
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Método de pago</span>
              <select id="swal-provider" class="w-full rounded-lg border border-slate-300 px-3 py-2 mt-1">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="terminal">Terminal POS</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">Referencia (opcional)</span>
              <input id="swal-ref" class="w-full rounded-lg border border-slate-300 px-3 py-2 mt-1" placeholder="Folio o nota">
            </label>
          </div>
        </div>
      `,
            showCancelButton: true,
            confirmButtonText: 'Actualizar',
            confirmButtonColor: '#6b8a1f',
            cancelButtonText: 'Cancelar',
            didOpen: () => {
                const statusSelect = document.getElementById('swal-status') as HTMLSelectElement | null;
                const paidFields = document.getElementById('swal-paid-fields');
                if (statusSelect && paidFields) {
                    const toggleFields = () => {
                        paidFields.classList.toggle('hidden', statusSelect.value !== 'paid');
                    };
                    statusSelect.addEventListener('change', toggleFields);
                    toggleFields();
                }
            },
            preConfirm: () => {
                const statusValue = (document.getElementById('swal-status') as HTMLSelectElement).value as Order['status'];
                const provider = (document.getElementById('swal-provider') as HTMLSelectElement | null)?.value;
                const providerRef = (document.getElementById('swal-ref') as HTMLInputElement | null)?.value;
                return {
                    status: statusValue,
                    provider,
                    provider_ref: providerRef,
                };
            },
        });

        if (!formValues) return;

        try {
            setProcessing(order.id);
            await apiFetch(`/api/commerce/orders/${order.id}/set_status/`, {
                method: 'POST',
                body: JSON.stringify(formValues),
            });
            await Swal.fire({
                icon: 'success',
                title: 'Estado actualizado',
                timer: 1500,
                showConfirmButton: false,
            });
            loadOrders(page, statusFilter);
            setSelectedOrder(null);
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudo actualizar el estado' });
        } finally {
            setProcessing(null);
        }
    };

    const formatMoney = (cents: number, currency = 'MXN') => {
        return `${currency} $${((cents || 0) / 100).toFixed(2)}`;
    };

    const formatDate = (value: string) => {
        return new Date(value).toLocaleString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: Order['status']) => {
        const { label, color } = statusLabels[status] || { label: status, color: 'bg-slate-100 text-slate-600' };
        return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{label}</span>;
    };

    return (
        <main className="card space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-primary">Comercio</p>
                    <h1 className="text-2xl font-semibold">Órdenes</h1>
                    <p className="text-sm text-slate-600">Gestiona las órdenes de pago y confirma transacciones.</p>
                </div>
                <span className="text-sm text-slate-600">{totalCount} órdenes</span>
            </div>

            {/* Status Filter */}
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                {[
                    { value: '', label: 'Todas' },
                    { value: 'pending', label: 'Pendientes' },
                    { value: 'paid', label: 'Pagadas' },
                    { value: 'failed', label: 'Fallidas' },
                    { value: 'cancelled', label: 'Canceladas' },
                ].map((filter) => (
                    <button
                        key={filter.value || 'todas'}
                        type="button"
                        onClick={() => {
                            setStatusFilter(filter.value);
                            loadOrders(1, filter.value);
                        }}
                        className={`rounded-full border px-4 py-1.5 transition-all ${statusFilter === filter.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-slate-300 hover:border-primary/40'
                            }`}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {/* Orders Table */}
            <div className="rounded-2xl border border-primary/20 bg-white/80 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-primary/5">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Orden</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Cliente</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
                                <th className="px-4 py-3 text-center font-semibold text-slate-700">Estado</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Fecha</th>
                                <th className="px-4 py-3 text-center font-semibold text-slate-700">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        Cargando órdenes...
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        No hay órdenes
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setSelectedOrder(order)}
                                                className="font-mono text-primary hover:underline"
                                            >
                                                #{order.id.slice(0, 8)}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-medium text-slate-900">{order.user_name || 'Sin nombre'}</p>
                                                <p className="text-xs text-slate-500">{order.user_email}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold">
                                            {formatMoney(order.total_cents, order.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {getStatusBadge(order.status)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">
                                            {formatDate(order.created_at)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleUpdateStatus(order)}
                                                disabled={processing === order.id}
                                                className="text-xs font-semibold text-green-600 hover:underline disabled:opacity-50"
                                            >
                                                {processing === order.id ? 'Procesando...' : 'Cambiar estado'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold">Orden #{selectedOrder.id.slice(0, 8)}</h3>
                                <p className="text-sm text-slate-500">{formatDate(selectedOrder.created_at)}</p>
                            </div>
                            {getStatusBadge(selectedOrder.status)}
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-xs uppercase text-slate-500 font-semibold mb-2">Cliente</p>
                                <p className="font-medium">{selectedOrder.user_name || 'Sin nombre'}</p>
                                <p className="text-sm text-slate-600">{selectedOrder.user_email}</p>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-4">
                                <p className="text-xs uppercase text-slate-500 font-semibold mb-3">Productos</p>
                                {selectedOrder.items.length === 0 ? (
                                    <p className="text-slate-500 text-sm">Sin items</p>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedOrder.items.map((item) => (
                                            <div key={item.id} className="flex items-center justify-between text-sm">
                                                <div>
                                                    <p className="font-medium">{item.product_name}</p>
                                                    <p className="text-xs text-slate-500">{item.product_type} × {item.quantity}</p>
                                                </div>
                                                <span className="font-semibold">
                                                    {formatMoney(item.line_total_cents, selectedOrder.currency)}
                                                </span>
                                            </div>
                                        ))}
                                        <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                                            <span>Total</span>
                                            <span className="text-primary">
                                                {formatMoney(selectedOrder.total_cents, selectedOrder.currency)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {selectedOrder.status === 'paid' && (
                                <div className="rounded-xl bg-green-50 p-4">
                                    <p className="text-xs uppercase text-green-700 font-semibold mb-2">Información de pago</p>
                                    <p className="text-sm">
                                        <strong>Método:</strong> {selectedOrder.provider || 'No especificado'}
                                    </p>
                                    {selectedOrder.provider_ref && (
                                        <p className="text-sm">
                                            <strong>Referencia:</strong> {selectedOrder.provider_ref}
                                        </p>
                                    )}
                                    {selectedOrder.paid_at && (
                                        <p className="text-sm">
                                            <strong>Fecha:</strong> {formatDate(selectedOrder.paid_at)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end mt-6">
                            <button
                                onClick={() => handleUpdateStatus(selectedOrder)}
                                disabled={processing === selectedOrder.id}
                                className="btn w-full sm:w-auto disabled:opacity-50"
                            >
                                {processing === selectedOrder.id ? 'Procesando...' : 'Cambiar estado'}
                            </button>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="w-full sm:w-auto rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pagination */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm">
                <span className="text-slate-600">
                    Página {page} • {totalCount} órdenes en total
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => loadOrders(page - 1, statusFilter)}
                        disabled={!hasPrevious || loading}
                        className="rounded-full border border-slate-300 px-4 py-1.5 font-semibold hover:border-slate-400 disabled:opacity-40"
                    >
                        Anterior
                    </button>
                    <button
                        onClick={() => loadOrders(page + 1, statusFilter)}
                        disabled={!hasNext || loading}
                        className="rounded-full border border-primary/30 px-4 py-1.5 font-semibold text-primary hover:border-primary disabled:opacity-40"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </main>
    );
}
