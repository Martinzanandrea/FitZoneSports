// Paleta pastel fija para distinguir tipos de clase en calendarios.
// La asignación es determinística por NOMBRE del tipo (no por id):
// todas las clases de "Spinning" comparten color en todas las pantallas.
export const PALETA_CLASES = [
  { fondo: '#EDE9FE', borde: '#8B5CF6' }, // lavanda
  { fondo: '#E0F2FE', borde: '#0284C7' }, // celeste
  { fondo: '#D1FAE5', borde: '#059669' }, // verde menta
  { fondo: '#FFEDD5', borde: '#EA580C' }, // durazno
  { fondo: '#FCE7F3', borde: '#DB2777' }, // rosa
  { fondo: '#FEF9C3', borde: '#CA8A04' }, // amarillo pálido
  { fondo: '#FFE4E6', borde: '#E11D48' }, // salmón
  { fondo: '#CCFBF1', borde: '#0D9488' }, // turquesa
  { fondo: '#ECFCCB', borde: '#65A30D' }, // lima pálido
];

export function colorPorTipo(tipoClase: string) {
  let hash = 0;
  for (let i = 0; i < tipoClase.length; i++) {
    hash = (hash * 31 + tipoClase.charCodeAt(i)) >>> 0;
  }
  return PALETA_CLASES[hash % PALETA_CLASES.length];
}
