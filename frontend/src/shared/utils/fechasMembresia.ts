// Fechas de membresía. `fecha_fin` es EXCLUSIVA: es el primer día en que la
// membresía ya no vale. Todo se calcula con fechas de calendario YYYY-MM-DD en
// hora de Argentina, sin pasar por new Date('YYYY-MM-DD') (se interpreta en UTC
// y se corre un día).

const ZONA_ARGENTINA = 'America/Argentina/Buenos_Aires';
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// "Hoy" como fecha de calendario en Argentina.
export function hoyArgentina(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_ARGENTINA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '00';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

// Días entre dos fechas YYYY-MM-DD (b - a). Aritmética de calendario pura.
function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / MS_POR_DIA);
}

// Días de membresía que sirven desde hoy hasta el día anterior a fecha_fin.
// 0 o negativo: vencida.
export function diasRestantes(fechaFin: string, hoy = hoyArgentina()): number {
  return diasEntre(hoy, fechaFin);
}

// Duración total del período en días (fecha_fin exclusiva menos fecha_inicio).
export function duracionDias(fechaInicio: string, fechaFin: string): number {
  return diasEntre(fechaInicio, fechaFin);
}

// Último día válido: fecha_fin menos un día.
export function fechaValidaHasta(fechaFin: string): string {
  const [y, m, d] = fechaFin.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().split('T')[0];
}

// YYYY-MM-DD -> DD/MM/AAAA.
export function formatearDDMMAAAA(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

// YYYY-MM-DD -> DD/MM.
export function formatearDDMM(fecha: string): string {
  const [, m, d] = fecha.split('-');
  return `${d}/${m}`;
}
