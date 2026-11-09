export type TipoAcceso = "cliente" | "staff";

const CLAVE = "fitzone-ultimo-acceso";

// Último tipo de acceso con sesión iniciada. Solo guarda "cliente" o "staff", sin datos
// personales, y se conserva al cerrar sesión. Sin localStorage se comporta como si no hubiera dato.
export function leerUltimoAcceso(): TipoAcceso | null {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === "cliente" || valor === "staff" ? valor : null;
  } catch {
    return null;
  }
}

export function guardarUltimoAcceso(tipo: TipoAcceso): void {
  try {
    localStorage.setItem(CLAVE, tipo);
  } catch {
    /* sin localStorage: no se recuerda el acceso */
  }
}
