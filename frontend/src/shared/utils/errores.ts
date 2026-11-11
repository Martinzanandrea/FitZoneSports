// Utilidades para mostrar errores inesperados de la interfaz (ErrorBoundary y avisos globales).

// Texto legible de cualquier cosa que se haya lanzado (Error, string, objeto, evento).
export function mensajeDeErrorInesperado(valor: unknown): string {
  if (valor instanceof Error) return valor.message || valor.name;
  if (typeof valor === 'string') return valor;
  if (valor && typeof valor === 'object') {
    const m = (valor as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
    try {
      return JSON.stringify(valor);
    } catch {
      return Object.prototype.toString.call(valor);
    }
  }
  return String(valor);
}

// Primeras `n` líneas no vacías de un texto (para el componentStack).
export function primerasLineas(texto: string | null | undefined, n = 5): string {
  return (texto ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, n)
    .join('\n');
}

// Avisos del navegador que no son fallos de la app y no deben tapar la pantalla.
export function esRuidoDelNavegador(mensaje: string): boolean {
  return /ResizeObserver loop/i.test(mensaje);
}
