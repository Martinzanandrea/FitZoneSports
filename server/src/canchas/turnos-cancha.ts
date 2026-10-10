import { instanteArgentina } from '../common/helpers/hora-argentina.helper';

// Turnos de cancha: de una hora, con inicio entre las 08:00 y las 22:00
// (misma grilla que muestra el cliente: 15 turnos por día).
export const PRIMER_TURNO_HORA = 8;
export const ULTIMO_TURNO_HORA = 22;
export const DURACION_TURNO_HORAS = 1;

export interface Turno {
  horaInicio: string; // HH:MM:SS
  horaFin: string; // HH:MM:SS
}

export function turnosDelDia(): Turno[] {
  return Array.from(
    { length: ULTIMO_TURNO_HORA - PRIMER_TURNO_HORA + 1 },
    (_, i) => {
      const h = PRIMER_TURNO_HORA + i;
      return {
        horaInicio: `${String(h).padStart(2, '0')}:00:00`,
        horaFin: `${String(h + DURACION_TURNO_HORAS).padStart(2, '0')}:00:00`,
      };
    },
  );
}

// Un turno es válido si arranca en punto, dentro de la grilla, y dura 1 hora.
export function esTurnoValido(horaInicio: string, horaFin: string): boolean {
  const ini = /^(\d{2}):(\d{2})/.exec(horaInicio);
  const fin = /^(\d{2}):(\d{2})/.exec(horaFin);
  if (!ini || !fin) return false;
  const hIni = Number(ini[1]);
  return (
    ini[2] === '00' &&
    fin[2] === '00' &&
    hIni >= PRIMER_TURNO_HORA &&
    hIni <= ULTIMO_TURNO_HORA &&
    Number(fin[1]) === hIni + DURACION_TURNO_HORAS
  );
}

// Solape ESTRICTO entre un bloqueo (instantes) y un turno (fecha + horas de
// Argentina): un bloqueo que termina justo cuando empieza el turno no lo toca.
export function bloqueoSolapaTurno(
  bloqueo: { desde: Date; hasta: Date },
  fecha: string,
  horaInicio: string,
  horaFin: string,
): boolean {
  const ini = instanteArgentina(fecha, horaInicio);
  const fin = instanteArgentina(fecha, horaFin);
  return bloqueo.desde < fin && bloqueo.hasta > ini;
}
