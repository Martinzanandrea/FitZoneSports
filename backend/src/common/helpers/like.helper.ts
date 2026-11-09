// Escapa los comodines de LIKE/ILIKE (barra invertida, % y _) para que el texto
// buscado se tome literal. Se usa siempre con parámetros enlazados, nunca
// concatenado al SQL.
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}
