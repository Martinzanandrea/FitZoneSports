import { api } from '../../api/axios';

export interface DashboardResumen {
  clasesHoy: number;
  horasCanchasAgendadasHoy: number;
}

export interface ReservaAdmin {
  resumen: {
    canchasReservadas: number;
    clasesConOcupacionAlta: number;
  };
  clases: Array<{
    id: string;
    clase: string;
    sede: string;
    usuario: string;
    fecha: string;
    horario: string;
    estado: string;
    ocupadas: number;
    capacidad: number;
  }>;
  canchas: Array<{
    id: string;
    cancha: string;
    sede: string;
    usuario: string;
    fecha: string;
    horario: string;
    estado: string;
    precioFinal: string;
  }>;
}

export interface AuditoriaRegistro {
  id: string;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  detalle?: Record<string, unknown> | null;
  creadoEn: string;
  actor?: { id: string; nombre: string; apellido: string; email?: string } | null;
}

export interface ReporteFinanciero {
  ingresosHoy: number;
  ingresosMes: number;
  ingresosMesAnterior: number;
  porMetodo: Array<{ metodo: string; total: number }>;
  porSede: Array<{ sedeId: string; sede: string; total: number }>;
}

export interface MembresiaPorSedeItem {
  sedeId: string;
  sede: string;
  activas: number;
  vencidas: number;
  suspendidas: number;
  socios: Array<{ usuarioId: string; nombre: string; dni: string | null; plan: string; estado: string; fechaFin: string }>;
}

export interface PlanPopularidad {
  plan: string;
  socios: number;
}

export const adminApi = {
  getDashboardResumen: () =>
    api.get<DashboardResumen>('/admin/dashboard/resumen').then((response) => response.data),
  getReservas: () =>
    api.get<ReservaAdmin>('/admin/reservas').then((response) => response.data),
  getReporteFinanciero: () =>
    api.get<ReporteFinanciero>('/admin/reportes/financiero').then((r) => r.data),
  getMembresiasPorSede: (sedeId?: string) =>
    api.get<MembresiaPorSedeItem[]>('/admin/reportes/membresias', { params: sedeId ? { sedeId } : {} }).then((r) => r.data),
  getPopularidadPlanes: () =>
    api.get<PlanPopularidad[]>('/admin/reportes/precios-popularidad').then((r) => r.data),
  getAuditoria: (params?: { entidad?: string; desde?: string; hasta?: string }) =>
    api.get<AuditoriaRegistro[]>('/admin/auditoria', { params }).then((r) => r.data),
};
