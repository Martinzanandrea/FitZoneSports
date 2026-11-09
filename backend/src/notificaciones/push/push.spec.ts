import { ServiceUnavailableException, ValidationPipe } from '@nestjs/common';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { TipoActor } from '../../entities/enums';
import type { PushSuscripcion } from '../../entities';
import { PushController } from './push.controller';
import { SuscribirPushDto, DesuscribirPushDto } from './push.dto';
import { PushConfig } from './push.config';
import { PushSuscripcionesService } from './push-suscripciones.service';

// Repositorio en memoria con la semántica relevante de la tabla:
// endpoint único, upsert por endpoint y delete filtrado por dueño.
function repoEnMemoria() {
  const filas = new Map<string, { usuarioId: string; p256dh: string }>();
  return {
    filas,
    upsert: jest.fn(
      (
        e: { usuario: { id: string }; endpoint: string; p256dh: string },
        conflicto: string[],
      ) => {
        expect(conflicto).toEqual(['endpoint']);
        filas.set(e.endpoint, { usuarioId: e.usuario.id, p256dh: e.p256dh });
        return Promise.resolve();
      },
    ),
    delete: jest.fn(
      (criterio: { endpoint: string; usuario: { id: string } }) => {
        const fila = filas.get(criterio.endpoint);
        if (fila && fila.usuarioId === criterio.usuario.id) {
          filas.delete(criterio.endpoint);
          return Promise.resolve({ affected: 1 });
        }
        return Promise.resolve({ affected: 0 });
      },
    ),
  };
}

const configCon = (valores: Record<string, string>) =>
  new PushConfig({ get: (k: string) => valores[k] } as never);

const dto = (
  endpoint = 'https://push.ejemplo.com/abc',
  p256dh = 'BKey_-1',
): SuscribirPushDto => ({
  endpoint,
  keys: { p256dh, auth: 'auth_-1' },
});

describe('PushSuscripcionesService', () => {
  function armar(config = configCon({})) {
    const repo = repoEnMemoria();
    const service = new PushSuscripcionesService(repo as never, config);
    return { repo, service };
  }

  describe('clave pública', () => {
    it('devuelve { clavePublica } si está configurada', () => {
      const { service } = armar(
        configCon({
          VAPID_PUBLIC_KEY: 'pub',
          VAPID_PRIVATE_KEY: 'priv',
          VAPID_SUBJECT: 'mailto:a@b.com',
        }),
      );
      expect(service.obtenerClavePublica()).toEqual({ clavePublica: 'pub' });
    });

    it('503 con mensaje claro si no está configurada', () => {
      const { service } = armar();
      expect(() => service.obtenerClavePublica()).toThrow(
        ServiceUnavailableException,
      );
      expect(() => service.obtenerClavePublica()).toThrow(
        /no están configuradas/,
      );
    });

    it('nunca expone la clave privada', () => {
      const { service } = armar(
        configCon({
          VAPID_PUBLIC_KEY: 'pub',
          VAPID_PRIVATE_KEY: 'priv',
          VAPID_SUBJECT: 'mailto:a@b.com',
        }),
      );
      expect(JSON.stringify(service.obtenerClavePublica())).not.toContain(
        'priv',
      );
    });
  });

  describe('suscribir', () => {
    it('guarda la suscripción del usuario del token', async () => {
      const { service, repo } = armar();
      await expect(service.suscribir('u1', dto(), 'UA/1')).resolves.toEqual({
        suscrito: true,
      });
      expect(repo.filas.get('https://push.ejemplo.com/abc')?.usuarioId).toBe(
        'u1',
      );
      const guardado = (
        repo.upsert.mock.calls[0] as unknown as [Partial<PushSuscripcion>]
      )[0];
      expect(guardado.userAgent).toBe('UA/1');
    });

    it('es idempotente: repetir no duplica la fila', async () => {
      const { service, repo } = armar();
      await service.suscribir('u1', dto());
      await service.suscribir('u1', dto());
      expect(repo.filas.size).toBe(1);
    });

    it('si el endpoint ya existe lo reasigna al usuario actual y actualiza las claves', async () => {
      const { service, repo } = armar();
      await service.suscribir('u1', dto());
      await service.suscribir('u2', dto(undefined, 'BNueva'));
      expect(repo.filas.size).toBe(1);
      expect(repo.filas.get('https://push.ejemplo.com/abc')).toEqual({
        usuarioId: 'u2',
        p256dh: 'BNueva',
      });
    });

    it('recorta el user-agent y acepta que falte', async () => {
      const { service, repo } = armar();
      await service.suscribir(
        'u1',
        dto('https://push.ejemplo.com/1'),
        'x'.repeat(1000),
      );
      await service.suscribir('u1', dto('https://push.ejemplo.com/2'));
      const [a, b] = repo.upsert.mock.calls.map(
        (c) => (c as unknown as [Partial<PushSuscripcion>])[0],
      );
      expect(a.userAgent).toHaveLength(300);
      expect(b.userAgent).toBeNull();
    });
  });

  describe('desuscribir', () => {
    it('borra la suscripción propia', async () => {
      const { service, repo } = armar();
      await service.suscribir('u1', dto());
      await expect(
        service.desuscribir('u1', 'https://push.ejemplo.com/abc'),
      ).resolves.toEqual({ eliminada: true });
      expect(repo.filas.size).toBe(0);
    });

    it('no borra la de otro usuario', async () => {
      const { service, repo } = armar();
      await service.suscribir('u1', dto());
      await expect(
        service.desuscribir('u2', 'https://push.ejemplo.com/abc'),
      ).resolves.toEqual({ eliminada: false });
      expect(repo.filas.size).toBe(1);
    });

    it('un endpoint inexistente responde igual, sin error', async () => {
      const { service } = armar();
      await expect(
        service.desuscribir('u1', 'https://push.ejemplo.com/nada'),
      ).resolves.toEqual({ eliminada: false });
    });
  });
});

