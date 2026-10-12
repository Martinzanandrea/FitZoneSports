// Transporte de correo desacoplado: los consumidores (verificación de cuenta,
// notificaciones) dependen de esta interfaz, no de SMTP ni de un proveedor.
export interface MensajeCorreo {
  para: string;
  asunto: string;
  html: string;
  texto?: string;
}

export interface EnviadorCorreo {
  /** Lanza si el proveedor no pudo enviar el mail. */
  enviar(mensaje: MensajeCorreo): Promise<void>;
}

export const ENVIADOR_CORREO = Symbol('ENVIADOR_CORREO');

// Fallo de envío con datos técnicos seguros para loguear: nunca lleva la
// dirección del destinatario, el cuerpo ni credenciales en `message`.
export class ErrorEnvioCorreo extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ErrorEnvioCorreo';
  }
}

// Sin saltos de línea en el asunto (evita inyección de cabeceras).
export function limpiarAsunto(asunto: string): string {
  return asunto.replace(/[\r\n]+/g, ' ').trim();
}
