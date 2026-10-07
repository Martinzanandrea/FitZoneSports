// Paleta fija para distinguir tipos de clase en calendarios (fondo translúcido
// sobre el fondo oscuro + borde de acento). Sin tonos púrpura: lima, aqua, coral y
// sus vecinos de la paleta. La asignación es determinística por NOMBRE del tipo
// (no por id): todas las clases de "Spinning" comparten color en todas las pantallas.
export const PALETA_CLASES = [
  { fondo: 'rgba(202, 255, 61, 0.12)', borde: '#caff3d' }, // lima
  { fondo: 'rgba(84, 230, 216, 0.12)', borde: '#54e6d8' }, // aqua
  { fondo: 'rgba(255, 130, 108, 0.12)', borde: '#ff826c' }, // coral
  { fondo: 'rgba(255, 208, 113, 0.12)', borde: '#ffd071' }, // ámbar
  { fondo: 'rgba(140, 242, 166, 0.12)', borde: '#8cf2a6' }, // verde menta
  { fondo: 'rgba(243, 246, 235, 0.08)', borde: '#a9bab6' }, // neutro
];

export function colorPorTipo(tipoClase: string) {
  let hash = 0;
  for (let i = 0; i < tipoClase.length; i++) {
    hash = (hash * 31 + tipoClase.charCodeAt(i)) >>> 0;
  }
  return PALETA_CLASES[hash % PALETA_CLASES.length];
}
