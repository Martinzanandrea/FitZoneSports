import type { ExecutionContext } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AUDITABLE_KEY } from '../auditoria/decorators/auditable.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { EstadoMembresia, TipoActor } from '../entities/enums';
import { AccesoController } from './acceso.controller';
import { AccesoService } from './acceso.service';
import { ValidarDniDto } from './dto/validar-dni.dto';

// Ingreso manual por DNI. Sin base real: repositorios en memoria. "Hoy" queda
// congelado en 2026-10-09 (hora argentina).
const AHORA = new Date('2026-10-09T18:00:00Z');

const fila = (estado: EstadoMembresia, inicio: string, fin: string) => ({
  id: `${estado}-${inicio}`,
  estado,
  fechaInicio: inicio,
  fechaFin: fin,
});
const vigente = fila(EstadoMembresia.ACTIVO, '2026-10-01', '2026-11-01');
const proxima = fila(EstadoMembresia.ACTIVO, '2026-11-01', '2026-12-01');
const vencida = fila(EstadoMembresia.VENCIDO, '2026-08-01', '2026-09-01');
const suspendida = fila(EstadoMembresia.SUSPENDIDO, '2026-10-01', '2026-11-01');

const recepcion = (sedeId: string | null): UsuarioAutenticado => ({
  id: `rec-${sedeId}`,
  tipoActor: TipoActor.RECEPCIONISTA,
  email: 'r@x.com',
  sedeId,
});
const recepA = recepcion('sA');
const recepB = recepcion('sB');
const gg: UsuarioAutenticado = {
  id: 'gg',
  tipoActor: TipoActor.GERENTE_GENERAL,
  email: 'g@x.com',
  sedeId: null,
};

interface Sesion {
  id: string;
  usuario: { id: string };
  sede: { id: string };
  horaEgreso: Date | null;
}
const abierta = (usuarioId: string, sedeId: string): Sesion => ({
  id: `ses-${usuarioId}`,
  usuario: { id: usuarioId },
  sede: { id: sedeId },
  horaEgreso: null,
});

const ana = {
  id: 'u1',
  tipoActor: TipoActor.SOCIO,
  activo: true,
  dni: '30123456',
  nombre: 'Ana',
  apellido: 'Paz',
  fotoUrl: 'https://fotos.test/ana.jpg',
  email: 'ana@x.com',
  telefono: '1155550000',
  fechaNacimiento: '1990-01-01',
};

interface Opciones {
  usuarios?: Array<Record<string, unknown>>;
  membresias?: unknown[];
  aforoMaximo?: number;
  sesiones?: Sesion[];
  falloAlGuardar?: Error;
}

function armar(opts: Opciones = {}) {
  const usuarios = opts.usuarios ?? [ana];
  const sesiones = opts.sesiones ?? [];
  const sedes: Record<string, unknown> = {
    sA: { id: 'sA', aforoMaximo: opts.aforoMaximo ?? 10 },
    sB: { id: 'sB', aforoMaximo: 10 },
  };
  const accesoRepo = {
    createQueryBuilder: jest.fn(() => {
      const p: { usuarioId?: string; sedeId?: string } = {};
      const qb: Record<string, unknown> = {};
      qb.andWhere = () => qb;
      qb.where = (_sql: string, params: typeof p) => {
        Object.assign(p, params);
        return qb;
      };
      qb.getCount = () =>
        Promise.resolve(
          sesiones.filter((s) => !s.horaEgreso && s.sede.id === p.sedeId)
            .length,
        );
      qb.getOne = () =>
        Promise.resolve(
          sesiones.find((s) => !s.horaEgreso && s.usuario.id === p.usuarioId) ??
            null,
        );
      return qb;
    }),
    create: jest.fn((d: { usuario: { id: string }; sede: { id: string } }) => ({
      id: 'nuevo',
      usuario: d.usuario,
      sede: d.sede,
      horaEgreso: null,
    })),
    save: jest.fn((s: Sesion) => {
      if (opts.falloAlGuardar) return Promise.reject(opts.falloAlGuardar);
      sesiones.push(s);
      return Promise.resolve(s);
    }),
  };
  const usuariosRepo = {
    findOne: jest.fn(({ where }: { where: { id?: string; dni?: string } }) =>
      Promise.resolve(
        usuarios.find((u) =>
          where.dni !== undefined ? u.dni === where.dni : u.id === where.id,
        ) ?? null,
      ),
    ),
  };
  const sedesRepo = {
    findOne: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(sedes[where.id] ?? null),
    ),
  };
  const membresiasRepo = {
    find: jest.fn(() => Promise.resolve(opts.membresias ?? [vigente])),
  };
  const service = new AccesoService(
    accesoRepo as never,
    usuariosRepo as never,
    sedesRepo as never,
    membresiasRepo as never,
    {} as never,
  );
  return { service, accesoRepo, usuariosRepo, sesiones };
}

