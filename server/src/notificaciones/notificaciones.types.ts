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

// Patrón Factory/Strategy: cada canal se describe a sí mismo y la fábrica
// los elige por `canal`. Sumar un canal es crear una clase que implemente esto
// y registrarla en NotificacionesModule; ningún consumidor cambia.
export interface Notificador {
  /** Canal que atiende este notificador (único entre los registrados). */
  readonly canal: CanalNotificacion;
  /** Pausa en ms entre dos envíos consecutivos de un mismo lote (0 = sin pausa). */
  readonly pausaMs: number;
  /** Elegibilidad: si el destinatario puede recibir por este canal. */
  puedeNotificar(destinatario: Destinatario): boolean;
  /**
   * Devuelve true si entregó/guardó, false si no pudo o no correspondía;
   * NUNCA lanza, para que un destinatario o un canal con problemas no frene
   * al resto.
   */
  enviar(
    destinatario: Destinatario,
    mensaje: MensajeNotificacion,
  ): Promise<boolean>;
}

// Token de inyección multi-provider: reúne todos los notificadores registrados.
export const NOTIFICADORES = Symbol('NOTIFICADORES');

// Resultado de un lote en un canal. `omitidos` son los destinatarios que el
// notificador declaró no elegibles (no se intentaron).
export interface ResultadoCanal {
  enviados: number;
  fallidos: number;
  omitidos: number;
}

export interface ResultadoNotificacion {
  destinatarios: number;
  /** Resultado por canal pedido y registrado. */
  porCanal: Partial<Record<CanalNotificacion, ResultadoCanal>>;
}

// ── Política declarativa (única excepción a "ningún canal nombrado fuera de
// los notificadores y del módulo") ──

// Qué canales usa cada evento de dominio. Cambiar los canales de un evento es
// editar esta tabla, sin tocar la lógica de los listeners.
export const CANALES_POR_EVENTO: Record<
  TipoNotificacion.CLASE_CANCELADA | TipoNotificacion.LISTA_ESPERA_PROMOVIDA,
  readonly CanalNotificacion[]
> = {
  [TipoNotificacion.CLASE_CANCELADA]: [
    CanalNotificacion.PANEL,
    CanalNotificacion.EMAIL,
  ],
  [TipoNotificacion.LISTA_ESPERA_PROMOVIDA]: [
    CanalNotificacion.PANEL,
    CanalNotificacion.EMAIL,
  ],
};

// Canal cuyos resultados se persisten en las columnas existentes de
// `envios_notificacion` (emails_enviados, emails_fallidos) y que define el
// campo `conEmailVerificado` de la previsualización. Un canal nuevo que quiera
// sus propios contadores necesitaría columnas nuevas (migración: paso futuro).
export const CANAL_CON_CONTADORES_PERSISTIDOS = CanalNotificacion.EMAIL;
