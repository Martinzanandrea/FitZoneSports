// Hora de referencia del negocio: America/Argentina/Buenos_Aires (UTC-3 fijo,
// Argentina no usa horario de verano). Las fechas ("YYYY-MM-DD") y horas
// ("HH:MM[:SS]") de las reservas se guardan sin zona, así que se comparan como
// texto contra "ahora en Argentina" y nunca contra el huso del servidor.
export const ZONA_ARGENTINA = 'America/Argentina/Buenos_Aires';
const OFFSET_ARGENTINA = '-03:00';

export interface AhoraArgentina {
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
}

export function ahoraArgentina(ahora: Date = new Date()): AhoraArgentina {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_ARGENTINA,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(ahora);
  const v = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? '00';
  return {
    fecha: `${v('year')}-${v('month')}-${v('day')}`,
    hora: `${v('hour')}:${v('minute')}:${v('second')}`,
  };
}

// Instante real (UTC) de una fecha + hora de pared argentina.
export function instanteArgentina(fecha: string, hora: string): Date {
  const hhmmss = hora.length === 5 ? `${hora}:00` : hora;
  return new Date(`${fecha}T${hhmmss}${OFFSET_ARGENTINA}`);
}

// ¿La franja (fecha, horaFin) termina después de "ahora" en Argentina?
export function terminaDespuesDe(
  fecha: string,
  horaFin: string,
  ahora: AhoraArgentina,
): boolean {
  const fin = horaFin.length === 5 ? `${horaFin}:00` : horaFin;
  if (fecha !== ahora.fecha) return fecha > ahora.fecha;
  return fin > ahora.hora;
}

// "2026-10-07" -> "07/10"
export function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split('-');
  return `${d}/${m}`;
}

// "2026-10-31" + 1 -> "2026-11-01". Aritmética de calendario pura (UTC), sin
// huso del servidor.
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().split('T')[0];
}

// Día de la semana de una fecha de calendario (0 = domingo ... 6 = sábado,
// igual que Date#getDay), independiente del huso del servidor.
export function diaSemanaDe(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}