beforeEach(() => {
  jest.useFakeTimers({ now: AHORA });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('AccesoService.validarDni', () => {
  it('caso feliz: registra el ingreso del socio en la sede', async () => {
    const { service, accesoRepo, sesiones } = armar();
    const r = await service.validarDni('30123456', 'sA', recepA);
    expect(r.usuario).toMatchObject({ id: 'u1' });
    expect(r.sede).toMatchObject({ id: 'sA' });
    expect(r.horaEgreso).toBeNull();
    expect(accesoRepo.save).toHaveBeenCalledTimes(1);
    expect(sesiones).toHaveLength(1);
  });

  it('DNI inexistente: 404 y no guarda', async () => {
    const { service, accesoRepo } = armar();
    const p = service.validarDni('99999999', 'sA', recepA);
    await expect(p).rejects.toBeInstanceOf(NotFoundException);
    await expect(p).rejects.toThrow('No existe un socio con ese DNI');
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('el DNI de alguien que no es socio da el mismo 404', async () => {
    const { service, accesoRepo } = armar({
      usuarios: [{ ...ana, tipoActor: TipoActor.EXTERNO }],
    });
    await expect(service.validarDni('30123456', 'sA', recepA)).rejects.toThrow(
      'No existe un socio con ese DNI',
    );
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('socio dado de baja: 400', async () => {
    const { service, accesoRepo } = armar({
      usuarios: [{ ...ana, activo: false }],
    });
    await expect(
      service.validarDni('30123456', 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it.each([
    ['vencida', [vencida]],
    ['suspendida', [suspendida]],
    ['solo próxima', [proxima]],
    ['sin membresías', []],
  ])('membresía %s: 403 y no guarda', async (_n, filas) => {
    const { service, accesoRepo } = armar({ membresias: filas });
    const p = service.validarDni('30123456', 'sA', recepA);
    await expect(p).rejects.toBeInstanceOf(ForbiddenException);
    await expect(p).rejects.toThrow('membresía activa');
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('RN01: con sesión abierta responde 409 y no guarda otro ingreso', async () => {
    const { service, sesiones } = armar({ sesiones: [abierta('u1', 'sA')] });
    await expect(
      service.validarDni('30123456', 'sA', recepA),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(sesiones).toHaveLength(1);
  });

  it('RN01: la sesión abierta en otra sede también bloquea', async () => {
    const { service } = armar({ sesiones: [abierta('u1', 'sB')] });
    await expect(
      service.validarDni('30123456', 'sA', recepA),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('RN01: el error de índice único (23505) se traduce a 409', async () => {
    const e = Object.assign(new Error('duplicate key'), {
      driverError: {
        code: '23505',
        constraint: 'uq_acceso_abierto_por_usuario',
      },
    });
    const { service } = armar({ falloAlGuardar: e });
    const p = service.validarDni('30123456', 'sA', recepA);
    await expect(p).rejects.toBeInstanceOf(ConflictException);
    await expect(p).rejects.not.toBe(e);
  });

  it('un error de base que no es de unicidad se relanza tal cual', async () => {
    const e = new Error('conexión perdida');
    const { service } = armar({ falloAlGuardar: e });
    await expect(service.validarDni('30123456', 'sA', recepA)).rejects.toBe(e);
  });

  it('tras el egreso, el ingreso por DNI vuelve a ser posible', async () => {
    const { service, sesiones } = armar({ sesiones: [abierta('u1', 'sA')] });
    sesiones[0].horaEgreso = new Date(AHORA);
    await expect(
      service.validarDni('30123456', 'sA', recepA),
    ).resolves.toBeDefined();
  });

  it('aforo completo: 409 y no guarda', async () => {
    const { service, accesoRepo } = armar({
      aforoMaximo: 1,
      sesiones: [abierta('x1', 'sA')],
    });
    await expect(service.validarDni('30123456', 'sA', recepA)).rejects.toThrow(
      'aforo máximo',
    );
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('con lugar libre lo permite', async () => {
    const { service } = armar({
      aforoMaximo: 2,
      sesiones: [abierta('x1', 'sA')],
    });
    await expect(
      service.validarDni('30123456', 'sA', recepA),
    ).resolves.toBeDefined();
  });

  it('recepcionista de otra sede: 403, sin siquiera buscar al socio', async () => {
    const { service, usuariosRepo, accesoRepo } = armar();
    await expect(
      service.validarDni('30123456', 'sA', recepB),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usuariosRepo.findOne).not.toHaveBeenCalled();
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('recepcionista sin sede asignada: 403', async () => {
    const { service } = armar();
    await expect(
      service.validarDni('30123456', 'sA', recepcion(null)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el gerente general puede registrar en cualquier sede', async () => {
    const { service } = armar();
    await expect(
      service.validarDni('30123456', 'sB', gg),
    ).resolves.toBeDefined();
  });

  it('un socio no puede usarlo: 403', async () => {
    const { service } = armar();
    const socio: UsuarioAutenticado = {
      id: 'u1',
      tipoActor: TipoActor.SOCIO,
      email: 'a@x.com',
      sedeId: null,
    };
    await expect(
      service.validarDni('30123456', 'sA', socio),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AccesoService.buscarPorDni (previsualización)', () => {
  it('devuelve solo nombre, apellido, foto y estado de membresía', async () => {
    const { service } = armar();
    const r = await service.buscarPorDni('30123456', 'sA', recepA);
    expect(r).toEqual({
      nombre: 'Ana',
      apellido: 'Paz',
      fotoUrl: 'https://fotos.test/ana.jpg',
      estadoMembresia: 'VIGENTE',
    });
    const texto = JSON.stringify(r);
    for (const dato of ['30123456', 'ana@x.com', '1155550000', '1990', 'u1']) {
      expect(texto).not.toContain(dato);
    }
  });

  it('sin foto devuelve null', async () => {
    const { service } = armar({ usuarios: [{ ...ana, fotoUrl: undefined }] });
    const r = await service.buscarPorDni('30123456', 'sA', recepA);
    expect(r.fotoUrl).toBeNull();
  });

  it.each([
    ['vigente', [vigente], 'VIGENTE'],
    ['vigente + próxima', [proxima, vigente], 'VIGENTE'],
    ['solo próxima', [proxima], 'PROXIMA'],
    ['suspendida', [suspendida], 'SUSPENDIDA'],
    ['vencida', [vencida], 'VENCIDA'],
    [
      'ACTIVO ya terminada (cron sin correr)',
      [fila(EstadoMembresia.ACTIVO, '2026-08-01', '2026-10-09')],
      'VENCIDA',
    ],
    ['sin membresías', [], 'SIN_MEMBRESIA'],
  ])('estado %s -> %s', async (_n, filas, esperado) => {
    const { service } = armar({ membresias: filas });
    const r = await service.buscarPorDni('30123456', 'sA', recepA);
    expect(r.estadoMembresia).toBe(esperado);
  });

  it('no registra ningún ingreso', async () => {
    const { service, accesoRepo } = armar();
    await service.buscarPorDni('30123456', 'sA', recepA);
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('DNI inexistente o de no socio: 404', async () => {
    const a = armar();
    await expect(
      a.service.buscarPorDni('99999999', 'sA', recepA),
    ).rejects.toBeInstanceOf(NotFoundException);
    const b = armar({ usuarios: [{ ...ana, tipoActor: TipoActor.EXTERNO }] });
    await expect(
      b.service.buscarPorDni('30123456', 'sA', recepA),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('otra sede: 403 y no consulta al socio', async () => {
    const { service, usuariosRepo } = armar();
    await expect(
      service.buscarPorDni('30123456', 'sA', recepB),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usuariosRepo.findOne).not.toHaveBeenCalled();
  });
});

describe('Endpoints de ingreso por DNI: roles, auditoría y datos de entrada', () => {
  const guard = new RolesGuard(new Reflector());
  const handlerDe = (nombre: string) =>
    (AccesoController.prototype as unknown as Record<string, () => unknown>)[
      nombre
    ];
  const contexto = (handler: string, tipoActor: TipoActor) =>
    ({
      getHandler: () =>
        (
          AccesoController.prototype as unknown as Record<string, () => unknown>
        )[handler],
      getClass: () => AccesoController,
      switchToHttp: () => ({ getRequest: () => ({ user: { tipoActor } }) }),
    }) as unknown as ExecutionContext;

  describe.each(['validarDni', 'buscarDni'])('%s', (handler) => {
    it.each([
      TipoActor.RECEPCIONISTA,
      TipoActor.GERENTE_SEDE,
      TipoActor.GERENTE_GENERAL,
    ])('%s pasa', (rol) => {
      expect(guard.canActivate(contexto(handler, rol))).toBe(true);
    });

    it.each([TipoActor.SOCIO, TipoActor.EXTERNO])('%s recibe 403', (rol) => {
      expect(() => guard.canActivate(contexto(handler, rol))).toThrow(
        ForbiddenException,
      );
    });
  });

  it('el ingreso manual queda auditado como INGRESO_MANUAL_DNI', () => {
    const handler = handlerDe('validarDni');
    expect(Reflect.getMetadata(AUDITABLE_KEY, handler)).toEqual({
      accion: 'INGRESO_MANUAL_DNI',
      entidad: 'ControlAcceso',
    });
  });

  it('la previsualización no genera auditoría de ingreso', () => {
    const handler = handlerDe('buscarDni');
    expect(Reflect.getMetadata(AUDITABLE_KEY, handler)).toBeUndefined();
  });

  const sedeId = '550e8400-e29b-41d4-a716-446655440000';
  it('el DTO normaliza puntos y espacios del DNI', async () => {
    const dto = plainToInstance(ValidarDniDto, { dni: '30.123.456 ', sedeId });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.dni).toBe('30123456');
  });

  it.each(['', '123', 'abcdefgh', '1234567890', '30123456; DROP'])(
    'el DTO rechaza el DNI %p',
    async (dni) => {
      const dto = plainToInstance(ValidarDniDto, { dni, sedeId });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );

  it('el DTO exige una sede válida', async () => {
    const dto = plainToInstance(ValidarDniDto, {
      dni: '30123456',
      sedeId: 'no-uuid',
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
