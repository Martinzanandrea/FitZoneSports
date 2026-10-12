import type { ExecutionContext } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TipoActor } from '../entities/enums';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { NotificadorFactory } from './notificadores/notificador.factory';
import { PanelNotificador } from './notificadores/panel.notificador';
import {
  EmailNotificador,
  PAUSA_ENTRE_EMAILS_MS,
} from './notificadores/email.notificador';
import {
  AudienciaEnvio,
  CanalNotificacion,
  TipoNotificacion,
  type Destinatario,
  type MensajeNotificacion,
} from './notificaciones.types';
import { CrearEnvioDto } from './dto/crear-envio.dto';
import { NotificacionesQueryDto } from './dto/notificaciones-query.dto';

const msg: MensajeNotificacion = {
  tipo: TipoNotificacion.AVISO_GENERAL,
  titulo: 'Aviso',
  mensaje: 'Hola',
};
const dest = (id: string, extra: Partial<Destinatario> = {}): Destinatario => ({
  id,
  nombre: `Socio ${id}`,
  email: `${id}@ejemplo.com`,
  emailVerificado: true,
  ...extra,
});

function armarNotificadores() {
  const notifRepo = {
    create: jest.fn((x: unknown) => x),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const mail = { enviar: jest.fn().mockResolvedValue(undefined) };
  const panel = new PanelNotificador(notifRepo as never);
  const email = new EmailNotificador(mail);
  const factory = new NotificadorFactory(panel, email);
  return { notifRepo, mail, panel, email, factory };
}

describe('NotificadorFactory', () => {
  const { factory, panel, email } = armarNotificadores();

  it('devuelve el notificador de cada canal', () => {
    expect(factory.crear(CanalNotificacion.PANEL)).toBe(panel);
    expect(factory.crear(CanalNotificacion.EMAIL)).toBe(email);
  });

  it('canal desconocido: error claro', () => {
    expect(() => factory.crear('SMS' as CanalNotificacion)).toThrow(
      BadRequestException,
    );
  });
});

describe('PanelNotificador', () => {
  it('guarda una fila por destinatario', async () => {
    const { notifRepo, panel } = armarNotificadores();
    await panel.enviar(dest('a'), msg);
    await panel.enviar(dest('b'), msg);
    expect(notifRepo.save).toHaveBeenCalledTimes(2);
    expect(notifRepo.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        usuario: { id: 'a' },
        tipo: 'AVISO_GENERAL',
        titulo: 'Aviso',
      }),
    );
  });

  it('si falla el guardado devuelve false y no lanza', async () => {
    const { notifRepo, panel } = armarNotificadores();
    notifRepo.save.mockRejectedValue(new Error('db caída'));
    await expect(panel.enviar(dest('a'), msg)).resolves.toBe(false);
  });
});

