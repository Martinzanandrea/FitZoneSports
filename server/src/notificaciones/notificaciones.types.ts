export enum CanalNotificacion {
  PANEL = 'PANEL',
  EMAIL = 'EMAIL',
}

export enum TipoNotificacion {
  CLASE_CANCELADA = 'CLASE_CANCELADA',
  LISTA_ESPERA_PROMOVIDA = 'LISTA_ESPERA_PROMOVIDA',
  AVISO_GENERAL = 'AVISO_GENERAL',
}

export enum AudienciaEnvio {
  TODOS_LOS_SOCIOS = 'TODOS_LOS_SOCIOS',
  SOCIOS_DE_SEDE = 'SOCIOS_DE_SEDE',
  SOCIO = 'SOCIO',
}

// Lo mínimo que un notificador necesita saber de quien recibe el aviso.
export interface Destinatario {
  id: string;
  nombre: string;
  email: string | null;
  emailVerificado: boolean;
}

export interface MensajeNotificacion {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  envioId?: string | null;
}

// Patrón Factory/Strategy: cada canal implementa lo mismo. `enviar` devuelve
// true si entregó/guardó, false si no pudo o no correspondía; NUNCA lanza, para
// que un destinatario o un canal con problemas no frene al resto.
export interface Notificador {
  enviar(
    destinatario: Destinatario,
    mensaje: MensajeNotificacion,
  ): Promise<boolean>;
}

export interface ResultadoNotificacion {
  destinatarios: number;
  panelGuardadas: number;
  emailsEnviados: number;
  emailsFallidos: number;
}
