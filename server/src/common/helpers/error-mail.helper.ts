const CODIGO_SEGURO = /^[A-Za-z0-9_ -]{1,30}$/;

// Resumen técnico de un fallo de envío de mail para los logs: solo err.code,
// err.responseCode y err.command (si existen) y, si hubo timeout, cuánto
// tardó. Nunca err.message: el SMTP suele repetir la dirección del destinatario.
export function describirErrorMail(err: unknown, duracionMs?: number): string {
  const e = (err ?? {}) as {
    code?: unknown;
    responseCode?: unknown;
    command?: unknown;
  };
  const partes: string[] = [];
  const seguro = (v: unknown): v is string =>
    typeof v === 'string' && CODIGO_SEGURO.test(v);
  if (seguro(e.code)) partes.push(`code=${e.code}`);
  if (typeof e.responseCode === 'number') {
    partes.push(`responseCode=${e.responseCode}`);
  }
  if (seguro(e.command)) partes.push(`command=${e.command}`);
  if (e.code === 'ETIMEDOUT' && duracionMs !== undefined) {
    partes.push(`tardó=${Math.round(duracionMs)}ms`);
  }
  return partes.length ? partes.join(' ') : 'sin código técnico';
}
