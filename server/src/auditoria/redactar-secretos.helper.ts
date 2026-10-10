const CLAVE_SENSIBLE = /pass(word)?|token|secret|hash|authorization/i;
const REDACTADO = '[REDACTADO]';
const PROFUNDIDAD_MAXIMA = 5;

// Copia del objeto con los valores de claves sensibles (password, token, hash...)
// reemplazados. Se usa antes de guardar el body de una request en la auditoría.
export function redactarSecretos<T>(valor: T, nivel = 0): T {
  return redactar(valor, nivel) as T;
}

function redactar(valor: unknown, nivel: number): unknown {
  if (valor === null || typeof valor !== 'object') return valor;
  if (nivel >= PROFUNDIDAD_MAXIMA) return REDACTADO;
  if (Array.isArray(valor)) {
    return valor.map((v) => redactar(v, nivel + 1));
  }
  const salida: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    salida[clave] = CLAVE_SENSIBLE.test(clave)
      ? REDACTADO
      : redactar(v, nivel + 1);
  }
  return salida;
}
