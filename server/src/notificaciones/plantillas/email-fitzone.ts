import { escaparHtml } from '../../common/helpers/escape-html.helper';

// Plantilla simple de FitZone. Todo texto variable se escapa: el título y el
// mensaje los escribe una persona (o salen de datos cargados por el staff).
export function renderEmailFitZone(datos: {
  nombre: string;
  titulo: string;
  mensaje: string;
}): string {
  const mensaje = escaparHtml(datos.mensaje).replace(/\r?\n/g, '<br>');
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#071a1d;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0e2b2f;border-radius:14px;">
<tr><td style="padding:20px 28px;border-bottom:1px solid #1d4a50;color:#caff3d;font-size:18px;font-weight:bold;letter-spacing:1px;">FITZONE SPORTS</td></tr>
<tr><td style="padding:28px;color:#e8f4f2;font-size:14px;line-height:1.6;">
<p style="margin:0 0 12px;">Hola ${escaparHtml(datos.nombre)},</p>
<h2 style="margin:0 0 12px;color:#ffffff;font-size:18px;">${escaparHtml(datos.titulo)}</h2>
<p style="margin:0;">${mensaje}</p>
</td></tr>
<tr><td style="padding:16px 28px;color:#8fb3b0;font-size:11px;">Recibís este mail porque sos socio de FitZone Sports.</td></tr>
</table></td></tr></table></body></html>`;
}
