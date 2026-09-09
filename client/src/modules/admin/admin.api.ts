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
  // Trae los numeritos del panel principal (clases de hoy y horas de cancha
  // agendadas), ya filtrados por sede si quien mira es recepcionista.
  getDashboardResumen: () =>
    api.get<DashboardResumen>('/admin/dashboard/resumen').then((response) => response.data),
  // Trae el resumen de reservas de clases y canchas para la pantalla de gestión del staff.
  getReservas: () =>
    api.get<ReservaAdmin>('/admin/reservas').then((response) => response.data),
  // Trae los ingresos de hoy y del mes, abiertos por método de pago y por sede — solo para gerentes.
  getReporteFinanciero: () =>
    api.get<ReporteFinanciero>('/admin/reportes/financiero').then((r) => r.data),
  // Trae cuántas membresías activas, vencidas y suspendidas hay por sede;
  // si se pasa un sedeId, devuelve solo esa.
  getMembresiasPorSede: (sedeId?: string) =>
    api.get<MembresiaPorSedeItem[]>('/admin/reportes/membresias', { params: sedeId ? { sedeId } : {} }).then((r) => r.data),
  // Dice cuántos socios tiene cada plan, para ver cuál se vende más — solo para gerentes.
  getPopularidadPlanes: () =>
    api.get<PlanPopularidad[]>('/admin/reportes/precios-popularidad').then((r) => r.data),
  // Trae el registro de quién hizo qué en el sistema; los filtros
  // (entidad, desde, hasta) son todos opcionales.
  getAuditoria: (params?: { entidad?: string; desde?: string; hasta?: string }) =>
    api.get<AuditoriaRegistro[]>('/admin/auditoria', { params }).then((r) => r.data),
};
