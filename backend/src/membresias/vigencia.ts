import { MoreThan, type FindOptionsRelations, type Repository } from 'typeorm';
import { Membresia } from '../entities';
import { EstadoMembresia } from '../entities/enums';
import { ahoraArgentina } from '../common/helpers/hora-argentina.helper';

// Vigencia de membresías POR FECHAS (ADR 0013). Única fuente de verdad: ningún
// consumidor elige una membresía solo por `estado = ACTIVO`.
//
// `fecha_fin` es EXCLUSIVA: es el primer día en que la membresía ya no vale.
//   vigente hoy  = estado ACTIVO y fecha_inicio <= hoy < fecha_fin
//   próxima      = estado ACTIVO y fecha_inicio > hoy
// "hoy" siempre es la fecha argentina (YYYY-MM-DD), nunca la del servidor/UTC.
// Las fechas son texto ISO de calendario: comparar como texto es correcto.
//
// La corrección de estas reglas NO depende del cron de vencimiento: una fila
// que sigue en ACTIVO con fecha_fin pasada simplemente no es vigente.

type Periodo = Pick<Membresia, 'estado' | 'fechaInicio' | 'fechaFin'>;

export function hoyArgentina(): string {
  return ahoraArgentina().fecha;
}

export function esVigente(m: Periodo, hoy: string): boolean {
  return (
    m.estado === EstadoMembresia.ACTIVO &&
    m.fechaInicio <= hoy &&
    hoy < m.fechaFin
  );
}

export function esProxima(m: Periodo, hoy: string): boolean {
  return m.estado === EstadoMembresia.ACTIVO && m.fechaInicio > hoy;
}

// Estado que se le muestra al usuario: una fila ACTIVO cuyo período ya terminó
// es VENCIDO aunque el cron todavía no la haya marcado.
export function estadoEfectivo(m: Periodo, hoy: string): EstadoMembresia {
  if (m.estado === EstadoMembresia.ACTIVO && m.fechaFin <= hoy) {
    return EstadoMembresia.VENCIDO;
  }
  return m.estado;
}

// "2026-01-31" + 1 -> "2026-02-28" (o 29 en bisiesto): el día se recorta al
// último del mes de destino, nunca desborda al mes siguiente. Calendario puro,
// sin huso horario.
export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const total = m - 1 + meses;
  const anio = a + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);
  const dd = String(dia).padStart(2, '0');
  const mm = String(mes + 1).padStart(2, '0');
  return `${String(anio).padStart(4, '0')}-${mm}-${dd}`;
}

// Membresías ACTIVO del usuario que todavía no terminaron (vigente y/o en
// cola), ordenadas por fecha_inicio. La base solo acota; la regla definitiva la
// aplican esVigente/esProxima.
async function activasNoTerminadas(
  repo: Repository<Membresia>,
  usuarioId: string,
  hoy: string,
  relations?: FindOptionsRelations<Membresia>,
): Promise<Membresia[]> {
  const filas = await repo.find({
    where: {
      usuario: { id: usuarioId },
      estado: EstadoMembresia.ACTIVO,
      fechaFin: MoreThan(hoy),
    },
    relations,
    order: { fechaInicio: 'ASC' },
  });
  return filas.filter(
    (m) => m.estado === EstadoMembresia.ACTIVO && m.fechaFin > hoy,
  );
}

export async function obtenerVigente(
  repo: Repository<Membresia>,
  usuarioId: string,
  hoy: string = hoyArgentina(),
  relations?: FindOptionsRelations<Membresia>,
): Promise<Membresia | null> {
  const filas = await activasNoTerminadas(repo, usuarioId, hoy, relations);
  const vigentes = filas.filter((m) => esVigente(m, hoy));
  return vigentes.length ? vigentes[vigentes.length - 1] : null;
}

export async function obtenerProxima(
  repo: Repository<Membresia>,
  usuarioId: string,
  hoy: string = hoyArgentina(),
  relations?: FindOptionsRelations<Membresia>,
): Promise<Membresia | null> {
  const filas = await activasNoTerminadas(repo, usuarioId, hoy, relations);
  return filas.find((m) => esProxima(m, hoy)) ?? null;
}

// Para el alta: vigente, próxima y el mayor fecha_fin entre las ACTIVO que
// todavía no terminaron (null si no hay ninguna).
export async function obtenerCadena(
  repo: Repository<Membresia>,
  usuarioId: string,
  hoy: string = hoyArgentina(),
): Promise<{
  vigente: Membresia | null;
  proxima: Membresia | null;
  mayorFin: string | null;
}> {
  const filas = await activasNoTerminadas(repo, usuarioId, hoy);
  const vigentes = filas.filter((m) => esVigente(m, hoy));
  const mayorFin = filas.reduce<string | null>(
    (max, m) => (max === null || m.fechaFin > max ? m.fechaFin : max),
    null,
  );
  return {
    vigente: vigentes.length ? vigentes[vigentes.length - 1] : null,
    proxima: filas.find((m) => esProxima(m, hoy)) ?? null,
    mayorFin,
  };
}

// Fragmento SQL equivalente a esVigente para consultas crudas/QueryBuilder.
// `alias` y `hoyParam` (p. ej. ':hoy' o '$1') los pone quien llama.
export function sqlVigente(alias: string, hoyParam: string): string {
  return `${alias}.estado = 'ACTIVO' AND ${alias}.fecha_inicio <= ${hoyParam} AND ${alias}.fecha_fin > ${hoyParam}`;
}
