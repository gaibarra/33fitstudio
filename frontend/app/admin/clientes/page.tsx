'use client';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';

type User = {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    is_active: boolean;
    roles: string[];
    created_at: string;
};

const PAGE_SIZE = 15;

export default function ClientesAdmin() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrevious, setHasPrevious] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    const loadUsers = async (pageNum = 1, searchTerm = '', role = '') => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: String(pageNum),
                page_size: String(PAGE_SIZE),
                ordering: '-created_at',
            });
            if (searchTerm) params.set('search', searchTerm);
            if (role) params.set('role', role);

            const data = await apiFetch(`/api/users/?${params.toString()}`);
            const list = Array.isArray(data) ? data : data?.results || [];
            setUsers(list);
            setPage(pageNum);
            setHasNext(Boolean(data?.next));
            setHasPrevious(Boolean(data?.previous));
            setTotalCount(data?.count || list.length);
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudieron cargar los usuarios' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers(1, search, roleFilter);
    }, []);

    const handleSearch = () => {
        loadUsers(1, search, roleFilter);
    };

    const handleToggleActive = async (user: User) => {
        const action = user.is_active ? 'desactivar' : 'activar';
        const result = await Swal.fire({
            icon: 'warning',
            title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} usuario?`,
            text: `${user.full_name || user.email} será ${user.is_active ? 'desactivado' : 'activado'}`,
            showCancelButton: true,
            confirmButtonColor: user.is_active ? '#c0392b' : '#6b8a1f',
            cancelButtonColor: '#64748b',
            confirmButtonText: `Sí, ${action}`,
            cancelButtonText: 'Cancelar',
        });
        if (!result.isConfirmed) return;

        try {
            setProcessing(user.id);
            await apiFetch(`/api/users/${user.id}/toggle_active/`, { method: 'POST' });
            await Swal.fire({
                icon: 'success',
                title: `Usuario ${user.is_active ? 'desactivado' : 'activado'}`,
                timer: 1500,
                showConfirmButton: false,
            });
            loadUsers(page, search, roleFilter);
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudo actualizar' });
        } finally {
            setProcessing(null);
        }
    };

    const handleAddRole = async (user: User, role: string) => {
        try {
            setProcessing(user.id);
            await apiFetch(`/api/users/${user.id}/add_role/`, {
                method: 'POST',
                body: JSON.stringify({ role }),
            });
            await Swal.fire({
                icon: 'success',
                title: `Rol ${role} agregado`,
                timer: 1500,
                showConfirmButton: false,
            });
            loadUsers(page, search, roleFilter);
            setSelectedUser(null);
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudo agregar el rol' });
        } finally {
            setProcessing(null);
        }
    };

    const handleRemoveRole = async (user: User, role: string) => {
        try {
            setProcessing(user.id);
            await apiFetch(`/api/users/${user.id}/remove_role/`, {
                method: 'POST',
                body: JSON.stringify({ role }),
            });
            await Swal.fire({
                icon: 'info',
                title: `Rol ${role} removido`,
                timer: 1500,
                showConfirmButton: false,
            });
            loadUsers(page, search, roleFilter);
            setSelectedUser(null);
        } catch (err: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.message || 'No se pudo remover el rol' });
        } finally {
            setProcessing(null);
        }
    };

    const getRoleBadge = (role: string) => {
        const colors: Record<string, string> = {
            admin: 'bg-purple-100 text-purple-700',
            staff: 'bg-blue-100 text-blue-700',
            customer: 'bg-green-100 text-green-700',
        };
        return (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[role] || 'bg-slate-100 text-slate-700'}`}>
                {role}
            </span>
        );
    };

    const formatDate = (value: string) => {
        return new Date(value).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <main className="card space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-primary">Administración</p>
                    <h1 className="text-2xl font-semibold">Clientes</h1>
                    <p className="text-sm text-slate-600">Gestiona los usuarios registrados en tu estudio.</p>
                </div>
                <span className="text-sm text-slate-600">{totalCount} usuarios</span>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <div className="flex flex-1 min-w-[200px] flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        placeholder="Buscar por email, nombre o teléfono..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="flex-1 rounded-xl border border-primary/30 px-4 py-2 text-base"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="btn w-full sm:w-auto"
                    >
                        Buscar
                    </button>
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => {
                        setRoleFilter(e.target.value);
                        loadUsers(1, search, e.target.value);
                    }}
                    className="rounded-xl border border-primary/30 px-3 py-2 text-base"
                >
                    <option value="">Todos los roles</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="customer">Cliente</option>
                </select>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl border border-primary/20 bg-white/80 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-primary/5">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Usuario</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Teléfono</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Roles</th>
                                <th className="px-4 py-3 text-center font-semibold text-slate-700">Estado</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Registro</th>
                                <th className="px-4 py-3 text-center font-semibold text-slate-700">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        Cargando usuarios...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        No se encontraron usuarios
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-medium text-slate-900">{user.full_name || 'Sin nombre'}</p>
                                                <p className="text-xs text-slate-500">{user.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{user.phone || '-'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {user.roles.map((role) => (
                                                    <span key={role}>{getRoleBadge(role)}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {user.is_active ? (
                                                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                                    Activo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                                    Inactivo
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(user.created_at)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                                                    className="text-xs font-semibold text-primary hover:underline"
                                                >
                                                    Roles
                                                </button>
                                                <button
                                                    onClick={() => handleToggleActive(user)}
                                                    disabled={processing === user.id}
                                                    className={`text-xs font-semibold hover:underline disabled:opacity-50 ${user.is_active ? 'text-rose-600' : 'text-green-600'
                                                        }`}
                                                >
                                                    {user.is_active ? 'Desactivar' : 'Activar'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Role Management Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <h3 className="text-lg font-semibold mb-4">Gestionar roles</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            {selectedUser.full_name || selectedUser.email}
                        </p>
                        <div className="space-y-3 mb-6">
                            <p className="text-xs uppercase text-slate-500 font-semibold">Roles actuales:</p>
                            <div className="flex flex-wrap gap-2">
                                {selectedUser.roles.length === 0 ? (
                                    <span className="text-slate-500 text-sm">Sin roles</span>
                                ) : (
                                    selectedUser.roles.map((role) => (
                                        <button
                                            key={role}
                                            onClick={() => handleRemoveRole(selectedUser, role)}
                                            disabled={processing === selectedUser.id}
                                            className="group relative"
                                        >
                                            {getRoleBadge(role)}
                                            <span className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center text-xs">
                                                ×
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                            <p className="text-xs uppercase text-slate-500 font-semibold mt-4">Agregar rol:</p>
                            <div className="flex flex-wrap gap-2">
                                {['admin', 'staff', 'customer'].filter(r => !selectedUser.roles.includes(r)).map((role) => (
                                    <button
                                        key={role}
                                        onClick={() => handleAddRole(selectedUser, role)}
                                        disabled={processing === selectedUser.id}
                                        className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary disabled:opacity-50"
                                    >
                                        + {role}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-end">
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 w-full sm:w-auto"
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
                    Página {page} • {totalCount} usuarios en total
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => loadUsers(page - 1, search, roleFilter)}
                        disabled={!hasPrevious || loading}
                        className="rounded-full border border-slate-300 px-4 py-1.5 font-semibold hover:border-slate-400 disabled:opacity-40"
                    >
                        Anterior
                    </button>
                    <button
                        onClick={() => loadUsers(page + 1, search, roleFilter)}
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