describe('PushController', () => {
  it('todos sus handlers declaran @Roles con todos los roles (cualquier usuario autenticado)', () => {
    const todos = Object.values(TipoActor);
    for (const nombre of [
      'clavePublica',
      'suscribir',
      'desuscribir',
    ] as const) {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        PushController.prototype[nombre],
      ) as TipoActor[];
      expect([...roles].sort()).toEqual([...todos].sort());
    }
  });

  it('usa siempre el id del usuario autenticado, no uno del cuerpo', async () => {
    const service = {
      suscribir: jest.fn().mockResolvedValue({ suscrito: true }),
      desuscribir: jest.fn().mockResolvedValue({ eliminada: true }),
    };
    const controller = new PushController(service as never);
    const user = { id: 'u1' } as never;
    await controller.suscribir(dto(), user, 'UA');
    await controller.desuscribir(
      { endpoint: 'https://push.ejemplo.com/abc' },
      user,
    );
    expect(service.suscribir).toHaveBeenCalledWith('u1', dto(), 'UA');
    expect(service.desuscribir).toHaveBeenCalledWith(
      'u1',
      'https://push.ejemplo.com/abc',
    );
  });
});

describe('Validación de los DTO', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const validar = (metatype: new () => object, value: unknown) =>
    pipe.transform(value, { type: 'body', metatype });

  const valido = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    },
  };

  it('acepta una suscripción válida', async () => {
    await expect(validar(SuscribirPushDto, valido)).resolves.toBeInstanceOf(
      SuscribirPushDto,
    );
  });

  it.each([
    ['endpoint http', { ...valido, endpoint: 'http://push.ejemplo.com/a' }],
    ['endpoint no url', { ...valido, endpoint: 'no-es-url' }],
    ['endpoint ausente', { keys: valido.keys }],
    [
      'endpoint demasiado largo',
      { ...valido, endpoint: 'https://push.ejemplo.com/' + 'a'.repeat(2100) },
    ],
    ['sin keys', { endpoint: valido.endpoint }],
    ['keys no objeto', { ...valido, keys: 'x' }],
    ['p256dh ausente', { ...valido, keys: { auth: 'abc' } }],
    ['auth vacío', { ...valido, keys: { ...valido.keys, auth: '' } }],
    [
      'auth con caracteres inválidos',
      { ...valido, keys: { ...valido.keys, auth: 'a b<script>' } },
    ],
    [
      'p256dh demasiado largo',
      { ...valido, keys: { ...valido.keys, p256dh: 'a'.repeat(300) } },
    ],
  ])('rechaza: %s', async (_, cuerpo) => {
    await expect(validar(SuscribirPushDto, cuerpo)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('descarta campos extra (no se puede inyectar usuario)', async () => {
    const r = (await validar(SuscribirPushDto, {
      ...valido,
      usuarioId: 'otro',
    })) as Record<string, unknown>;
    expect(r.usuarioId).toBeUndefined();
  });

  it('la baja exige un endpoint https', async () => {
    await expect(
      validar(DesuscribirPushDto, { endpoint: valido.endpoint }),
    ).resolves.toBeInstanceOf(DesuscribirPushDto);
    await expect(
      validar(DesuscribirPushDto, { endpoint: 'http://x.com/a' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(validar(DesuscribirPushDto, {})).rejects.toMatchObject({
      status: 400,
    });
  });
});