describe('EmailNotificador', () => {
  it('un mail por destinatario verificado', async () => {
    const { mail, email } = armarNotificadores();
    expect(await email.enviar(dest('a'), msg)).toBe(true);
    expect(mail.enviar).toHaveBeenCalledTimes(1);
    expect(
      (mail.enviar.mock.calls as Array<[{ para: string }]>)[0][0].para,
    ).toBe('a@ejemplo.com');
  });

  it('no envía a emails sin verificar ni a quienes no tienen email', async () => {
    const { mail, email } = armarNotificadores();
    expect(await email.enviar(dest('a', { emailVerificado: false }), msg)).toBe(
      false,
    );
    expect(await email.enviar(dest('b', { email: null }), msg)).toBe(false);
    expect(mail.enviar).not.toHaveBeenCalled();
  });

  it('escapa el contenido (no inyecta HTML)', async () => {
    const { mail, email } = armarNotificadores();
    await email.enviar(dest('a', { nombre: '<script>x()</script>' }), {
      ...msg,
      titulo: '<b>Hola</b>',
      mensaje: '<img src=x onerror=alert(1)>\nlínea 2',
    });
    const html = (mail.enviar.mock.calls as Array<[{ html: string }]>)[0][0]
      .html;
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>Hola</b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;<br>línea 2');
  });

  it('ante un fallo del SMTP no lanza y no registra la dirección', async () => {
    const { mail, email } = armarNotificadores();
    mail.enviar.mockRejectedValue(new Error('rechazó a a@ejemplo.com'));
    const warn = jest
      .spyOn(
        (email as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    await expect(email.enviar(dest('a'), msg)).resolves.toBe(false);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('ejemplo.com');
  });
});

function armarServicio(opts?: {
  usuarios?: Array<Record<string, unknown>>;
  sede?: unknown;
}) {
  const n = armarNotificadores();
  const usuariosRepo = {
    find: jest.fn().mockResolvedValue(opts?.usuarios ?? []),
  };
  const sedesRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue(opts && 'sede' in opts ? opts.sede : { id: 's1' }),
  };
  const notificacionesRepo = {
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(3),
    update: jest.fn(),
  };
  const enviosRepo = {
    create: jest.fn((x: Record<string, unknown>) => ({
      ...x,
      id: 'envio1',
      creadaEn: new Date(),
    })),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
    update: jest.fn().mockResolvedValue(undefined),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  const service = new NotificacionesService(
    n.factory,
    notificacionesRepo as never,
    enviosRepo as never,
    usuariosRepo as never,
    sedesRepo as never,
  );
  const esperar = jest
    .spyOn(service as unknown as { esperar: () => Promise<void> }, 'esperar')
    .mockResolvedValue(undefined);
  return {
    service,
    ...n,
    usuariosRepo,
    sedesRepo,
    notificacionesRepo,
    enviosRepo,
    esperar,
  };
}

describe('NotificacionesService.notificar', () => {
  it('PANEL: una fila por destinatario', async () => {
    const { service, notifRepo } = armarServicio();
    const r = await service.notificar([dest('a'), dest('b'), dest('c')], msg, [
      CanalNotificacion.PANEL,
    ]);
    expect(notifRepo.save).toHaveBeenCalledTimes(3);
    expect(r.panelGuardadas).toBe(3);
  });

  it('EMAIL: solo verificados, con pausa entre envíos y sin contar a los omitidos', async () => {
    const { service, mail, esperar } = armarServicio();
    const r = await service.notificar(
      [dest('a'), dest('b', { emailVerificado: false }), dest('c')],
      msg,
      [CanalNotificacion.EMAIL],
    );
    expect(mail.enviar).toHaveBeenCalledTimes(2);
    expect(esperar).toHaveBeenCalledTimes(1);
    expect(esperar).toHaveBeenCalledWith(PAUSA_ENTRE_EMAILS_MS);
    expect(r).toMatchObject({ emailsEnviados: 2, emailsFallidos: 0 });
  });

  it('un mail que falla no frena a los demás y se cuenta como fallido', async () => {
    const { service, mail } = armarServicio();
    mail.enviar
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValue(undefined);
    const r = await service.notificar([dest('a'), dest('b')], msg, [
      CanalNotificacion.EMAIL,
    ]);
    expect(r).toMatchObject({ emailsEnviados: 1, emailsFallidos: 1 });
  });

  it('un canal desconocido se ignora y el resto sigue', async () => {
    const { service, notifRepo } = armarServicio();
    const r = await service.notificar([dest('a')], msg, [
      'SMS' as CanalNotificacion,
      CanalNotificacion.PANEL,
    ]);
    expect(notifRepo.save).toHaveBeenCalledTimes(1);
    expect(r.panelGuardadas).toBe(1);
  });

  it('un notificador que lanza no rompe el servicio', async () => {
    const { service, panel } = armarServicio();
    jest.spyOn(panel, 'enviar').mockRejectedValue(new Error('boom'));
    await expect(
      service.notificar([dest('a')], msg, [CanalNotificacion.PANEL]),
    ).resolves.toMatchObject({ panelGuardadas: 0 });
  });
});

describe('NotificacionesService: audiencias', () => {
  const socio = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    nombre: id,
    apellido: 'X',
    email: `${id}@x.com`,
    emailVerificado: true,
    tipoActor: TipoActor.SOCIO,
    activo: true,
    ...extra,
  });

  it('TODOS_LOS_SOCIOS consulta solo socios activos', async () => {
    const { service, usuariosRepo } = armarServicio({ usuarios: [socio('a')] });
    await service.resolverAudiencia({
      audiencia: AudienciaEnvio.TODOS_LOS_SOCIOS,
    });
    expect(usuariosRepo.find).toHaveBeenCalledWith({
      where: { tipoActor: TipoActor.SOCIO, activo: true },
    });
  });

  it('excluye inactivos y no socios aunque la consulta los devolviera, y deduplica', async () => {
    const { service } = armarServicio({
      usuarios: [
        socio('a'),
        socio('a'), // duplicado por el JOIN con membresías
        socio('b', { activo: false }),
        socio('c', { tipoActor: TipoActor.EXTERNO }),
        socio('d', { tipoActor: TipoActor.RECEPCIONISTA }),
        socio('e'),
      ],
    });
    const r = await service.resolverAudiencia({
      audiencia: AudienciaEnvio.TODOS_LOS_SOCIOS,
    });
    expect(r.map((d) => d.id)).toEqual(['a', 'e']);
  });

  it('SOCIOS_DE_SEDE filtra por sede asignada o sede de alta, ambas solo socios activos', async () => {
    const { service, usuariosRepo } = armarServicio({ usuarios: [socio('a')] });
    await service.resolverAudiencia({
      audiencia: AudienciaEnvio.SOCIOS_DE_SEDE,
      sedeId: 's1',
    });
    const where = (
      usuariosRepo.find.mock.calls as Array<[{ where: object[] }]>
    )[0][0].where;
    expect(where).toHaveLength(2);
    for (const w of where) {
      expect(w).toMatchObject({ tipoActor: TipoActor.SOCIO, activo: true });
    }
    expect(where[0]).toMatchObject({ sede: { id: 's1' } });
    expect(where[1]).toMatchObject({
      membresias: { sedeAlta: { id: 's1' } },
    });
  });

  it('SOCIOS_DE_SEDE con sede inexistente: 404', async () => {
    const { service } = armarServicio({ sede: null });
    await expect(
      service.resolverAudiencia({
        audiencia: AudienciaEnvio.SOCIOS_DE_SEDE,
        sedeId: 'nope',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SOCIO puntual inexistente, inactivo o no socio: 404', async () => {
    const { service } = armarServicio({
      usuarios: [socio('a', { tipoActor: TipoActor.EXTERNO })],
    });
    await expect(
      service.resolverAudiencia({
        audiencia: AudienciaEnvio.SOCIO,
        usuarioId: 'a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('previsualizar cuenta destinatarios y los de email verificado', async () => {
    const { service } = armarServicio({
      usuarios: [socio('a'), socio('b', { emailVerificado: false })],
    });
    await expect(
      service.previsualizar({ audiencia: AudienciaEnvio.TODOS_LOS_SOCIOS }),
    ).resolves.toEqual({ cantidad: 2, conEmailVerificado: 1 });
  });
});

describe('NotificacionesService.crearEnvio', () => {
  const gg = {
    id: 'gg1',
    tipoActor: TipoActor.GERENTE_GENERAL,
    email: 'g@x.com',
    sedeId: null,
  };
  const dto = {
    titulo: 'Cerramos el lunes',
    mensaje: 'Feriado',
    audiencia: AudienciaEnvio.TODOS_LOS_SOCIOS,
    canales: [CanalNotificacion.PANEL, CanalNotificacion.EMAIL],
  };
  const socioA = {
    id: 'a',
    nombre: 'A',
    email: 'a@x.com',
    emailVerificado: true,
    tipoActor: TipoActor.SOCIO,
    activo: true,
  };

  it('responde sin esperar a que terminen los envíos (asíncrono)', async () => {
    const { service } = armarServicio({ usuarios: [socioA] });
    let terminar!: () => void;
    jest.spyOn(service, 'notificar').mockReturnValue(
      new Promise((res) => {
        terminar = () =>
          res({
            destinatarios: 1,
            panelGuardadas: 1,
            emailsEnviados: 1,
            emailsFallidos: 0,
          });
      }),
    );
    const r = await service.crearEnvio(dto, gg);
    expect(r.totalDestinatarios).toBe(1);
    expect(r.emailsEnviados).toBe(0);
    terminar();
  });

  it('al terminar actualiza los totales de mails enviados y fallidos', async () => {
    const { service, enviosRepo } = armarServicio();
    jest.spyOn(service, 'notificar').mockResolvedValue({
      destinatarios: 3,
      panelGuardadas: 3,
      emailsEnviados: 2,
      emailsFallidos: 1,
    });
    await service.procesarEnvio('envio1', [dest('a')], msg, [
      CanalNotificacion.EMAIL,
    ]);
    expect(enviosRepo.update).toHaveBeenCalledWith('envio1', {
      emailsEnviados: 2,
      emailsFallidos: 1,
    });
  });

  it('procesarEnvio nunca rechaza', async () => {
    const { service } = armarServicio();
    jest.spyOn(service, 'notificar').mockRejectedValue(new Error('x'));
    await expect(
      service.procesarEnvio('envio1', [], msg, []),
    ).resolves.toBeUndefined();
  });

  it('sin destinatarios: 400 y no registra el envío', async () => {
    const { service, enviosRepo } = armarServicio({ usuarios: [] });
    await expect(service.crearEnvio(dto, gg)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(enviosRepo.save).not.toHaveBeenCalled();
  });

  it('guarda quién lo creó y el total', async () => {
    const { service, enviosRepo } = armarServicio({ usuarios: [socioA] });
    jest.spyOn(service, 'procesarEnvio').mockResolvedValue(undefined);
    await service.crearEnvio(dto, gg);
    expect(enviosRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        creadoPor: { id: 'gg1' },
        totalDestinatarios: 1,
      }),
    );
  });
});

describe('NotificacionesService: campanita del Socio', () => {
  it('listar y contar usan el id del JWT', async () => {
    const { service, notificacionesRepo } = armarServicio();
    await service.listar('u1', { page: 2, limit: 20 });
    expect(notificacionesRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuario: { id: 'u1' } },
        skip: 20,
        take: 20,
      }),
    );
    await expect(service.contarNoLeidas('u1')).resolves.toEqual({
      noLeidas: 3,
    });
  });

  it('marcar como leída una ajena (o inexistente): 404 y no actualiza', async () => {
    const { service, notificacionesRepo } = armarServicio();
    await expect(service.marcarLeida('n1', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // la búsqueda exige que sea del usuario autenticado
    expect(notificacionesRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'n1', usuario: { id: 'u1' } },
    });
    expect(notificacionesRepo.update).not.toHaveBeenCalled();
  });

  it('marcar como leída una propia la actualiza', async () => {
    const { service, notificacionesRepo } = armarServicio();
    notificacionesRepo.findOne.mockResolvedValue({
      id: 'n1',
      tipo: 'AVISO_GENERAL',
      titulo: 't',
      mensaje: 'm',
      creadaEn: new Date(),
      leidaEn: null,
    });
    const r = await service.marcarLeida('n1', 'u1');
    expect(notificacionesRepo.update).toHaveBeenCalledTimes(1);
    expect(r.leidaEn).toBeInstanceOf(Date);
  });
});

describe('Permisos por rol', () => {
  const guard = new RolesGuard(new Reflector());
  const ctx = (handler: keyof NotificacionesController, tipoActor: TipoActor) =>
    ({
      getHandler: () =>
        (
          NotificacionesController.prototype as unknown as Record<
            string,
            () => unknown
          >
        )[handler],
      getClass: () => NotificacionesController,
      switchToHttp: () => ({ getRequest: () => ({ user: { tipoActor } }) }),
    }) as unknown as ExecutionContext;

  describe.each([
    'listar',
    'contarNoLeidas',
    'marcarLeida',
    'leerTodas',
  ] as const)('ruta del Socio %s', (handler) => {
    it('SOCIO pasa', () => {
      expect(guard.canActivate(ctx(handler, TipoActor.SOCIO))).toBe(true);
    });
    it.each([
      TipoActor.EXTERNO,
      TipoActor.RECEPCIONISTA,
      TipoActor.GERENTE_SEDE,
      TipoActor.GERENTE_GENERAL,
    ])('%s recibe 403', (rol) => {
      expect(() => guard.canActivate(ctx(handler, rol))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe.each(['crearEnvio', 'previsualizar', 'historial'] as const)(
    'ruta del Gerente General %s',
    (handler) => {
      it('GERENTE_GENERAL pasa', () => {
        expect(guard.canActivate(ctx(handler, TipoActor.GERENTE_GENERAL))).toBe(
          true,
        );
      });
      it.each([
        TipoActor.GERENTE_SEDE,
        TipoActor.RECEPCIONISTA,
        TipoActor.EXTERNO,
        TipoActor.SOCIO,
      ])('%s recibe 403', (rol) => {
        expect(() => guard.canActivate(ctx(handler, rol))).toThrow(
          ForbiddenException,
        );
      });
    },
  );
});

describe('DTOs', () => {
  const base = {
    titulo: 'Hola',
    mensaje: 'Mensaje',
    audiencia: AudienciaEnvio.TODOS_LOS_SOCIOS,
    canales: ['PANEL'],
  };
  const validar = (plano: object) =>
    validate(plainToInstance(CrearEnvioDto, plano));

  it('acepta un envío válido', async () => {
    expect(await validar(base)).toHaveLength(0);
  });

  it('rechaza título de más de 120 caracteres y mensaje de más de 1000', async () => {
    expect(
      await validar({ ...base, titulo: 'a'.repeat(121) }),
    ).not.toHaveLength(0);
    expect(
      await validar({ ...base, mensaje: 'a'.repeat(1001) }),
    ).not.toHaveLength(0);
    expect(await validar({ ...base, titulo: 'a'.repeat(120) })).toHaveLength(0);
  });

  it('rechaza textos vacíos o solo espacios', async () => {
    expect(await validar({ ...base, titulo: '   ' })).not.toHaveLength(0);
  });

  it('exige sedeId para SOCIOS_DE_SEDE y usuarioId para SOCIO', async () => {
    expect(
      await validar({ ...base, audiencia: AudienciaEnvio.SOCIOS_DE_SEDE }),
    ).not.toHaveLength(0);
    expect(
      await validar({ ...base, audiencia: AudienciaEnvio.SOCIO }),
    ).not.toHaveLength(0);
  });

  it('rechaza canales vacíos, repetidos o desconocidos', async () => {
    expect(await validar({ ...base, canales: [] })).not.toHaveLength(0);
    expect(
      await validar({ ...base, canales: ['PANEL', 'PANEL'] }),
    ).not.toHaveLength(0);
    expect(await validar({ ...base, canales: ['SMS'] })).not.toHaveLength(0);
  });

  it('paginado: tope de 20 por página', async () => {
    const q = (limit: string) =>
      validate(plainToInstance(NotificacionesQueryDto, { limit }));
    expect(await q('20')).toHaveLength(0);
    expect(await q('21')).not.toHaveLength(0);
  });
});
