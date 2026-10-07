// Comparte una carga en vuelo entre llamadas con la misma clave: StrictMode
// (y efectos repetidos) disparan el mismo efecto dos veces, pero el pedido
// sale una sola vez. Al resolverse, la clave se libera.
const enVuelo = new Map<string, Promise<unknown>>();

export function unaVez<T>(clave: string, cargar: () => Promise<T>): Promise<T> {
  const previa = enVuelo.get(clave) as Promise<T> | undefined;
  if (previa) return previa;
  const promesa = cargar().finally(() => enVuelo.delete(clave));
  enVuelo.set(clave, promesa);
  return promesa;
}

// Descarta una carga en vuelo para que el próximo pedido con esa clave salga de nuevo
// (p. ej. después de un pago aprobado, para no reutilizar datos viejos).
export function invalidarUnaVez(clave: string): void {
  enVuelo.delete(clave);
}
