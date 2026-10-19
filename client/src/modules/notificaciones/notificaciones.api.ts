import { api } from '../../api/axios';
import type { PaginatedResponse } from '../../shared/types/pagination';

export type TipoNotificacion = 'CLASE_CANCELADA' | 'LISTA_ESPERA_PROMOVIDA' | 'AVISO_GENERAL';
export type AudienciaEnvio = 'TODOS_LOS_SOCIOS' | 'SOCIOS_DE_SEDE' | 'SOCIO';
export type CanalNotificacion = 'PANEL' | 'EMAIL' | 'PUSH';

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  creadaEn: string;
  leidaEn: string | null;
}

export interface EnvioNotificacion {
  id: string;
  titulo: string;
  mensaje: string;
  audiencia: AudienciaEnvio;
  sede: { id: string; nombre: string } | null;
  destinatario: { nombre: string; apellido: string } | null;
  canales: CanalNotificacion[];
  creadoPor: { nombre: string; apellido: string } | null;
  creadaEn: string;
  totalDestinatarios: number;
  emailsEnviados: number;
  emailsFallidos: number;
}

export interface FiltroAudiencia {
  audiencia: AudienciaEnvio;
  sedeId?: string;
  usuarioId?: string;
}

export interface CrearEnvioPayload extends FiltroAudiencia {
  titulo: string;
  mensaje: string;
  canales: CanalNotificacion[];
}

export const notificacionesApi = {
  // Campanita del Socio: el backend usa siempre el usuario del token.
  listar: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Notificacion>>('/notificaciones', { params: { page, limit } }).then((r) => r.data),
  contarNoLeidas: () => api.get<{ noLeidas: number }>('/notificaciones/no-leidas/conteo').then((r) => r.data.noLeidas),
  marcarLeida: (id: string) => api.patch<Notificacion>(`/notificaciones/${id}/leida`).then((r) => r.data),
  leerTodas: () => api.patch<{ actualizadas: number }>('/notificaciones/leer-todas').then((r) => r.data),

  // Avisos del Gerente General.
  crearEnvio: (payload: CrearEnvioPayload) => api.post<EnvioNotificacion>('/notificaciones/envios', payload).then((r) => r.data),
  previsualizar: (filtro: FiltroAudiencia) =>
    api
      .get<{ cantidad: number; conEmailVerificado: number }>('/notificaciones/envios/previsualizar', { params: filtro })
      .then((r) => r.data),
  historial: (page = 1, limit = 10) =>
    api.get<PaginatedResponse<EnvioNotificacion>>('/notificaciones/envios', { params: { page, limit } }).then((r) => r.data),
};
