const OCHO_HORAS_MS = 8 * 60 * 60 * 1000;

const UNIDADES_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

// Convierte JWT_EXPIRATION ("8h", "30m", "1m", "7d", "45s" o segundos
// como número) a milisegundos, para que la cookie venza junto con el JWT.
// Si el valor falta o es inválido, usa 8 horas.
export function parsearExpiracionMs(valor: unknown): number {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) && valor > 0 ? valor * 1000 : OCHO_HORAS_MS;
  }
  if (typeof valor !== 'string') return OCHO_HORAS_MS;

  const match = /^(\d+)\s*([smhd])?$/i.exec(valor.trim());
  if (!match) return OCHO_HORAS_MS;

  const cantidad = Number(match[1]);
  if (cantidad <= 0) return OCHO_HORAS_MS;
  const unidad = match[2] ? UNIDADES_MS[match[2].toLowerCase()] : 1000;
  return cantidad * unidad;
}
