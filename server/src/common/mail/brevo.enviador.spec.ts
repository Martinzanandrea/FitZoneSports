import { BREVO_TIMEOUT_MS, BREVO_URL, BrevoEnviador } from './brevo.enviador';
import { ErrorEnvioCorreo } from './enviador-correo';

const API_KEY = 'xkeysib-clave-super-secreta-123';
const mensaje = {
  para: 'ana.secreta@x.com',
  asunto: 'Hola\r\nBcc: otro@x.com',
  html: '<p>cuerpo privado</p>',
};

function armar() {
  return new BrevoEnviador({
    apiKey: API_KEY,
    remitenteEmail: 'no-responder@fitzone.com',
    remitenteNombre: 'FitZone Sports',
  });
}

function respuesta(status: number, cuerpo?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      cuerpo === undefined
        ? Promise.reject(new Error('sin cuerpo'))
        : Promise.resolve(cuerpo),
  } as Response;
}

describe('BrevoEnviador', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hace POST a la API de Brevo con headers y body correctos', async () => {
    fetchMock.mockResolvedValue(respuesta(201, { messageId: '<x@y>' }));
    await armar().enviar({ ...mensaje, texto: 'versión texto' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(BREVO_URL);
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'api-key': API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { email: 'no-responder@fitzone.com', name: 'FitZone Sports' },
      to: [{ email: 'ana.secreta@x.com' }],
      subject: 'Hola Bcc: otro@x.com', // sin saltos de línea
      htmlContent: '<p>cuerpo privado</p>',
      textContent: 'versión texto',
    });
  });

  it('sin texto no manda textContent', async () => {
    fetchMock.mockResolvedValue(respuesta(201, {}));
    await armar().enviar(mensaje);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty('textContent');
  });

  it('éxito 201: resuelve sin valor', async () => {
    fetchMock.mockResolvedValue(respuesta(201, { messageId: '<x@y>' }));
    await expect(armar().enviar(mensaje)).resolves.toBeUndefined();
  });

  it.each([
    [400, 'invalid_parameter'],
    [401, 'unauthorized'],
  ])(
    'error %i: incluye status y code, sin datos sensibles',
    async (status, code) => {
      fetchMock.mockResolvedValue(
        respuesta(status, {
          code,
          message: `falló para ana.secreta@x.com con ${API_KEY}`,
        }),
      );
      const err = await armar()
        .enviar(mensaje)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ErrorEnvioCorreo);
      const e = err as ErrorEnvioCorreo;
      expect(e.status).toBe(status);
      expect(e.code).toBe(code);
      expect(e.message).toContain(String(status));
      expect(e.message).toContain(code);
      expect(e.message).not.toContain(API_KEY);
      expect(e.message).not.toContain('ana.secreta@x.com');
      expect(JSON.stringify(e)).not.toContain(API_KEY);
    },
  );

  it('error sin JSON o con code no seguro: solo el status', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(502));
    const e1 = (await armar()
      .enviar(mensaje)
      .catch((e: unknown) => e)) as ErrorEnvioCorreo;
    expect(e1.status).toBe(502);
    expect(e1.code).toBeUndefined();

    fetchMock.mockResolvedValueOnce(
      respuesta(400, { code: 'ana.secreta@x.com' }),
    );
    const e2 = (await armar()
      .enviar(mensaje)
      .catch((e: unknown) => e)) as ErrorEnvioCorreo;
    expect(e2.code).toBeUndefined();
    expect(e2.message).not.toContain('ana.secreta@x.com');
  });

  it('timeout: aborta a los 10 s y falla con ETIMEDOUT sin la API key', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(
              Object.assign(new Error(`abortado ${API_KEY}`), {
                name: 'AbortError',
              }),
            ),
          );
        }),
    );
    const promesa = armar()
      .enviar(mensaje)
      .catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(BREVO_TIMEOUT_MS - 1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(init.signal?.aborted).toBe(true);

    const e = (await promesa) as ErrorEnvioCorreo;
    expect(e).toBeInstanceOf(ErrorEnvioCorreo);
    expect(e.code).toBe('ETIMEDOUT');
    expect(e.message).not.toContain(API_KEY);
  });

  it('error de red: código seguro de la causa o ENETWORK, sin el message original', async () => {
    fetchMock.mockRejectedValueOnce(
      Object.assign(new TypeError(`fetch failed ${API_KEY}`), {
        cause: { code: 'ENOTFOUND' },
      }),
    );
    const e1 = (await armar()
      .enviar(mensaje)
      .catch((e: unknown) => e)) as ErrorEnvioCorreo;
    expect(e1.code).toBe('ENOTFOUND');
    expect(e1.message).not.toContain(API_KEY);

    fetchMock.mockRejectedValueOnce(new TypeError(`raro ${API_KEY}`));
    const e2 = (await armar()
      .enviar(mensaje)
      .catch((e: unknown) => e)) as ErrorEnvioCorreo;
    expect(e2.code).toBe('ENETWORK');
    expect(e2.message).not.toContain(API_KEY);
  });
});
