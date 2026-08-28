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

export const adminApi = {
  getDashboardResumen: () =>
    api.get<DashboardResumen>('/admin/dashboard/resumen').then((response) => response.data),
  getReservas: () =>
    api.get<ReservaAdmin>('/admin/reservas').then((response) => response.data),
};
