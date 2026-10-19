import * as webpush from 'web-push';
import type { PushSuscripcion } from '../../entities';
import { PushConfig } from '../push/push.config';
import {
  CanalNotificacion,
  TipoNotificacion,
  type Destinatario,
  type MensajeNotificacion,
} from '../notificaciones.types';
import {
  PAUSA_ENTRE_PUSH_MS,
  PushNotificador,
  TTL_PUSH_SEGUNDOS,
} from './push.notificador';

jest.mock('web-push', () => ({ sendNotification: jest.fn() }));
const sendNotification = webpush.sendNotification as jest.Mock;

const destinatario: Destinatario = {
  id: 'u1',
  nombre: 'Ana',
  email: 'ana@ejemplo.com',
  emailVerificado: true,
};
const mensaje: MensajeNotificacion = {
  tipo: TipoNotificacion.CLASE_CANCELADA,
  titulo: 'Clase cancelada: Yoga',
  mensaje: 'Tu clase fue cancelada.',
};
const sus = (id: string): PushSuscripcion =>
  ({
    id,
    endpoint: `https://push.ejemplo.com/${id}`,
    p256dh: 'p256dh-' + id,
    auth: 'auth-' + id,
  }) as PushSuscripcion;

const configCon = (valores: Record<string, string>) =>
  new PushConfig({ get: (k: string) => valores[k] } as never);
const CONFIG_OK = {
  VAPID_PUBLIC_KEY: 'publica',
  VAPID_PRIVATE_KEY: 'privada',
  VAPID_SUBJECT: 'mailto:admin@ejemplo.com',
};

