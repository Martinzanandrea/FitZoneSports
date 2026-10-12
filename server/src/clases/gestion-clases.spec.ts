import type { ExecutionContext } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In } from 'typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { Clase, ClaseOcurrencia, Instructor, ReservaClase } from '../entities';
import {
  EstadoOcurrenciaClase,
  EstadoResClase,
  TipoActor,
} from '../entities/enums';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificadorFactory } from '../notificaciones/notificadores/notificador.factory';
import { PanelNotificador } from '../notificaciones/notificadores/panel.notificador';
import { EmailNotificador } from '../notificaciones/notificadores/email.notificador';
import { ClasesController } from './clases.controller';
import { ClasesService } from './clases.service';
import { ClaseBajaListener } from './listeners/clase-baja.listener';
import {
  CLASE_CUPO_LIBERADO,
  CLASE_DADA_DE_BAJA,
  type ClaseDadaDeBajaPayload,
} from './events/clase.events';
import { reglasVigentes } from './reglas-clases';
import { ReservasClaseService } from './reserva-clase.service';
import { TypeOrmBookingClaseRepository } from './booking-clase.repository';

// "Ahora" fijo: 2026-10-09 15:00 en Argentina (= 18:00 UTC).
const AHORA = new Date('2026-10-09T18:00:00Z');

const gg: UsuarioAutenticado = {
  id: 'gg',
  tipoActor: TipoActor.GERENTE_GENERAL,
  email: 'g@x.com',
  sedeId: null,
};
const gsA: UsuarioAutenticado = {
  id: 'gsA',
  tipoActor: TipoActor.GERENTE_SEDE,
  email: 'a@x.com',
  sedeId: 'sedeA',
};
const gsB: UsuarioAutenticado = { ...gsA, id: 'gsB', sedeId: 'sedeB' };

const oc = (
  id: string,
  fecha: string,
  horaInicio: string,
  horaFin: string,
) => ({
  id,
  fecha,
  horaInicio,
  horaFin,
  estado: EstadoOcurrenciaClase.PROGRAMADA,
});

interface Opciones {
  activa?: boolean;
  ocurrencias?: Array<
    ReturnType<typeof oc> & { estado?: EstadoOcurrenciaClase }
  >;
  conteos?: Array<{ ocurrenciaId: string; cupo: string }>;
  reservas?: Array<{
    id: string;
    usuario: { id: string };
    ocurrencia: { id: string };
  }>;
  fallaAlCancelarReservas?: boolean;
  conflictos?: string[];
  emitLanza?: boolean;
  instructorActivo?: boolean;
}

