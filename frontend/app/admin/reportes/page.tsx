'use client';
import { useEffect, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';

type MetricCard = {
  label: string;
  value: string | number;
  subtext?: string;
  icon: string;
  color: string;
};

type SessionStat = {
  id: string;
  class_name: string;
  starts_at: string;
  capacity: number;
  booked: number;
  attended: number;
  no_show: number;
};

type ClassTypeStat = {
  name: string;
  count: number;
  attended: number;
};

// CSV Export utilities
const escapeCSVValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const generateCSV = (headers: string[], rows: (string | number | null | undefined)[][]): string => {
  const headerLine = headers.map(escapeCSVValue).join(',');
  const dataLines = rows.map(row => row.map(escapeCSVValue).join(','));
  return [headerLine, ...dataLines].join('\n');
};

const downloadCSV = (content: string, filename: string): void => {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function Reportes() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<'hoy' | 'semana' | 'mes'>('semana');
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStat[]>([]);
  const [classTypeStats, setClassTypeStats] = useState<ClassTypeStat[]>([]);
  const [reportPeriod, setReportPeriod] = useState({ start: '', end: '' });

  const loadReports = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 86400000);
      const toISODate = (value: Date) => value.toISOString().split('T')[0];

      let startDate: string;
      let endDate = toISODate(today);

      if (dateRange === 'hoy') {
        startDate = toISODate(today);
      } else if (dateRange === 'semana') {
        startDate = toISODate(addDays(today, -7));
      } else {
        startDate = toISODate(addDays(today, -30));
      }

      // Store the report period for exports
      setReportPeriod({ start: startDate, end: endDate });

      // Fetch sessions with bookings
      const params = new URLSearchParams({
        starts_at__date__gte: startDate,
        starts_at__date__lte: endDate,
        ordering: '-starts_at',
      });

      const [sessions, bookings, classTypes] = await Promise.all([
        apiFetch(`/api/scheduling/sessions/?${params.toString()}`),
        apiFetch('/api/scheduling/bookings/'),
        apiFetch('/api/catalog/class-types/'),
      ]);

      const sessionList = Array.isArray(sessions) ? sessions : sessions?.results || [];
      const bookingList = Array.isArray(bookings) ? bookings : bookings?.results || [];
      const classTypeList = Array.isArray(classTypes) ? classTypes : classTypes?.results || [];

      // Build class type map
      const ctMap: Record<string, string> = {};
      classTypeList.forEach((ct: any) => {
        ctMap[String(ct.id)] = ct.name;
      });

      // Calculate metrics
      const totalSessions = sessionList.length;
      const totalCapacity = sessionList.reduce((sum: number, s: any) => sum + (s.capacity || 0), 0);

      // Get booking stats by session
      const bookingsBySession: Record<string, { booked: number; attended: number; no_show: number; waitlist: number }> = {};
      bookingList.forEach((b: any) => {
        const sid = String(b.session);
        if (!bookingsBySession[sid]) {
          bookingsBySession[sid] = { booked: 0, attended: 0, no_show: 0, waitlist: 0 };
        }
        if (b.status === 'booked') bookingsBySession[sid].booked++;
        else if (b.status === 'attended') bookingsBySession[sid].attended++;
        else if (b.status === 'no_show') bookingsBySession[sid].no_show++;
        else if (b.status === 'waitlist') bookingsBySession[sid].waitlist++;
      });

      let totalBooked = 0;
      let totalAttended = 0;
      let totalNoShow = 0;

      Object.values(bookingsBySession).forEach((stats) => {
        totalBooked += stats.booked + stats.attended + stats.no_show;
        totalAttended += stats.attended;
        totalNoShow += stats.no_show;
      });

      const occupancyRate = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;
      const attendanceRate = totalBooked > 0 ? Math.round((totalAttended / totalBooked) * 100) : 0;
      const noShowRate = totalBooked > 0 ? Math.round((totalNoShow / totalBooked) * 100) : 0;

      setMetrics([
        {
          label: 'Sesiones',
          value: totalSessions,
          subtext: 'programadas',
          icon: '📅',
          color: 'bg-blue-100 text-blue-700',
        },
        {
          label: 'Ocupación',
          value: `${occupancyRate}%`,
          subtext: `${totalBooked} de ${totalCapacity} lugares`,
          icon: '📊',
          color: 'bg-primary/20 text-primary',
        },
        {
          label: 'Asistencia',
          value: `${attendanceRate}%`,
          subtext: `${totalAttended} asistieron`,
          icon: '✓',
          color: 'bg-green-100 text-green-700',
        },
        {
          label: 'No-Shows',
          value: `${noShowRate}%`,
          subtext: `${totalNoShow} no se presentaron`,
          icon: '✗',
          color: 'bg-red-100 text-red-700',
        },
      ]);

      // Build session stats
      const sessStats: SessionStat[] = sessionList.slice(0, 10).map((s: any) => {
        const stats = bookingsBySession[String(s.id)] || { booked: 0, attended: 0, no_show: 0, waitlist: 0 };
        return {
          id: s.id,
          class_name: ctMap[String(s.class_type)] || 'Sin nombre',
          starts_at: s.starts_at,
          capacity: s.capacity,
          booked: stats.booked + stats.attended + stats.no_show,
          attended: stats.attended,
          no_show: stats.no_show,
        };
      });
      setSessionStats(sessStats);

      // Class type stats
      const ctStats: Record<string, { count: number; attended: number }> = {};
      sessionList.forEach((s: any) => {
        const name = ctMap[String(s.class_type)] || 'Otro';
        if (!ctStats[name]) ctStats[name] = { count: 0, attended: 0 };
        ctStats[name].count++;
        const bStats = bookingsBySession[String(s.id)];
        if (bStats) ctStats[name].attended += bStats.attended;
      });

      setClassTypeStats(
        Object.entries(ctStats)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.count - a.count)
      );
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  // Export functions
  const getDateRangeLabel = useCallback(() => {
    switch (dateRange) {
      case 'hoy': return 'hoy';
      case 'semana': return 'ultimos_7_dias';
      case 'mes': return 'ultimos_30_dias';
      default: return 'reporte';
    }
  }, [dateRange]);

  const handleExportSessions = useCallback(() => {
    if (sessionStats.length === 0) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay sesiones para exportar.' });
      return;
    }

    setExporting(true);
    try {
      const headers = ['Clase', 'Fecha', 'Hora', 'Capacidad', 'Reservas', 'Asistencias', 'No-Shows', 'Tasa Ocupación', 'Tasa Asistencia'];
      const rows = sessionStats.map(s => {
        const date = new Date(s.starts_at);
        const occupancyRate = s.capacity > 0 ? Math.round((s.booked / s.capacity) * 100) : 0;
        const attendanceRate = s.booked > 0 ? Math.round((s.attended / s.booked) * 100) : 0;
        return [
          s.class_name,
          date.toLocaleDateString('es-MX'),
          date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          s.capacity,
          s.booked,
          s.attended,
          s.no_show,
          `${occupancyRate}%`,
          `${attendanceRate}%`
        ];
      });

      const csv = generateCSV(headers, rows);
      const filename = `sesiones_${getDateRangeLabel()}_${reportPeriod.start}_${reportPeriod.end}.csv`;
      downloadCSV(csv, filename);

      Swal.fire({
        icon: 'success',
        title: 'Exportación exitosa',
        text: `Se descargó ${filename}`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo exportar el archivo.' });
    } finally {
      setExporting(false);
    }
  }, [sessionStats, reportPeriod, getDateRangeLabel]);

  const handleExportMetrics = useCallback(() => {
    if (metrics.length === 0) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay métricas para exportar.' });
      return;
    }

    setExporting(true);
    try {
      const headers = ['Métrica', 'Valor', 'Detalle'];
      const rows = metrics.map(m => [m.label, m.value, m.subtext || '']);

      // Add period info
      rows.unshift(['Período', `${reportPeriod.start} a ${reportPeriod.end}`, getDateRangeLabel()]);

      const csv = generateCSV(headers, rows);
      const filename = `resumen_metricas_${getDateRangeLabel()}_${reportPeriod.start}_${reportPeriod.end}.csv`;
      downloadCSV(csv, filename);

      Swal.fire({
        icon: 'success',
        title: 'Exportación exitosa',
        text: `Se descargó ${filename}`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo exportar el archivo.' });
    } finally {
      setExporting(false);
    }
  }, [metrics, reportPeriod, getDateRangeLabel]);

  const handleExportClassTypes = useCallback(() => {
    if (classTypeStats.length === 0) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay estadísticas de clases para exportar.' });
      return;
    }

    setExporting(true);
    try {
      const headers = ['Tipo de Clase', 'Sesiones', 'Asistencias', 'Promedio Asistencia/Sesión'];
      const rows = classTypeStats.map(ct => [
        ct.name,
        ct.count,
        ct.attended,
        ct.count > 0 ? (ct.attended / ct.count).toFixed(1) : '0'
      ]);

      const csv = generateCSV(headers, rows);
      const filename = `estadisticas_clases_${getDateRangeLabel()}_${reportPeriod.start}_${reportPeriod.end}.csv`;
      downloadCSV(csv, filename);

      Swal.fire({
        icon: 'success',
        title: 'Exportación exitosa',
        text: `Se descargó ${filename}`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo exportar el archivo.' });
    } finally {
      setExporting(false);
    }
  }, [classTypeStats, reportPeriod, getDateRangeLabel]);

  const handleExportAll = useCallback(() => {
    setExporting(true);
    try {
      // Create a comprehensive report
      let content = '';
      const dateLabel = getDateRangeLabel();

      // Section 1: Summary
      content += 'RESUMEN DE MÉTRICAS\n';
      content += `Período: ${reportPeriod.start} a ${reportPeriod.end}\n\n`;
      const metricsHeaders = ['Métrica', 'Valor', 'Detalle'];
      const metricsRows = metrics.map(m => [m.label, m.value, m.subtext || '']);
      content += generateCSV(metricsHeaders, metricsRows);
      content += '\n\n';

      // Section 2: Sessions
      content += 'SESIONES DETALLADAS\n\n';
      const sessionsHeaders = ['Clase', 'Fecha', 'Hora', 'Capacidad', 'Reservas', 'Asistencias', 'No-Shows'];
      const sessionsRows = sessionStats.map(s => {
        const date = new Date(s.starts_at);
        return [
          s.class_name,
          date.toLocaleDateString('es-MX'),
          date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          s.capacity,
          s.booked,
          s.attended,
          s.no_show
        ];
      });
      content += generateCSV(sessionsHeaders, sessionsRows);
      content += '\n\n';

      // Section 3: Class Types
      content += 'ESTADÍSTICAS POR TIPO DE CLASE\n\n';
      const classHeaders = ['Tipo de Clase', 'Sesiones', 'Asistencias'];
      const classRows = classTypeStats.map(ct => [ct.name, ct.count, ct.attended]);
      content += generateCSV(classHeaders, classRows);

      const filename = `reporte_completo_${dateLabel}_${reportPeriod.start}_${reportPeriod.end}.csv`;
      downloadCSV(content, filename);

      Swal.fire({
        icon: 'success',
        title: 'Reporte completo exportado',
        text: `Se descargó ${filename}`,
        timer: 2500,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo exportar el reporte.' });
    } finally {
      setExporting(false);
    }
  }, [metrics, sessionStats, classTypeStats, reportPeriod, getDateRangeLabel]);

  return (
    <main className="card space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Reportes</p>
          <h1 className="text-2xl font-semibold">Dashboard de Métricas</h1>
          <p className="text-sm text-slate-600">Visualiza el rendimiento del estudio.</p>
        </div>
        {loading && <span className="text-sm text-slate-600">Actualizando...</span>}
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
        {[
          { value: 'hoy', label: 'Hoy' },
          { value: 'semana', label: 'Últimos 7 días' },
          { value: 'mes', label: 'Últimos 30 días' },
        ].map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setDateRange(filter.value as typeof dateRange)}
            className={`rounded-full border px-4 py-1.5 transition-all ${dateRange === filter.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-slate-300 hover:border-primary/40'
              }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-primary/20 bg-white/80 p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{metric.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{metric.value}</p>
                {metric.subtext && (
                  <p className="text-xs text-slate-500 mt-1">{metric.subtext}</p>
                )}
              </div>
              <span className={`rounded-full ${metric.color} w-10 h-10 flex items-center justify-center text-lg`}>
                {metric.icon}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sessions Table */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800">Sesiones Recientes</h2>
          <div className="rounded-2xl border border-primary/20 bg-white/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-primary/5">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Clase</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Fecha</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Ocupación</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Asistencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionStats.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        No hay sesiones en este período
                      </td>
                    </tr>
                  ) : (
                    sessionStats.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{s.class_name}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(s.starts_at).toLocaleDateString('es-MX', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1">
                            <span className="font-semibold">{s.booked}</span>
                            <span className="text-slate-400">/</span>
                            <span className="text-slate-500">{s.capacity}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2 text-xs">
                            <span className="text-green-600 font-semibold">{s.attended} ✓</span>
                            {s.no_show > 0 && (
                              <span className="text-red-500">{s.no_show} ✗</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Class Type Stats */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800">Por Tipo de Clase</h2>
          <div className="space-y-2">
            {classTypeStats.length === 0 ? (
              <p className="text-slate-500 py-4">Sin datos</p>
            ) : (
              classTypeStats.map((ct) => {
                const maxCount = Math.max(...classTypeStats.map((c) => c.count));
                const barWidth = (ct.count / maxCount) * 100;
                return (
                  <div key={ct.name} className="rounded-xl border border-primary/20 bg-white/80 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-800">{ct.name}</span>
                      <span className="text-sm text-slate-600">{ct.count} sesiones</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{ct.attended} asistencias registradas</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="rounded-2xl border border-primary/20 bg-white/80 p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">📤 Exportar Datos</h3>
            <p className="text-sm text-slate-600">
              Descarga los reportes en formato CSV compatible con Excel.
              {reportPeriod.start && (
                <span className="text-xs text-slate-500 ml-2">
                  Período: {reportPeriod.start} a {reportPeriod.end}
                </span>
              )}
            </p>
          </div>
          {exporting && <span className="text-sm text-primary animate-pulse">Exportando...</span>}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            onClick={handleExportAll}
            disabled={exporting || loading}
            className="w-full sm:w-auto rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📊 Reporte Completo
          </button>
          <button
            onClick={handleExportMetrics}
            disabled={exporting || loading || metrics.length === 0}
            className="w-full sm:w-auto rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📈 Resumen Métricas
          </button>
          <button
            onClick={handleExportSessions}
            disabled={exporting || loading || sessionStats.length === 0}
            className="w-full sm:w-auto rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📅 Sesiones
          </button>
          <button
            onClick={handleExportClassTypes}
            disabled={exporting || loading || classTypeStats.length === 0}
            className="w-full sm:w-auto rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🏷️ Por Tipo de Clase
          </button>
        </div>

        <p className="text-xs text-slate-500">
          💡 Los archivos CSV incluyen caracteres especiales y acentos, compatibles con Excel y Google Sheets.
        </p>
      </div>
    </main>
  );
}