function armar(
  config = configCon(CONFIG_OK),
  suscripciones: PushSuscripcion[] = [],
) {
  const repo = {
    count: jest.fn().mockResolvedValue(suscripciones.length),
    find: jest.fn().mockResolvedValue(suscripciones),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const notificador = new PushNotificador(repo as never, config);
  return { notificador, repo };
}

describe('PushNotificador', () => {
  beforeEach(() => sendNotification.mockReset());

  it('declara el canal PUSH y una pausa entre envíos', () => {
    const { notificador } = armar();
    expect(notificador.canal).toBe(CanalNotificacion.PUSH);
    expect(notificador.pausaMs).toBe(PAUSA_ENTRE_PUSH_MS);
    expect(notificador.pausaMs).toBeGreaterThan(0);
  });

  describe('canal deshabilitado (sin claves VAPID)', () => {
    it.each([
      ['sin ninguna variable', {}],
      ['falta la clave privada', { ...CONFIG_OK, VAPID_PRIVATE_KEY: '' }],
      ['falta el subject', { ...CONFIG_OK, VAPID_SUBJECT: undefined }],
      ['subject inválido', { ...CONFIG_OK, VAPID_SUBJECT: 'admin@x.com' }],
    ])('%s: puedeNotificar es false sin consultar la base', async (_, vars) => {
      const { notificador, repo } = armar(
        configCon(vars as Record<string, string>),
        [sus('a')],
      );
      await expect(notificador.puedeNotificar(destinatario)).resolves.toBe(
        false,
      );
      await expect(notificador.enviar(destinatario, mensaje)).resolves.toBe(
        false,
      );
      expect(repo.count).not.toHaveBeenCalled();
      expect(repo.find).not.toHaveBeenCalled();
      expect(sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('puedeNotificar (canal configurado)', () => {
    it('true si el usuario tiene suscripciones', async () => {
      const { notificador, repo } = armar(undefined, [sus('a')]);
      await expect(notificador.puedeNotificar(destinatario)).resolves.toBe(
        true,
      );
      expect(repo.count).toHaveBeenCalledWith({
        where: { usuario: { id: 'u1' } },
      });
    });

    it('false si no tiene suscripciones', async () => {
      const { notificador } = armar(undefined, []);
      await expect(notificador.puedeNotificar(destinatario)).resolves.toBe(
        false,
      );
    });

    it('false (sin lanzar) si la consulta falla', async () => {
      const { notificador, repo } = armar();
      repo.count.mockRejectedValue(new Error('db caída'));
      await expect(notificador.puedeNotificar(destinatario)).resolves.toBe(
        false,
      );
    });
  });

  describe('enviar', () => {
    it('manda a cada suscripción con TTL corto y payload mínimo', async () => {
      sendNotification.mockResolvedValue({ statusCode: 201 });
      const { notificador } = armar(undefined, [sus('a'), sus('b')]);

      await expect(notificador.enviar(destinatario, mensaje)).resolves.toBe(
        true,
      );

      expect(sendNotification).toHaveBeenCalledTimes(2);
      const [subscription, payload, opciones] = sendNotification.mock
        .calls[0] as [unknown, string, Record<string, unknown>];
      expect(subscription).toEqual({
        endpoint: 'https://push.ejemplo.com/a',
        keys: { p256dh: 'p256dh-a', auth: 'auth-a' },
      });
      expect(JSON.parse(payload)).toEqual({
        titulo: 'Clase cancelada: Yoga',
        cuerpo: 'Tu clase fue cancelada.',
        url: '/notificaciones',
      });
      expect(opciones.TTL).toBe(TTL_PUSH_SEGUNDOS);
      expect(TTL_PUSH_SEGUNDOS).toBeLessThanOrEqual(24 * 3600);
      expect(opciones.vapidDetails).toEqual({
        subject: 'mailto:admin@ejemplo.com',
        publicKey: 'publica',
        privateKey: 'privada',
      });
    });

    it('el payload no lleva más campos que titulo, cuerpo y url', async () => {
      sendNotification.mockResolvedValue({});
      const { notificador } = armar(undefined, [sus('a')]);
      await notificador.enviar(destinatario, {
        ...mensaje,
        envioId: 'envio-1',
      });
      const payload = JSON.parse(
        (sendNotification.mock.calls[0] as [unknown, string])[1],
      ) as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual(['cuerpo', 'titulo', 'url']);
    });

    it('recorta título y cuerpo largos', async () => {
      sendNotification.mockResolvedValue({});
      const { notificador } = armar(undefined, [sus('a')]);
      await notificador.enviar(destinatario, {
        ...mensaje,
        titulo: 't'.repeat(500),
        mensaje: 'm'.repeat(1000),
      });
      const payload = JSON.parse(
        (sendNotification.mock.calls[0] as [unknown, string])[1],
      ) as { titulo: string; cuerpo: string };
      expect(payload.titulo.length).toBeLessThanOrEqual(80);
      expect(payload.cuerpo.length).toBeLessThanOrEqual(140);
    });

    it.each([404, 410])(
      'ante %i borra esa suscripción y sigue con las demás',
      async (statusCode) => {
        sendNotification
          .mockRejectedValueOnce(
            Object.assign(new Error('gone'), { statusCode }),
          )
          .mockResolvedValueOnce({});
        const { notificador, repo } = armar(undefined, [sus('a'), sus('b')]);

        await expect(notificador.enviar(destinatario, mensaje)).resolves.toBe(
          true,
        );

        expect(repo.delete).toHaveBeenCalledTimes(1);
        expect(repo.delete).toHaveBeenCalledWith({ id: 'a' });
        expect(sendNotification).toHaveBeenCalledTimes(2);
      },
    );

    it('otro error no se propaga, no borra la suscripción y no filtra el endpoint al log', async () => {
      sendNotification.mockRejectedValue(
        Object.assign(new Error('https://push.ejemplo.com/a boom'), {
          statusCode: 500,
        }),
      );
      const { notificador, repo } = armar(undefined, [sus('a')]);
      const warn = jest
        .spyOn(
          (notificador as unknown as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      await expect(notificador.enviar(destinatario, mensaje)).resolves.toBe(
        false,
      );

      expect(repo.delete).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      const linea = String((warn.mock.calls[0] as unknown[])[0]);
      expect(linea).toContain('500');
      expect(linea).not.toContain('push.ejemplo.com');
    });

    it('un error sin statusCode (red) tampoco se propaga', async () => {
      sendNotification.mockRejectedValue(new Error('ECONNRESET'));
      const { notificador } = armar(undefined, [sus('a')]);
      await expect(notificador.enviar(destinatario, mensaje)).resolves.toBe(
        false,
      );
    });

    it('si falla el borrado de una suscripción vencida, no se propaga', async () => {
      sendNotification.mockRejectedValue(
        Object.assign(new Error('gone'), { statusCode: 410 }),
      );
      const { notificador, repo } = armar(undefined, [sus('a')]);
      repo.delete.mockRejectedValue(new Error('db'));
      await expect(notificador.enviar(destinatario, mensaje)).resolves.toBe(
        false,
      );
    });

    it('false (sin lanzar) si no se pueden leer las suscripciones o no hay', async () => {
      const { notificador, repo } = armar(undefined, []);
      await expect(notificador.enviar(destinatario, mensaje)).resolves.toBe(
        false,
      );
      repo.find.mockRejectedValue(new Error('db'));
      await expect(notificador.enviar(destinatario, mensaje)).resolves.toBe(
        false,
      );
      expect(sendNotification).not.toHaveBeenCalled();
    });
  });
});
