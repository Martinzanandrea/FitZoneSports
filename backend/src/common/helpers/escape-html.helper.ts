const REEMPLAZOS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Escapa texto para ponerlo dentro de HTML (cuerpo o atributos entre comillas).
export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => REEMPLAZOS[c]);
}
