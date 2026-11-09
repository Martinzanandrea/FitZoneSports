import { beforeAll, describe, expect, it } from 'vitest';
import { verifyQrOffline, type ClavePublica } from './verificarQr';

// Los tokens de prueba se firman con WebCrypto, igual que la API firma el QR
// ES256: la firma sale en formato r||s, sin conversión DER.
const AHORA = Date.parse('2026-10-09T18:00:00Z');
const SEG = Math.floor(AHORA / 1000);
const KID = 'a1b2c3d4';
const USUARIO = '11111111-1111-4111-8111-111111111111';
const JTI = '22222222-2222-4222-8222-222222222222';

const aBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jsonBase64Url = (o: unknown) => aBase64Url(new TextEncoder().encode(JSON.stringify(o)));

let par: CryptoKeyPair;
let clave: ClavePublica;

beforeAll(async () => {
  par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  clave = { kid: KID, alg: 'ES256', jwk: await crypto.subtle.exportKey('jwk', par.publicKey) };
});

async function firmar(
  payload: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
  llave?: CryptoKey,
): Promise<string> {
  const h = jsonBase64Url({ alg: 'ES256', typ: 'JWT', kid: KID, ...header });
  const p = jsonBase64Url({ usuarioId: USUARIO, tipo: 'qr-acceso', jti: JTI, iat: SEG, exp: SEG + 60, ...payload });
  const firma = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    llave ?? par.privateKey,
    new TextEncoder().encode(`${h}.${p}`),
  );
  return `${h}.${p}.${aBase64Url(new Uint8Array(firma))}`;
}

describe('verifyQrOffline', () => {
  it('un QR bien firmado y vigente es válido y devuelve los datos del token', async () => {
    const r = await verifyQrOffline(await firmar(), clave, AHORA);
    expect(r).toEqual({ ok: true, usuarioId: USUARIO, jti: JTI, iat: SEG, exp: SEG + 60 });
  });

  it('usa Date.now() por defecto', async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const r = await verifyQrOffline(await firmar({ iat: ahora, exp: ahora + 60 }), clave);
    expect(r.ok).toBe(true);
  });

  it('firma alterada: FIRMA', async () => {
    const token = await firmar();
    const [h, p, f] = token.split('.');
    const alterada = `${f.slice(0, -2)}${f.endsWith('AA') ? 'BB' : 'AA'}`;
    expect(await verifyQrOffline(`${h}.${p}.${alterada}`, clave, AHORA)).toEqual({ ok: false, motivo: 'FIRMA' });
  });

  it('payload alterado con la firma original: FIRMA', async () => {
    const [h, , f] = (await firmar()).split('.');
    const otro = jsonBase64Url({ usuarioId: 'otro', tipo: 'qr-acceso', jti: JTI, iat: SEG, exp: SEG + 60 });
    expect(await verifyQrOffline(`${h}.${otro}.${f}`, clave, AHORA)).toEqual({ ok: false, motivo: 'FIRMA' });
  });

  it('firmado con otra clave: FIRMA', async () => {
    const otra = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const token = await firmar({}, {}, otra.privateKey);
    expect(await verifyQrOffline(token, clave, AHORA)).toEqual({ ok: false, motivo: 'FIRMA' });
  });

  it('firma de largo incorrecto: FIRMA', async () => {
    const [h, p] = (await firmar()).split('.');
    expect(await verifyQrOffline(`${h}.${p}.${aBase64Url(new Uint8Array(10))}`, clave, AHORA)).toEqual({
      ok: false,
      motivo: 'FIRMA',
    });
  });

  it('kid distinto: KID', async () => {
    expect(await verifyQrOffline(await firmar({}, { kid: 'otro' }), clave, AHORA)).toEqual({ ok: false, motivo: 'KID' });
  });

  it('sin kid en la cabecera: KID', async () => {
    expect(await verifyQrOffline(await firmar({}, { kid: undefined }), clave, AHORA)).toEqual({ ok: false, motivo: 'KID' });
  });

  it.each(['HS256', 'none', 'ES384'])('alg %s: ALGORITMO', async (alg) => {
    expect(await verifyQrOffline(await firmar({}, { alg }), clave, AHORA)).toEqual({ ok: false, motivo: 'ALGORITMO' });
  });

  it('tipo distinto de qr-acceso: TIPO', async () => {
    expect(await verifyQrOffline(await firmar({ tipo: 'sesion' }), clave, AHORA)).toEqual({ ok: false, motivo: 'TIPO' });
  });

  it('payload firmado sin jti: FORMATO', async () => {
    expect(await verifyQrOffline(await firmar({ jti: undefined }), clave, AHORA)).toEqual({ ok: false, motivo: 'FORMATO' });
  });

  describe('vencimiento (reloj del dispositivo, tolerancia de 5 s)', () => {
    it('hasta exp + 5 s todavía vale', async () => {
      const token = await firmar();
      expect((await verifyQrOffline(token, clave, (SEG + 60) * 1000 + 5_000)).ok).toBe(true);
    });
    it('pasados exp + 5 s: VENCIDO', async () => {
      const token = await firmar();
      expect(await verifyQrOffline(token, clave, (SEG + 60) * 1000 + 5_001)).toEqual({ ok: false, motivo: 'VENCIDO' });
    });
  });

  describe('token malformado: nunca lanza', () => {
    it.each([
      ['vacío', ''],
      ['sin puntos', 'abc'],
      ['dos partes', 'a.b'],
      ['cuatro partes', 'a.b.c.d'],
      ['caracteres fuera de base64url', 'a+b.c/d.e='],
      ['partes que no son JSON', `${aBase64Url(new TextEncoder().encode('no-json'))}.${aBase64Url(new TextEncoder().encode('no-json'))}.AAAA`],
      ['cabecera que no es objeto', `${jsonBase64Url([1])}.${jsonBase64Url({})}.AAAA`],
    ])('%s: FORMATO', async (_n, token) => {
      expect(await verifyQrOffline(token, clave, AHORA)).toEqual({ ok: false, motivo: 'FORMATO' });
    });

    it('un token que no es string: FORMATO', async () => {
      expect(await verifyQrOffline(undefined as unknown as string, clave, AHORA)).toEqual({ ok: false, motivo: 'FORMATO' });
    });

    it('una clave JWK inservible: FIRMA, sin excepción', async () => {
      const r = await verifyQrOffline(await firmar(), { kid: KID, jwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } }, AHORA);
      expect(r).toEqual({ ok: false, motivo: 'FIRMA' });
    });
  });

  it('decodifica base64url sin padding con payloads de cualquier largo', async () => {
    // El nombre largo cambia el largo del payload y con eso el padding omitido.
    for (const relleno of ['', 'a', 'ab', 'abc', 'abcd']) {
      const r = await verifyQrOffline(await firmar({ extra: relleno }), clave, AHORA);
      expect(r.ok).toBe(true);
    }
  });
});
