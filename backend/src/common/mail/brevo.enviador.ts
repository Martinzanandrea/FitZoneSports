import {
  ErrorEnvioCorreo,
  limpiarAsunto,
  type EnviadorCorreo,
  type MensajeCorreo,
} from './enviador-correo';

export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
export const BREVO_TIMEOUT_MS = 10_000;

const CODIGO_SEGURO = /^[A-Za-z0-9_-]{1,40}$/;

export interface OpcionesBrevo {
  apiKey: string;
  remitenteEmail: string;
  remitenteNombre: string;
}

// Proveedor de producción: API HTTPS de Brevo (Render bloquea el SMTP saliente).
// No registra ni incluye en los errores la API key, el cuerpo ni el destinatario.
export class BrevoEnviador implements EnviadorCorreo {
  constructor(private readonly opciones: OpcionesBrevo) {}

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    const controlador = new AbortController();
    const temporizador = setTimeout(
      () => controlador.abort(),
      BREVO_TIMEOUT_MS,
    );
    try {
      const respuesta = await fetch(BREVO_URL, {
        method: 'POST',
        headers: {
          'api-key': this.opciones.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            email: this.opciones.remitenteEmail,
            name: this.opciones.remitenteNombre,
          },
          to: [{ email: mensaje.para }],
          subject: limpiarAsunto(mensaje.asunto),
          htmlContent: mensaje.html,
          ...(mensaje.texto ? { textContent: mensaje.texto } : {}),
        }),
        signal: controlador.signal,
      });
      if (!respuesta.ok) {
        const code = await this.leerCodigo(respuesta);
        throw new ErrorEnvioCorreo(
          `Brevo rechazó el envío (status ${respuesta.status}${code ? `, code ${code}` : ''})`,
          code,
          respuesta.status,
        );
      }
    } catch (err) {
      if (err instanceof ErrorEnvioCorreo) throw err;
      // Timeout o error de red: nunca se reenvía err.message (puede traer la URL
      // o datos de la conexión).
      if (controlador.signal.aborted) {
        throw new ErrorEnvioCorreo(
          `Brevo no respondió en ${BREVO_TIMEOUT_MS} ms`,
          'ETIMEDOUT',
        );
      }
      const causa = (err as { cause?: { code?: unknown } })?.cause?.code;
      throw new ErrorEnvioCorreo(
        'No se pudo conectar con Brevo',
        typeof causa === 'string' && CODIGO_SEGURO.test(causa)
          ? causa
          : 'ENETWORK',
      );
    } finally {
      clearTimeout(temporizador);
    }
  }

  // Brevo responde { code, message }: solo se toma `code`, y solo si tiene forma
  // de identificador (el `message` puede repetir datos del pedido).
  private async leerCodigo(respuesta: Response): Promise<string | undefined> {
    try {
      const cuerpo = (await respuesta.json()) as { code?: unknown };
      return typeof cuerpo?.code === 'string' && CODIGO_SEGURO.test(cuerpo.code)
        ? cuerpo.code
        : undefined;
    } catch {
      return undefined;
    }
  }
}