function armar(opts: Opciones = {}) {
  const claseDb = {
    id: 'c1',
    tipoClase: 'Yoga',
    capacidad: 10,
    activa: opts.activa ?? true,
    sede: { id: 'sedeA', nombre: 'A' },
    instructor: { id: 'i1' },
    horariosSemanales: [
      { diaSemana: 1, horaInicio: '18:00:00', horaFin: '19:00:00' },
    ],
  };
  const qbs: Array<Record<string, jest.Mock>> = [];
  const crearQb = (entidad: unknown) => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of [
      'setLock',
      'where',
      'andWhere',
      'select',
      'addSelect',
      'groupBy',
    ]) {
      qb[m] = jest.fn(() => qb);
    }
    qb.getOne = jest.fn(() =>
      Promise.resolve(entidad === Clase ? claseDb : null),
    );
    qb.getMany = jest.fn(() =>
      Promise.resolve(
        entidad === ClaseOcurrencia ? (opts.ocurrencias ?? []) : [],
      ),
    );
    qb.getRawMany = jest.fn(() => Promise.resolve(opts.conteos ?? []));
    qbs.push(qb);
    return qb;
  };
  const instructorRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 'i2',
      activo: opts.instructorActivo ?? true,
    }),
  };
  const manager = {
    createQueryBuilder: jest.fn((entidad: unknown) => crearQb(entidad)),
    find: jest.fn().mockResolvedValue(opts.reservas ?? []),
    update: jest.fn((entidad: unknown) => {
      if (entidad === ReservaClase && opts.fallaAlCancelarReservas) {
        return Promise.reject(new Error('fallo a mitad de la baja'));
      }
      return Promise.resolve({ affected: 1 });
    }),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
    getRepository: jest.fn((entidad: unknown) =>
      entidad === Instructor ? instructorRepo : {},
    ),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const clasesRepo = {
    findOne: jest.fn(() => Promise.resolve({ ...claseDb })),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
    update: jest.fn(),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  const reparto = {
    validarHuecosLibres: jest.fn().mockResolvedValue(opts.conflictos ?? []),
  };
  const generacion = { generarParaClase: jest.fn().mockResolvedValue(3) };
  const eventEmitter = {
    emit: jest.fn(() => {
      if (opts.emitLanza) throw new Error('listener roto');
      return true;
    }),
  };
  const service = new ClasesService(
    clasesRepo as never,
    {} as never,
    instructorRepo as never,
    {} as never,
    dataSource as never,
    reparto as never,
    generacion as never,
    eventEmitter as unknown as EventEmitter2,
  );
  return {
    service,
    manager,
    dataSource,
    clasesRepo,
    reparto,
    generacion,
    eventEmitter,
    qbs,
    claseDb,
  };
}

const futuras = [
  oc('o1', '2026-10-12', '18:00:00', '19:00:00'),
  oc('o2', '2026-10-19', '18:00:00', '19:00:00'),
];

beforeEach(() => {
  jest.useFakeTimers({ now: AHORA });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('ClasesService.update: validación de capacidad', () => {
  it('rechaza una capacidad por debajo de las reservas y dice el número', async () => {
    const { service, manager } = armar({
      ocurrencias: futuras,
      conteos: [
        { ocurrenciaId: 'o1', cupo: '7' },
        { ocurrenciaId: 'o2', cupo: '3' },
      ],
    });
    const err = await service
      .update('c1', { capacidad: 6 }, gg)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).message).toContain('7 reserva(s)');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('acepta exactamente el límite (capacidad = reservas)', async () => {
    const { service, manager } = armar({
      ocurrencias: futuras,
      conteos: [{ ocurrenciaId: 'o1', cupo: '7' }],
    });
    const r = await service.update('c1', { capacidad: 7 }, gg);
    expect(r.capacidad).toBe(7);
    expect(manager.save).toHaveBeenCalledTimes(1);
  });

  it('cuenta solo reservas de ocurrencias futuras de AR (consulta con hoy/hora de Argentina)', async () => {
    const { service, qbs } = armar({ ocurrencias: futuras });
    await service.update('c1', { capacidad: 5 }, gg);
    const andWhere = qbs
      .flatMap((q) => q.andWhere.mock.calls as unknown[][])
      .find((c) => String(c[0]).includes('oc.fecha > :hoy'));
    expect(andWhere?.[1]).toEqual({ hoy: '2026-10-09', hora: '15:00:00' });
  });

  it('cambiar solo el tipo no consulta reservas', async () => {
    const { service, qbs } = armar({ ocurrencias: futuras });
    const r = await service.update('c1', { tipoClase: 'Pilates' }, gg);
    expect(r.tipoClase).toBe('Pilates');
    expect(qbs.some((q) => q.getRawMany.mock.calls.length > 0)).toBe(false);
  });

  it('no deja asignar un instructor dado de baja', async () => {
    const { service } = armar({ instructorActivo: false });
    await expect(
      service.update('c1', { instructorId: 'i2' }, gg),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ClasesService.desactivar: baja atómica', () => {
  const reservas = [
    { id: 'r1', usuario: { id: 'u1' }, ocurrencia: { id: 'o1' } },
    { id: 'r2', usuario: { id: 'u1' }, ocurrencia: { id: 'o2' } },
    { id: 'r3', usuario: { id: 'u2' }, ocurrencia: { id: 'o1' } },
  ];

  it('en una sola transacción: clase inactiva, fechas futuras y reservas canceladas', async () => {
    const { service, manager, dataSource, clasesRepo } = armar({
      ocurrencias: futuras,
      reservas,
    });
    const r = await service.desactivar('c1', gg);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.update).toHaveBeenCalledWith(
      Clase,
      { id: 'c1' },
      { activa: false },
    );
    expect(manager.update).toHaveBeenCalledWith(
      ClaseOcurrencia,
      { id: In(['o1', 'o2']) },
      { estado: EstadoOcurrenciaClase.CANCELADA },
    );
    expect(manager.update).toHaveBeenCalledWith(
      ReservaClase,
      { id: In(['r1', 'r2', 'r3']) },
      expect.objectContaining({ estado: EstadoResClase.CANCELADA }),
    );
    // todo por el manager de la transacción, nada por los repos sueltos
    expect(clasesRepo.save).not.toHaveBeenCalled();
    expect(r.resumenBaja).toEqual({
      ocurrenciasCanceladas: 2,
      reservasCanceladas: 3,
      sociosAfectados: 2,
    });
  });

  it('busca solo reservas RESERVADA y LISTA_ESPERA (no toca asistencias)', async () => {
    const { service, manager } = armar({ ocurrencias: futuras, reservas });
    await service.desactivar('c1', gg);
    const where = (
      manager.find.mock.calls[0] as unknown as [
        unknown,
        { where: { estado: unknown } },
      ]
    )[1].where;
    expect(where.estado).toEqual(
      In([EstadoResClase.RESERVADA, EstadoResClase.LISTA_ESPERA]),
    );
  });

  it('no promueve la lista de espera: nunca emite el evento de cupo liberado', async () => {
    const { service, eventEmitter } = armar({ ocurrencias: futuras, reservas });
    await service.desactivar('c1', gg);
    const eventos = eventEmitter.emit.mock.calls.map(
      (c) => (c as unknown[])[0],
    );
    expect(eventos).toEqual([CLASE_DADA_DE_BAJA]);
    expect(eventos).not.toContain(CLASE_CUPO_LIBERADO);
  });

  it('emite una sola vez, después de la transacción, con una entrada por persona', async () => {
    const { service, eventEmitter, dataSource } = armar({
      ocurrencias: futuras,
      reservas,
    });
    await service.desactivar('c1', gg);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const payload = (
      eventEmitter.emit.mock.calls[0] as unknown as [
        string,
        ClaseDadaDeBajaPayload,
      ]
    )[1];
    expect(payload.tipoClase).toBe('Yoga');
    expect(payload.afectados).toHaveLength(2);
    const u1 = payload.afectados.find((a) => a.usuarioId === 'u1');
    expect(u1?.ocurrencias.map((o) => o.fecha)).toEqual([
      '2026-10-12',
      '2026-10-19',
    ]);
    expect(dataSource.transaction.mock.invocationCallOrder[0]).toBeLessThan(
      eventEmitter.emit.mock.invocationCallOrder[0],
    );
  });

  it('si algo falla a mitad de la baja: rechaza y no avisa a nadie', async () => {
    const { service, eventEmitter } = armar({
      ocurrencias: futuras,
      reservas,
      fallaAlCancelarReservas: true,
    });
    await expect(service.desactivar('c1', gg)).rejects.toThrow(
      'a mitad de la baja',
    );
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('una clase ya dada de baja: 400 y no escribe nada', async () => {
    const { service, manager, eventEmitter } = armar({ activa: false });
    await expect(service.desactivar('c1', gg)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(manager.update).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('un fallo al emitir el aviso no revierte la baja', async () => {
    const { service, manager } = armar({
      ocurrencias: futuras,
      reservas,
      emitLanza: true,
    });
    await expect(service.desactivar('c1', gg)).resolves.toBeDefined();
    expect(manager.update).toHaveBeenCalledWith(
      Clase,
      { id: 'c1' },
      { activa: false },
    );
  });
});

describe('Aviso de baja: una notificación por persona y clase', () => {
  function armarListener(opts?: { mailFalla?: boolean }) {
    const usuarios = [
      {
        id: 'u1',
        nombre: 'Ana',
        email: 'ana@x.com',
        emailVerificado: true,
        tipoActor: TipoActor.SOCIO,
        activo: true,
      },
      {
        id: 'u2',
        nombre: 'Beto',
        email: 'beto@x.com',
        emailVerificado: true,
        tipoActor: TipoActor.SOCIO,
        activo: true,
      },
      {
        id: 'u3',
        nombre: 'Cora',
        email: 'cora@x.com',
        emailVerificado: true,
        tipoActor: TipoActor.SOCIO,
        activo: false,
      },
    ];
    const usuariosRepo = { find: jest.fn().mockResolvedValue(usuarios) };
    const notifRepo = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const mail = {
      enviar: opts?.mailFalla
        ? jest.fn().mockRejectedValue(new Error('smtp caído'))
        : jest.fn().mockResolvedValue(undefined),
    };
    const notificaciones = new NotificacionesService(
      new NotificadorFactory(
        new PanelNotificador(notifRepo as never),
        new EmailNotificador(mail),
      ),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest
      .spyOn(
        notificaciones as unknown as { esperar: () => Promise<void> },
        'esperar',
      )
      .mockResolvedValue(undefined);
    const listener = new ClaseBajaListener(
      usuariosRepo as never,
      notificaciones,
    );
    return { listener, notifRepo, mail };
  }

  const payload: ClaseDadaDeBajaPayload = {
    claseId: 'c1',
    tipoClase: 'Yoga',
    afectados: [
      {
        usuarioId: 'u1',
        ocurrencias: [
          { fecha: '2026-10-12', horaInicio: '18:00:00', horaFin: '19:00:00' },
          { fecha: '2026-10-19', horaInicio: '18:00:00', horaFin: '19:00:00' },
        ],
      },
      {
        usuarioId: 'u2',
        ocurrencias: [
          { fecha: '2026-10-12', horaInicio: '18:00:00', horaFin: '19:00:00' },
        ],
      },
      {
        usuarioId: 'u3', // inactivo: no recibe nada
        ocurrencias: [
          { fecha: '2026-10-12', horaInicio: '18:00:00', horaFin: '19:00:00' },
        ],
      },
    ],
  };

  it('una notificación de panel y un mail por socio, con sus fechas y el texto pedido', async () => {
    const { listener, notifRepo, mail } = armarListener();
    await listener.notificarSociosAfectados(payload);

    expect(notifRepo.save).toHaveBeenCalledTimes(2); // u1 y u2, una cada uno
    expect(mail.enviar).toHaveBeenCalledTimes(2);
    const dePanelU1 = (
      notifRepo.create.mock.calls as Array<[Record<string, unknown>]>
    )
      .map((c) => c[0])
      .find((n) => (n.usuario as { id: string }).id === 'u1');
    expect(dePanelU1?.tipo).toBe('CLASE_CANCELADA');
    expect(dePanelU1?.mensaje).toContain(
      'Tu clase Yoga fue cancelada. Podés reservar en los horarios disponibles.',
    );
    expect(dePanelU1?.mensaje).toContain('12/10 de 18:00 a 19:00');
    expect(dePanelU1?.mensaje).toContain('19/10 de 18:00 a 19:00');
  });

  it('el fallo del mail no se propaga ni afecta al resto (la baja ya está confirmada)', async () => {
    const { listener, notifRepo } = armarListener({ mailFalla: true });
    await expect(
      listener.notificarSociosAfectados(payload),
    ).resolves.toBeUndefined();
    expect(notifRepo.save).toHaveBeenCalledTimes(2);
  });

  it('de punta a punta: la baja queda hecha aunque falle el mail', async () => {
    const t = armar({
      ocurrencias: futuras,
      reservas: [{ id: 'r1', usuario: { id: 'u1' }, ocurrencia: { id: 'o1' } }],
    });
    const { listener } = armarListener({ mailFalla: true });
    const emisor = new EventEmitter2();
    let pendiente: Promise<void> = Promise.resolve();
    emisor.on(CLASE_DADA_DE_BAJA, (p: ClaseDadaDeBajaPayload) => {
      pendiente = listener.notificarSociosAfectados(p);
    });
    // reemplaza el emisor del servicio por uno real
    (t.service as unknown as { eventEmitter: EventEmitter2 }).eventEmitter =
      emisor;

    await t.service.desactivar('c1', gg);
    await pendiente;
    expect(t.manager.update).toHaveBeenCalledWith(
      Clase,
      { id: 'c1' },
      { activa: false },
    );
  });

  it('con muchas fechas el mensaje se recorta y respeta el tope', async () => {
    const { listener, notifRepo } = armarListener();
    const muchas = Array.from({ length: 40 }, (_, i) => ({
      fecha: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      horaInicio: '18:00:00',
      horaFin: '19:00:00',
    }));
    await listener.notificarSociosAfectados({
      claseId: 'c1',
      tipoClase: 'Yoga',
      afectados: [{ usuarioId: 'u1', ocurrencias: muchas }],
    });
    const m = (notifRepo.create.mock.calls[0] as Array<{ mensaje: string }>)[0]
      .mensaje;
    expect(m.length).toBeLessThanOrEqual(1000);
    expect(m).toContain('y 34 más');
  });
});

describe('ClasesService.reactivar', () => {
  it('reabre las fechas futuras, regenera las que faltan y NO restaura reservas', async () => {
    const { service, manager, generacion } = armar({
      activa: false,
      ocurrencias: [
        { ...futuras[0], estado: EstadoOcurrenciaClase.CANCELADA },
        { ...futuras[1], estado: EstadoOcurrenciaClase.CANCELADA },
      ],
    });
    // el servicio vuelve a leer la clase al final; la mock siempre devuelve inactiva,
    // lo que importa acá son las escrituras
    const r = await service.reactivar('c1', gg);

    expect(manager.update).toHaveBeenCalledWith(
      Clase,
      { id: 'c1' },
      { activa: true },
    );
    expect(manager.update).toHaveBeenCalledWith(
      ClaseOcurrencia,
      { id: In(['o1', 'o2']) },
      { estado: EstadoOcurrenciaClase.PROGRAMADA },
    );
    expect(manager.update).not.toHaveBeenCalledWith(
      ReservaClase,
      expect.anything(),
      expect.anything(),
    );
    expect(generacion.generarParaClase).toHaveBeenCalledWith('c1');
    expect(r.ocurrenciasReabiertas).toBe(2);
    expect(r.ocurrenciasGeneradas).toBe(3);
  });

  it('si el horario ya lo ocupa otra clase activa: 409 y no cambia nada', async () => {
    const { service, manager } = armar({
      activa: false,
      conflictos: [
        'Día 1 18:00-19:00: se solapa con otra clase activa de la sede',
      ],
    });
    await expect(service.reactivar('c1', gg)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('una clase que ya está activa: 400', async () => {
    const { service } = armar({ activa: true });
    await expect(service.reactivar('c1', gg)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('Reservas nuevas sobre clases dadas de baja', () => {
  it('el servicio de reservas rechaza una clase inactiva', async () => {
    const ocurrenciasRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'o1',
        estado: EstadoOcurrenciaClase.PROGRAMADA,
        fecha: '2026-10-20',
        horaInicio: '18:00:00',
        clase: { activa: false, sede: { id: 'sedeA' } },
      }),
    };
    const bookingRepo = { reservarSegura: jest.fn() };
    const service = new ReservasClaseService(
      {} as never,
      ocurrenciasRepo as never,
      {} as never,
      {} as never,
      bookingRepo,
      { emit: jest.fn() } as never,
    );
    await expect(
      service.reservar('o1', 'u1', {
        id: 'u1',
        tipoActor: TipoActor.SOCIO,
        email: 'u@x.com',
        sedeId: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(bookingRepo.reservarSegura).not.toHaveBeenCalled();
  });

  it.each([
    [
      'ocurrencia cancelada',
      {
        estado: EstadoOcurrenciaClase.CANCELADA,
        clase: { activa: true, capacidad: 5 },
      },
    ],
    [
      'clase inactiva',
      {
        estado: EstadoOcurrenciaClase.PROGRAMADA,
        clase: { activa: false, capacidad: 5 },
      },
    ],
  ])('el repositorio, ya con el lock, rechaza %s', async (_n, oc2) => {
    const qb = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'o1', ...oc2 }),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      count: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const repo = new TypeOrmBookingClaseRepository({
      transaction: (cb: (m: typeof manager) => unknown) => cb(manager),
    } as never);
    await expect(
      repo.reservarSegura({
        ocurrenciaId: 'o1',
        usuario: { id: 'u1' } as never,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.save).not.toHaveBeenCalled();
    expect(manager.count).not.toHaveBeenCalled();
  });
});

describe('Visibilidad de clases dadas de baja', () => {
  const socio: UsuarioAutenticado = {
    id: 's1',
    tipoActor: TipoActor.SOCIO,
    email: 's@x.com',
    sedeId: null,
  };

  it.each([TipoActor.SOCIO, TipoActor.EXTERNO])(
    'el listado para %s excluye las inactivas',
    async (rol) => {
      const { service, clasesRepo } = armar();
      await service.findAll(undefined, undefined, { ...socio, tipoActor: rol });
      expect(clasesRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { activa: true } }),
      );
    },
  );

  it('los gerentes ven todas; el de sede queda acotado a la suya', async () => {
    const { service, clasesRepo } = armar();
    await service.findAll(undefined, undefined, gg);
    expect(clasesRepo.findAndCount).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {} }),
    );
    await service.findAll('sedeB', undefined, gsA);
    expect(clasesRepo.findAndCount).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { sede: { id: 'sedeA' } } }),
    );
  });

  it('el detalle de una clase inactiva es 404 para el socio y visible para el gerente', async () => {
    const { service } = armar({ activa: false });
    await expect(service.findOneVisible('c1', socio)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findOneVisible('c1', gg)).resolves.toBeDefined();
  });
});

describe('Permisos de gestión de clases', () => {
  const guard = new RolesGuard(new Reflector());
  const ctx = (handler: string, tipoActor: TipoActor) =>
    ({
      getHandler: () =>
        (
          ClasesController.prototype as unknown as Record<string, () => unknown>
        )[handler],
      getClass: () => ClasesController,
      switchToHttp: () => ({ getRequest: () => ({ user: { tipoActor } }) }),
    }) as unknown as ExecutionContext;

  describe.each([
    'update',
    'desactivar',
    'reactivar',
    'asignarInstructor',
    'generarOcurrencias',
    'impactoBaja',
    'resumenTipos',
    'reglas',
  ])('%s', (handler) => {
    it.each([TipoActor.RECEPCIONISTA, TipoActor.SOCIO, TipoActor.EXTERNO])(
      '%s recibe 403',
      (rol) => {
        expect(() => guard.canActivate(ctx(handler, rol))).toThrow(
          ForbiddenException,
        );
      },
    );
    it.each([TipoActor.GERENTE_GENERAL, TipoActor.GERENTE_SEDE])(
      '%s pasa el guard',
      (rol) => {
        expect(guard.canActivate(ctx(handler, rol))).toBe(true);
      },
    );
  });

  describe('alcance por sede', () => {
    const acciones: Array<
      [string, (s: ClasesService, u: UsuarioAutenticado) => Promise<unknown>]
    > = [
      ['update', (s, u) => s.update('c1', { tipoClase: 'X' }, u)],
      ['desactivar', (s, u) => s.desactivar('c1', u)],
      ['reactivar', (s, u) => s.reactivar('c1', u)],
      ['impactoBaja', (s, u) => s.impactoBaja('c1', u)],
      ['asignarInstructor', (s, u) => s.asignarInstructor('c1', 'i2', u)],
      ['generarOcurrencias', (s, u) => s.generarOcurrencias('c1', u)],
    ];

    it.each(acciones)(
      '%s: el Gerente de Sede recibe 403 sobre una clase de otra sede',
      async (_n, accion) => {
        const { service, manager } = armar({
          activa: _n === 'reactivar' ? false : true,
        });
        await expect(accion(service, gsB)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(manager.update).not.toHaveBeenCalled();
      },
    );

    it.each(acciones)(
      '%s: el Gerente General puede sobre cualquier sede',
      async (_n, accion) => {
        const { service } = armar({
          activa: _n === 'reactivar' ? false : true,
        });
        // impactoBaja usa una consulta propia del repo de ocurrencias
        (service as unknown as { ocurrenciasRepo: unknown }).ocurrenciasRepo = {
          createQueryBuilder: () => {
            const qb: Record<string, jest.Mock> = {};
            for (const m of [
              'leftJoin',
              'select',
              'addSelect',
              'where',
              'andWhere',
            ]) {
              qb[m] = jest.fn(() => qb);
            }
            qb.getRawOne = jest.fn().mockResolvedValue({
              ocurrencias: '0',
              reservas: '0',
              socios: '0',
            });
            return qb;
          },
        };
        await expect(accion(service, gg)).resolves.toBeDefined();
      },
    );

    it('el Gerente de Sede puede sobre las de su sede', async () => {
      const { service } = armar();
      await expect(service.desactivar('c1', gsA)).resolves.toBeDefined();
    });
  });
});

describe('Reglas vigentes', () => {
  it('coinciden con las constantes que usan los servicios', () => {
    expect(reglasVigentes()).toEqual({
      horasLimiteReservaPropia: 48,
      minutosLimiteReservaStaff: 30,
      horasLimiteCancelacion: 2,
      semanasVentanaOcurrencias: 4,
    });
  });
});
