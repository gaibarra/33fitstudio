'use client';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';

type Location = {
    id: string;
    name: string;
    address: string | null;
    tz: string;
    created_at: string;
};

export default function SedesAdmin() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        tz: 'America/Mexico_City',
    });
    const [saving, setSaving] = useState(false);

    const loadLocations = async () => {
        try {
            setLoading(true);
            const data = await apiFetch('/api/studios/location/');
            const list = Array.isArray(data) ? data : data?.results || [];
            setLocations(list);
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudieron cargar las sedes' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLocations();
    }, []);

    const resetForm = () => {
        setFormData({ name: '', address: '', tz: 'America/Mexico_City' });
        setEditingId(null);
    };

    const handleEdit = (location: Location) => {
        setEditingId(location.id);
        setFormData({
            name: location.name,
            address: location.address || '',
            tz: location.tz,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            Swal.fire({ icon: 'info', title: 'Nombre requerido', text: 'Ingresa un nombre para la sede' });
            return;
        }

        try {
            setSaving(true);
            const url = editingId ? `/api/studios/location/${editingId}/` : '/api/studios/location/';
            const method = editingId ? 'PATCH' : 'POST';
            await apiFetch(url, {
                method,
                body: JSON.stringify({
                    name: formData.name,
                    address: formData.address || null,
                    tz: formData.tz,
                }),
            });
            await Swal.fire({
                icon: 'success',
                title: editingId ? 'Sede actualizada' : 'Sede creada',
                timer: 1500,
                showConfirmButton: false,
            });
            resetForm();
            loadLocations();
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudo guardar' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (location: Location) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar sede?',
            text: `${location.name} será eliminada permanentemente`,
            showCancelButton: true,
            confirmButtonColor: '#c0392b',
            cancelButtonColor: '#6b8a1f',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
        });
        if (!result.isConfirmed) return;

        try {
            await apiFetch(`/api/studios/location/${location.id}/`, { method: 'DELETE' });
            await Swal.fire({
                icon: 'success',
                title: 'Sede eliminada',
                timer: 1500,
                showConfirmButton: false,
            });
            if (editingId === location.id) resetForm();
            loadLocations();
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudo eliminar' });
        }
    };

    const timezones = [
        { value: 'America/Mexico_City', label: 'Ciudad de México (CDT)' },
        { value: 'America/Merida', label: 'Mérida (EDT)' },
        { value: 'America/Cancun', label: 'Cancún (EST)' },
        { value: 'America/Monterrey', label: 'Monterrey (CDT)' },
        { value: 'America/Tijuana', label: 'Tijuana (PDT)' },
        { value: 'America/Chihuahua', label: 'Chihuahua (MDT)' },
    ];

    return (
        <main className="card space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-primary">Configuración</p>
                    <h1 className="text-2xl font-semibold">Sedes / Ubicaciones</h1>
                    <p className="text-sm text-slate-600">Gestiona las ubicaciones físicas de tu estudio.</p>
                </div>
                {loading && <span className="text-sm text-slate-600">Cargando...</span>}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Form */}
                <div className="rounded-2xl border border-primary/20 bg-white/80 p-5 space-y-4">
                    <h2 className="text-lg font-semibold">
                        {editingId ? 'Editar sede' : 'Nueva sede'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase text-slate-500">Nombre *</span>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full rounded-xl border border-primary/30 px-4 py-2 text-base"
                                placeholder="ej. Sucursal Centro"
                                required
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase text-slate-500">Dirección</span>
                            <textarea
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full rounded-xl border border-primary/30 px-4 py-2 text-base"
                                placeholder="Calle, número, colonia, ciudad"
                                rows={2}
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase text-slate-500">Zona horaria</span>
                            <select
                                value={formData.tz}
                                onChange={(e) => setFormData({ ...formData, tz: e.target.value })}
                                className="w-full rounded-xl border border-primary/30 px-4 py-2 text-base"
                            >
                                {timezones.map((tz) => (
                                    <option key={tz.value} value={tz.value}>
                                        {tz.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <button type="submit" className="btn w-full sm:w-auto" disabled={saving}>
                                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear sede'}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="w-full sm:w-auto rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* List */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Sedes existentes</h2>
                    {locations.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                            <p className="text-slate-500">No hay sedes registradas</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {locations.map((loc) => (
                                <div
                                    key={loc.id}
                                    className={`rounded-xl border px-4 py-3 transition-all ${editingId === loc.id
                                            ? 'border-primary bg-primary/5'
                                            : 'border-primary/20 bg-white/80 hover:shadow-sm'
                                        }`}
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-900">{loc.name}</p>
                                            {loc.address && (
                                                <p className="text-sm text-slate-600 mt-0.5">{loc.address}</p>
                                            )}
                                            <p className="text-xs text-slate-500 mt-1">🕐 {loc.tz}</p>
                                        </div>
                                        <div className="flex gap-3 text-xs font-semibold">
                                            <button
                                                onClick={() => handleEdit(loc)}
                                                className="text-primary hover:underline"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => handleDelete(loc)}
                                                className="text-rose-600 hover:underline"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
