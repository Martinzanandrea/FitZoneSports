import { EmailVerificacionService } from './email-verificacion.service';

const enviar = jest.fn();

function armar(extra: Record<string, string> = {}) {
  const valores: Record<string, string> = {
    FRONTEND_URL: 'http://front',
    ...extra,
  };
  const service = new EmailVerificacionService(
    { get: (k: string) => valores[k] } as never,
    { enviar },
  );
  const warn = jest
    .spyOn(
      (service as unknown as { logger: { warn: () => void } }).logger,
      'warn',
    )
    .mockImplementation(() => undefined);
  return { service, warn };
}

describe('EmailVerificacionService', () => {
  beforeEach(() => {
    enviar.mockReset().mockResolvedValue(undefined);
  });

  it('envía al destinatario con el asunto de verificación', async () => {
    const { service } = armar();
    await service.enviarVerificacion('a@x.com', 'Ana', 'tok');
    expect(enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        para: 'a@x.com',
        asunto: 'Confirmá tu email en FitZone Sports',
      }),
    );
  });

  it('escapa el nombre en el HTML del mail', async () => {
    const { service } = armar();
    await service.enviarVerificacion(
      'a@x.com',
      '<script>alert(1)</script>',
      'tok',
    );
    const html = (enviar.mock.calls[0] as Array<{ html: string }>)[0].html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('el token va codificado en el link', async () => {
    const { service } = armar();
    await service.enviarVerificacion('a@x.com', 'Ana', 'a b&c');
    const html = (enviar.mock.calls[0] as Array<{ html: string }>)[0].html;
    expect(html).toContain('token=a%20b%26c');
  });

  it('no imprime email ni token por consola (ni en desarrollo por defecto)', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { service } = armar();
    await service.enviarVerificacion('a@x.com', 'Ana', 'tok');
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('solo con MAIL_DEV_LOG_LINKS=true imprime el link, y nunca el email', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { service } = armar({ MAIL_DEV_LOG_LINKS: 'true' });
    await service.enviarVerificacion('a@x.com', 'Ana', 'tok');
    const texto = JSON.stringify(log.mock.calls);
    expect(texto).toContain('verificar-email');
    expect(texto).not.toContain('a@x.com');
    log.mockRestore();
  });

  it('un rechazo del SMTP no se registra ni se relanza con la dirección', async () => {
    enviar.mockRejectedValue(
      Object.assign(new Error('Recipient a@x.com rejected'), {
        code: 'EENVELOPE',
      }),
    );
    const { service, warn } = armar();
    const err = await service
      .enviarVerificacion('a@x.com', 'Ana', 'tok')
      .catch((e: unknown) => e);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('a@x.com');
    expect((err as Error).message).not.toContain('a@x.com');
    expect((err as Error).message).toContain('EENVELOPE');
  });

  it('el log trae code/responseCode/command y ms si hubo timeout, sin el email', async () => {
    enviar.mockRejectedValue(
      Object.assign(new Error('timeout enviando a a@x.com'), {
        code: 'ETIMEDOUT',
        responseCode: 421,
        command: 'CONN',
      }),
    );
    const { service, warn } = armar();
    await service.enviarVerificacion('a@x.com', 'Ana', 'tok').catch(() => 0);
    const texto = JSON.stringify(warn.mock.calls);
    expect(texto).toContain('code=ETIMEDOUT');
    expect(texto).toContain('responseCode=421');
    expect(texto).toContain('command=CONN');
    expect(texto).toMatch(/tardó=\d+ms/);
    expect(texto).not.toContain('a@x.com');
    expect(texto).not.toContain('timeout enviando');
  });

  it('un rechazo de Brevo (status + code) se registra sin el email', async () => {
    enviar.mockRejectedValue(
      Object.assign(new Error('Brevo rechazó a a@x.com'), {
        code: 'invalid_parameter',
        status: 400,
      }),
    );
    const { service, warn } = armar();
    const err = await service
      .enviarVerificacion('a@x.com', 'Ana', 'tok')
      .catch((e: unknown) => e);
    const texto = JSON.stringify(warn.mock.calls);
    expect(texto).toContain('code=invalid_parameter');
    expect(texto).toContain('status=400');
    expect(texto).not.toContain('a@x.com');
    expect((err as Error).message).toContain('invalid_parameter');
    expect((err as Error).message).not.toContain('a@x.com');
  });
});
