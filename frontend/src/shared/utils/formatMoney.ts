// Utilidad de formato: pesos argentinos sin decimales.
export function formatMoney(n: number): string {
  return '$' + n.toLocaleString('es-AR');
}
