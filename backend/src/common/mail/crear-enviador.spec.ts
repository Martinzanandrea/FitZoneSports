import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BrevoEnviador } from './brevo.enviador';
import { crearEnviadorCorreo } from './crear-enviador';
import { ENVIADOR_CORREO } from './enviador-correo';
import { GmailSmtpEnviador } from './gmail-smtp.enviador';
import { MailModule } from './mail.module';

function config(valores: Record<string, string | undefined>) {
  return { get: (k: string) => valores[k] } as unknown as ConfigService;
}

describe('crearEnviadorCorreo (MAIL_PROVIDER)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('brevo con API key y remitente: BrevoEnviador', () => {
    const e = crearEnviadorCorreo(
      config({
        MAIL_PROVIDER: 'brevo',
        BREVO_API_KEY: 'k',
        MAIL_FROM_EMAIL: 'a@b.com',
      }),
    );
    expect(e).toBeInstanceOf(BrevoEnviador);
  });

  it('el valor se normaliza (mayúsculas y espacios)', () => {
    const e = crearEnviadorCorreo(
      config({
        MAIL_PROVIDER: '  BREVO ',
        BREVO_API_KEY: 'k',
        MAIL_FROM_EMAIL: 'a@b.com',
      }),
    );
    expect(e).toBeInstanceOf(BrevoEnviador);
  });

  it('gmail: GmailSmtpEnviador', () => {
    expect(
      crearEnviadorCorreo(config({ MAIL_PROVIDER: 'gmail' })),
    ).toBeInstanceOf(GmailSmtpEnviador);
  });

  it('sin MAIL_PROVIDER (o vacío): gmail por defecto', () => {
    expect(crearEnviadorCorreo(config({}))).toBeInstanceOf(GmailSmtpEnviador);
    expect(crearEnviadorCorreo(config({ MAIL_PROVIDER: '' }))).toBeInstanceOf(
      GmailSmtpEnviador,
    );
  });

  it('valor desconocido: falla al arrancar, sin imprimir el valor', () => {
    expect(() =>
      crearEnviadorCorreo(config({ MAIL_PROVIDER: 'sendgrid-secreto' })),
    ).toThrow(/MAIL_PROVIDER inválido/);
    try {
      crearEnviadorCorreo(config({ MAIL_PROVIDER: 'sendgrid-secreto' }));
    } catch (e) {
      expect((e as Error).message).not.toContain('sendgrid-secreto');
    }
  });

  it('brevo sin BREVO_API_KEY: falla nombrando la variable', () => {
    expect(() =>
      crearEnviadorCorreo(
        config({ MAIL_PROVIDER: 'brevo', MAIL_FROM_EMAIL: 'a@b.com' }),
      ),
    ).toThrow(/BREVO_API_KEY/);
  });

  it('brevo sin MAIL_FROM_EMAIL: falla nombrando la variable', () => {
    expect(() =>
      crearEnviadorCorreo(
        config({ MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'clave-secreta' }),
      ),
    ).toThrow(/MAIL_FROM_EMAIL/);
  });

  it('el error de configuración nunca incluye valores', () => {
    try {
      crearEnviadorCorreo(
        config({ MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'clave-secreta' }),
      );
      throw new Error('debía fallar');
    } catch (e) {
      expect((e as Error).message).not.toContain('clave-secreta');
    }
  });
});

describe('MailModule (inyección de ENVIADOR_CORREO)', () => {
  const previas = { ...process.env };
  afterEach(() => {
    process.env = { ...previas };
  });

  it('resuelve el proveedor según el entorno', async () => {
    process.env.MAIL_PROVIDER = 'brevo';
    process.env.BREVO_API_KEY = 'k';
    process.env.MAIL_FROM_EMAIL = 'a@b.com';
    const modulo = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        MailModule,
      ],
    }).compile();
    expect(modulo.get(ENVIADOR_CORREO)).toBeInstanceOf(BrevoEnviador);
  });

  it('con brevo mal configurado, la compilación del módulo falla (arranque)', async () => {
    process.env.MAIL_PROVIDER = 'brevo';
    delete process.env.BREVO_API_KEY;
    delete process.env.MAIL_FROM_EMAIL;
    await expect(
      Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
          MailModule,
        ],
      }).compile(),
    ).rejects.toThrow(/BREVO_API_KEY/);
  });
});
