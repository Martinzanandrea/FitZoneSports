// Decisiones y textos de la pantalla de control de acceso en modo offline.
// Funciones puras (sin React ni IndexedDB): la pantalla solo las usa y se
// pueden probar sin Testing Library.
import { esFalloDeConectividad } from '../../../api/clasificarError';
import type { ResumenSincronizacion } from './colaIngresos';

// El snapshot se vuelve a bajar cuando tiene más de una hora (vale 24 h).
export const REFRESCO_SNAPSHOT_MS = 60 * 60 * 1000;

export type RutaValidacionQr = 'ONLINE' | 'OFFLINE';

// Con conexión se usa el flujo online de siempre; sin ella, la validación local.
export function rutaValidacionQr(enLinea: boolean): RutaValidacionQr {
  return enLinea ? 'ONLINE' : 'OFFLINE';
}

// Tras un fallo del flujo online: solo la falta de respuesta (red, timeout) o un
// servidor caído (5xx) pasan a offline. Un 4xx (QR inválido, membresía vencida,
// 401, 403) es una respuesta real del servidor y se muestra como rechazo.
export function debePasarAOffline(err: unknown, enLinea: boolean): boolean {
  return esFalloDeConectividad(err, enLinea);
}

export function debeDescargarSnapshot(generadoEn: string | null, ahora: number): boolean {
  if (!generadoEn) return true;
  const generado = Date.parse(generadoEn);
  if (!Number.isFinite(generado)) return true;
  const edad = ahora - generado;
  return edad < 0 || edad >= REFRESCO_SNAPSHOT_MS;
}

export type ModoPantalla = 'camara' | 'manual' | 'codigo' | 'dni';

export interface ControlesSinConexion {
  codigoDeshabilitado: boolean;
  dniDeshabilitado: boolean;
  egresoDeshabilitado: boolean;
}

// Código corto, DNI y egreso necesitan al servidor; el QR (cámara o pegado) no.
export function controlesSegunConexion(sinConexion: boolean): ControlesSinConexion {
  return { codigoDeshabilitado: sinConexion, dniDeshabilitado: sinConexion, egresoDeshabilitado: sinConexion };
}

// Texto corto que explica por qué un control está deshabilitado (null si no aplica).
export function textoRequiereConexion(modo: ModoPantalla, sinConexion: boolean): string | null {
  if (!sinConexion) return null;
  if (modo === 'codigo') return 'El ingreso por código requiere conexión a internet.';
  if (modo === 'dni') return 'El ingreso por DNI requiere conexión a internet.';
  return null;
}

export const TEXTO_EGRESO_REQUIERE_CONEXION = 'El registro de egresos requiere conexión a internet.';

export function textoPendientes(pendientes: number): string {
  if (pendientes === 0) return 'No hay ingresos pendientes de sincronizar.';
  if (pendientes === 1) return '1 ingreso pendiente de sincronizar.';
  return `${pendientes} ingresos pendientes de sincronizar.`;
}

export interface EstadoBanner {
  visible: boolean;
  // 'error': no se puede validar sin conexión; 'aviso': se puede, con datos locales.
  tono: 'aviso' | 'error';
  titulo: string;
  lineas: string[];
}

export function estadoBanner(params: { sinConexion: boolean; snapshotVigente: boolean; pendientes: number }): EstadoBanner {
  const { sinConexion, snapshotVigente, pendientes } = params;
  if (!sinConexion) {
    return {
      visible: pendientes > 0,
      tono: 'aviso',
      titulo: 'Ingresos pendientes de sincronizar',
      lineas: [textoPendientes(pendientes)],
    };
  }
  return {
    visible: true,
    tono: snapshotVigente ? 'aviso' : 'error',
    titulo: 'Modo sin conexión',
    lineas: [
      snapshotVigente
        ? 'Datos descargados vigentes: los ingresos por QR se validan con la información local.'
        : 'No se pueden validar ingresos sin conexión: no hay datos descargados vigentes. Conectate a internet para descargarlos.',
      textoPendientes(pendientes),
    ],
  };
}

const TEXTO_CODIGO: Record<string, string> = {
  MEMBRESIA_NO_VIGENTE: 'La membresía no estaba vigente al sincronizar',
  AFORO_EXCEDIDO: 'La sede superaba su aforo máximo',
  SESION_ABIERTA: 'El socio ya tenía un ingreso abierto',
  QR_REUSADO: 'El código QR ya había sido registrado',
  TOKEN_INVALIDO: 'El código QR no es válido',
  QR_VENCIDO: 'El ingreso ocurrió fuera de la vigencia del código QR',
  FECHA_INVALIDA: 'El ingreso tiene más de 72 horas de antigüedad',
  USUARIO_INEXISTENTE: 'El usuario del código QR no existe',
};

const TEXTO_INTERRUPCION: Record<NonNullable<ResumenSincronizacion['interrumpida']>, string> = {
  RED: 'La sincronización se interrumpió por falta de conexión. Se reintentará automáticamente.',
  SESION: 'La sincronización se interrumpió porque la sesión no fue aceptada. Iniciá sesión nuevamente.',
  SERVIDOR: 'La sincronización se interrumpió por un error del servidor. Se reintentará automáticamente.',
};

const ETIQUETA_ESTADO = { OBSERVADO: 'Observado', CONFLICTO: 'Conflicto', RECHAZADO: 'Rechazado', CREADO: 'Creado' } as const;

export interface TextoResumenSync {
  tono: 'ok' | 'aviso' | 'error';
  titulo: string;
  conteos: string;
  interrupcion: string | null;
  detalle: Array<{ clientEventId: string; texto: string }>;
  fallidos: string | null;
}

// Resumen de la última sincronización listo para mostrar en pantalla.
export function textoResumenSync(r: ResumenSincronizacion): TextoResumenSync {
  const hayProblemas = r.conflictos > 0 || r.rechazados > 0 || r.fallidos.length > 0 || !!r.interrumpida;
  return {
    tono: hayProblemas ? 'error' : r.observados > 0 ? 'aviso' : 'ok',
    titulo: 'Resultado de la última sincronización',
    conteos: `Creados: ${r.creados}. Observados: ${r.observados}. Conflictos: ${r.conflictos}. Rechazados: ${r.rechazados}.`,
    interrupcion: r.interrumpida ? TEXTO_INTERRUPCION[r.interrumpida] : null,
    detalle: r.detalle.map((d) => ({
      clientEventId: d.clientEventId,
      texto: `Ingreso ${d.clientEventId.slice(0, 8)}: ${ETIQUETA_ESTADO[d.estado]}. ${TEXTO_CODIGO[d.codigo] ?? d.codigo}.`,
    })),
    fallidos:
      r.fallidos.length > 0
        ? `${r.fallidos.length} ingreso(s) no pudieron enviarse porque el servidor rechazó el formato. Quedan guardados en este dispositivo.`
        : null,
  };
}

// ¿Conviene mostrar el resumen? Solo con conexión, si tiene algo para contar y no se lo descartó.
export function debeMostrarResumen(r: ResumenSincronizacion | null, sinConexion: boolean, ocultoFecha: string | null): boolean {
  if (!r || sinConexion || r.fecha === ocultoFecha) return false;
  return r.creados + r.observados + r.conflictos + r.rechazados + r.fallidos.length > 0 || !!r.interrumpida;
}
