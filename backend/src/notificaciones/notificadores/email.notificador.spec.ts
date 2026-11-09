import { EmailNotificador } from './email.notificador';
import { describirErrorMail } from '../../common/helpers/error-mail.helper';

const destinatario = {
  id: 'u-42',
  nombre: 'Ana',
  email: 'ana.secreta@x.com',
  emailVerificado: true,
};
const mensaje = {
  tipo: 'GENERAL',
  titulo: 'Hola',
  mensaje: 'Texto',
} as never;

function armar(enviarCorreo: jest.Mock) {
  const notificador = new EmailNotificador({ enviar: enviarCorreo });
  const warn = jest
    .spyOn(
      (notificador as unknown as { logger: { warn: () => void } }).logger,
      'warn',
    )
    .mockImplementation(() => undefined);
  return { notificador, warn };
}

describe('EmailNotificador - logs de error', () => {
  it('registra id y códigos técnicos, nunca el email ni el message', async () => {
    const { notificador, warn } = armar(
      jest.fn().mockRejectedValue(
        Object.assign(new Error('Recipient ana.secreta@x.com rejected'), {
          code: 'EAUTH',
          responseCode: 535,
          command: 'AUTH PLAIN',
        }),
      ),
    );
    expect(await notificador.enviar(destinatario, mensaje)).toBe(false);
    const texto = JSON.stringify(warn.mock.calls);
    expect(texto).not.toContain('ana.secreta@x.com');
    expect(texto).not.toContain('rejected');
    expect(texto).toContain('u-42');
    expect(texto).toContain('code=EAUTH');
    expect(texto).toContain('responseCode=535');
    expect(texto).toContain('command=AUTH PLAIN');
  });

  it('en un timeout indica cuántos ms tardó', async () => {
    const { notificador, warn } = armar(
      jest.fn().mockRejectedValue(
        Object.assign(new Error('x ana.secreta@x.com'), {
          code: 'ETIMEDOUT',
        }),
      ),
    );
    await notificador.enviar(destinatario, mensaje);
    const texto = JSON.stringify(warn.mock.calls);
    expect(texto).toMatch(/code=ETIMEDOUT tardó=\d+ms/);
    expect(texto).not.toContain('ana.secreta@x.com');
  });
});

describe('describirErrorMail', () => {
  it('ignora valores no seguros (p. ej. una dirección en command)', () => {
    expect(describirErrorMail({ command: 'RCPT a@x.com' })).toBe(
      'sin código técnico',
    );
    expect(describirErrorMail(undefined)).toBe('sin código técnico');
  });
});
