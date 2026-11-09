const CLAVE = "fitzone-push-ahora-no";
const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

// "Ahora no" de la invitación a activar notificaciones: se recuerda 7 días en localStorage.
// Sin localStorage el llamador lo oculta solo durante la sesión.
export function descarteVigente(ahora = Date.now()): boolean {
  try {
    const guardado = Number(localStorage.getItem(CLAVE));
    return (
      Number.isFinite(guardado) &&
      guardado > 0 &&
      ahora - guardado < SIETE_DIAS_MS
    );
  } catch {
    return false;
  }
}

export function guardarDescarte(ahora = Date.now()): void {
  try {
    localStorage.setItem(CLAVE, String(ahora));
  } catch {
    /* sin localStorage: solo se oculta en esta sesión */
  }
}
