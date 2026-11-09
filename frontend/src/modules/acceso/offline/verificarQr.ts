// Verificación del QR de acceso sin servidor: firma ES256 con WebCrypto y la
// clave pública (JWK) que el backend publica en GET /acceso/clave-publica.
// Nunca lanza por un token malformado: devuelve el motivo.

export type ClavePublicaJwk = JsonWebKey;

// Forma de GET /acceso/clave-publica (y de `clave` dentro del snapshot).
export interface ClavePublica {
  kid: string;
  alg: 'ES256';
  jwk: ClavePublicaJwk;
}

export type MotivoQrInvalido = 'FORMATO' | 'ALGORITMO' | 'KID' | 'FIRMA' | 'TIPO' | 'VENCIDO';

export type ResultadoVerificacionQr =
  | { ok: true; usuarioId: string; jti: string; iat: number; exp: number }
  | { ok: false; motivo: MotivoQrInvalido };

// El reloj del dispositivo puede estar levemente desfasado respecto del servidor.
const TOLERANCIA_EXP_MS = 5_000;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function decodificarBase64Url(texto: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64URL.test(texto)) return null;
  try {
    const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
    const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    return Uint8Array.from(binario, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function leerJson(parte: string): Record<string, unknown> | null {
  const bytes = decodificarBase64Url(parte);
  if (!bytes) return null;
  try {
    const valor: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function firmaCorrecta(jwk: ClavePublicaJwk, firma: Uint8Array<ArrayBuffer>, mensaje: Uint8Array<ArrayBuffer>): Promise<boolean> {
  if (firma.length !== 64) return false;
  try {
    const { kty, crv, x, y } = jwk;
    const llave = await crypto.subtle.importKey('jwk', { kty, crv, x, y }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, llave, firma, mensaje);
  } catch {
    return false;
  }
}

const invalido = (motivo: MotivoQrInvalido): ResultadoVerificacionQr => ({ ok: false, motivo });

export async function verifyQrOffline(
  token: string,
  clave: Pick<ClavePublica, 'kid' | 'jwk'>,
  ahora: number = Date.now(),
): Promise<ResultadoVerificacionQr> {
  if (typeof token !== 'string') return invalido('FORMATO');
  const partes = token.split('.');
  if (partes.length !== 3) return invalido('FORMATO');
  const [h, p, f] = partes;

  const header = leerJson(h);
  const payload = leerJson(p);
  const firma = decodificarBase64Url(f);
  if (!header || !payload || !firma) return invalido('FORMATO');

  if (header.alg !== 'ES256') return invalido('ALGORITMO');
  if (header.kid !== clave.kid) return invalido('KID');

  // La firma ES256 de un JWT ya es r||s (64 bytes), lo que espera WebCrypto.
  const firmaValida = await firmaCorrecta(clave.jwk, firma, new TextEncoder().encode(`${h}.${p}`));
  if (!firmaValida) return invalido('FIRMA');

  if (payload.tipo !== 'qr-acceso') return invalido('TIPO');
  const { usuarioId, jti, iat, exp } = payload;
  if (typeof usuarioId !== 'string' || typeof jti !== 'string' || typeof iat !== 'number' || typeof exp !== 'number') {
    return invalido('FORMATO');
  }
  if (ahora > exp * 1000 + TOLERANCIA_EXP_MS) return invalido('VENCIDO');

  return { ok: true, usuarioId, jti, iat, exp };
}
