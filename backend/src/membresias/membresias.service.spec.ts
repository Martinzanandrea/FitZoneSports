import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Membresia, Sede, Usuario } from '../entities';
import { EstadoMembresia, TipoActor, TipoPlan } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import {
  MembresiasService,
  MENSAJE_SUPERPUESTA,
  MENSAJE_YA_PROGRAMADA,
} from './membresias.service';
import { UpdateMembresiaDto } from './dto/update-membresia.dto';

type Fila = {
  id: string;
  estado: EstadoMembresia;
  plan: TipoPlan;
  fechaInicio: string;
  fechaFin: string;
  renovacionAuto: boolean;
  usuario: { id: string };
  sedeAlta: { id: string; nombre: string };
};

const HOY = '2026-10-18';
const sede = { id: 's1', nombre: 'Centro', activa: true };
const usuario = { id: 'u1', tipoActor: TipoActor.SOCIO, activo: true };
const dto = (plan = TipoPlan.MENSUAL) => ({
  usuarioId: 'u1',
  sedeAltaId: 's1',
  plan,
});

let seq = 0;
const fila = (
  estado: EstadoMembresia,
  fechaInicio: string,
  fechaFin: string,
  plan = TipoPlan.MENSUAL,
): Fila => ({
  id: `m${++seq}`,
  estado,
  plan,
  fechaInicio,
  fechaFin,
  renovacionAuto: false,
  usuario: { id: 'u1' },
  sedeAlta: sede,
});

function armar(existentes: Fila[], opts: { falloAlGuardar?: unknown } = {}) {
  const guardadas: Array<Record<string, unknown>> = [];
  const usuariosFindOne = jest.fn().mockResolvedValue(usuario);
  const membresiasRepo = {
    // Devuelve TODO sin filtrar: la vigencia la deciden las funciones.
    find: jest.fn().mockImplementation(() => Promise.resolve(existentes)),
    findOne: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(existentes.find((e) => e.id === where.id) ?? null),
    ),
    create: jest.fn((x: object) => ({ ...x })),
    save: jest.fn((x: Record<string, unknown>) => {
      // Simula el error del driver (objeto con SQLSTATE), no un Error común.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      if (opts.falloAlGuardar) return Promise.reject(opts.falloAlGuardar);
      guardadas.push(x);
      return Promise.resolve(x);
    }),
    manager: undefined as unknown,
  };
  const repos = new Map<unknown, unknown>([
    [Membresia, membresiasRepo],
    [Usuario, { findOne: usuariosFindOne }],
    [Sede, { findOne: jest.fn().mockResolvedValue(sede) }],
  ]);
  const manager = {
    getRepository: (e: unknown) => repos.get(e),
    transaction: (cb: (m: unknown) => Promise<unknown>) => cb(manager),
  };
  membresiasRepo.manager = manager;
  const service = new MembresiasService(
    membresiasRepo as never,
    {} as never,
    {} as never,
  );
  return {
    service,
    manager: manager as never,
    membresiasRepo,
    guardadas,
    usuariosFindOne,
  };
}

describe('MembresiasService.alta: la nueva no pisa a la anterior', () => {
  it('sin membresías: empieza hoy y dura el plan', async () => {
    const t = armar([]);
    await t.service.alta(dto(), t.manager, HOY);
    expect(t.guardadas[0]).toMatchObject({
      estado: EstadoMembresia.ACTIVO,
      fechaInicio: '2026-10-18',
      fechaFin: '2026-11-18',
    });
  });

  it('toma un bloqueo de fila sobre el usuario antes de calcular', async () => {
    const t = armar([]);
    await t.service.alta(dto(), t.manager, HOY);
    expect(t.usuariosFindOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(t.usuariosFindOne.mock.invocationCallOrder[0]).toBeLessThan(
      t.membresiasRepo.find.mock.invocationCallOrder[0],
    );
  });

  it('con una vigente: la nueva empieza en su fecha_fin y la anterior queda intacta', async () => {
    const vigente = fila(EstadoMembresia.ACTIVO, '2026-10-10', '2026-11-10');
    const copia = { ...vigente };
    const t = armar([vigente]);
    await t.service.alta(dto(TipoPlan.TRIMESTRAL), t.manager, HOY);
    expect(t.guardadas).toHaveLength(1);
    expect(t.guardadas[0]).toMatchObject({
      plan: TipoPlan.TRIMESTRAL, // se permite un plan distinto
      fechaInicio: '2026-11-10',
      fechaFin: '2027-02-10',
    });
    expect(vigente).toEqual(copia);
    expect(t.guardadas[0]).not.toBe(vigente);
  });

  it('con una vigente y una próxima: 409 con el mensaje pedido, sin guardar', async () => {
    const t = armar([
      fila(EstadoMembresia.ACTIVO, '2026-10-10', '2026-11-10'),
      fila(EstadoMembresia.ACTIVO, '2026-11-10', '2026-12-10'),
    ]);
    const p = t.service.alta(dto(), t.manager, HOY);
    await expect(p).rejects.toBeInstanceOf(ConflictException);
    await expect(p).rejects.toThrow(
      'Ya tenés una membresía programada. Podrás comprar otra cuando comience',
    );
    expect(MENSAJE_YA_PROGRAMADA).toContain(
      'Podrás comprar otra cuando comience',
    );
    expect(t.guardadas).toHaveLength(0);
  });

  it('con una vencida o suspendida (o ACTIVO ya terminada): empieza hoy', async () => {
    const t = armar([
      fila(EstadoMembresia.VENCIDO, '2026-08-01', '2026-09-01'),
      fila(EstadoMembresia.SUSPENDIDO, '2026-10-01', '2026-12-01'),
      fila(EstadoMembresia.ACTIVO, '2026-09-01', '2026-10-01'),
    ]);
    await t.service.alta(dto(), t.manager, HOY);
    expect(t.guardadas[0]).toMatchObject({ fechaInicio: '2026-10-18' });
  });

  it('el fin no desborda al mes siguiente (31/01 + 1 mes = 28/02)', async () => {
    const t = armar([]);
    await t.service.alta(dto(), t.manager, '2026-01-31');
    expect(t.guardadas[0]).toMatchObject({ fechaFin: '2026-02-28' });
  });

  describe('hora argentina', () => {
    afterEach(() => jest.useRealTimers());
    it('una compra a las 22:00 argentinas no queda con inicio de mañana', async () => {
      // 22:00 del 17/10 en Argentina = 01:00 UTC del 18/10.
      jest.useFakeTimers().setSystemTime(new Date('2026-10-18T01:00:00Z'));
      const t = armar([]);
      await t.service.alta(dto(), t.manager);
      expect(t.guardadas[0]).toMatchObject({
        fechaInicio: '2026-10-17',
        fechaFin: '2026-11-17',
      });
    });
  });

  it('23P01 (exclusión) se traduce a 409, nunca a 500', async () => {
    const t = armar([], {
      falloAlGuardar: { driverError: { code: '23P01' } },
    });
    const p = t.service.alta(dto(), t.manager, HOY);
    await expect(p).rejects.toBeInstanceOf(ConflictException);
    await expect(p).rejects.toThrow(MENSAJE_SUPERPUESTA);
  });

  it('otros errores de la base se relanzan tal cual', async () => {
    const t = armar([], { falloAlGuardar: new Error('db caída') });
    await expect(t.service.alta(dto(), t.manager, HOY)).rejects.toThrow(
      'db caída',
    );
  });
});

describe('MembresiasService.asegurarSinProxima', () => {
  it('rechaza si ya hay una próxima y deja pasar si no', async () => {
    const con = armar([
      fila(EstadoMembresia.ACTIVO, '2999-01-01', '2999-02-01'),
    ]);
    await expect(con.service.asegurarSinProxima('u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    const sin = armar([
      fila(EstadoMembresia.ACTIVO, '2020-01-01', '2999-02-01'),
    ]);
    await expect(sin.service.asegurarSinProxima('u1')).resolves.toBeUndefined();
  });
});

describe('MembresiasService.obtenerEstadoSocio (GET /membresias/vigente/:id)', () => {
  it('mismos campos de hoy tomados de la vigente, más `proxima`', async () => {
    const vigente = fila(EstadoMembresia.ACTIVO, '2026-10-10', '2026-11-10');
    const proxima = fila(
      EstadoMembresia.ACTIVO,
      '2026-11-10',
      '2026-12-10',
      TipoPlan.TRIMESTRAL,
    );
    const t = armar([proxima, vigente]);
    const r = await t.service.obtenerEstadoSocio('u1', HOY);
    expect(r).toMatchObject({
      plan: TipoPlan.MENSUAL,
      estado: EstadoMembresia.ACTIVO,
      fechaInicio: '2026-10-10',
      fechaFin: '2026-11-10',
      sedeAlta: { id: 's1', nombre: 'Centro' },
    });
    expect(r?.proxima).toMatchObject({
      plan: TipoPlan.TRIMESTRAL,
      fechaInicio: '2026-11-10',
    });
  });

  it('sin próxima: proxima es null; sin membresías: null', async () => {
    const t = armar([fila(EstadoMembresia.ACTIVO, '2026-10-10', '2026-11-10')]);
    expect((await t.service.obtenerEstadoSocio('u1', HOY))?.proxima).toBeNull();
    const vacio = armar([]);
    expect(await vacio.service.obtenerEstadoSocio('u1', HOY)).toBeNull();
  });

  it('ACTIVO ya terminada (cron sin correr) se informa VENCIDO', async () => {
    const t = armar([fila(EstadoMembresia.ACTIVO, '2026-09-01', '2026-10-01')]);
    const r = await t.service.obtenerEstadoSocio('u1', HOY);
    expect(r?.estado).toBe(EstadoMembresia.VENCIDO);
  });

  it('una próxima nunca se muestra como la membresía actual', async () => {
    const t = armar([
      fila(EstadoMembresia.SUSPENDIDO, '2026-10-01', '2026-11-01'),
      fila(EstadoMembresia.ACTIVO, '2026-11-01', '2026-12-01'),
    ]);
    const r = await t.service.obtenerEstadoSocio('u1', HOY);
    expect(r?.estado).toBe(EstadoMembresia.SUSPENDIDO);
    expect(r?.proxima?.fechaInicio).toBe('2026-11-01');
  });
});

describe('cron de vencimiento', () => {
  afterEach(() => jest.useRealTimers());
  it('marca VENCIDO con fecha_fin <= hoy (hora argentina)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T01:00:00Z'));
    const where = jest.fn().mockReturnThis();
    const andWhere = jest.fn().mockReturnThis();
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where,
      andWhere,
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    const repo = { createQueryBuilder: () => qb };
    const service = new MembresiasService(
      repo as never,
      {} as never,
      {} as never,
    );
    expect(await service.marcarVencidasSiCorresponde()).toBe(2);
    expect(where).toHaveBeenCalledWith('fecha_fin <= :hoy', {
      hoy: '2026-10-17',
    });
  });
});

describe('PATCH /membresias/:id (update)', () => {
  const gg = {
    id: 'gg',
    tipoActor: TipoActor.GERENTE_GENERAL,
  } as UsuarioAutenticado;

  it('el DTO ya no acepta un estado libre', async () => {
    for (const estado of ['VENCIDO', 'cualquiera', 123]) {
      const errs = await validate(
        plainToInstance(UpdateMembresiaDto, { estado }),
      );
      expect(errs.some((e) => e.property === 'estado')).toBe(true);
    }
    for (const estado of ['ACTIVO', 'SUSPENDIDO']) {
      expect(
        await validate(plainToInstance(UpdateMembresiaDto, { estado })),
      ).toHaveLength(0);
    }
    const sinCampos = await validate(plainToInstance(UpdateMembresiaDto, {}));
    expect(sinCampos).toHaveLength(0);
  });

  it('el servicio rechaza VENCIDO aunque llegue saltándose el DTO', async () => {
    const m = fila(EstadoMembresia.ACTIVO, '2026-10-10', '2026-11-10');
    const t = armar([m]);
    await expect(
      t.service.update(m.id, { estado: EstadoMembresia.VENCIDO }, gg, HOY),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(t.guardadas).toHaveLength(0);
  });

  it('no asigna campos arbitrarios del cuerpo (plan, fechas)', async () => {
    const m = fila(EstadoMembresia.ACTIVO, '2026-10-10', '2026-11-10');
    const t = armar([m]);
    await t.service.update(
      m.id,
      { renovacionAuto: true, plan: 'ANUAL', fechaFin: '2999-01-01' } as never,
      gg,
      HOY,
    );
    expect(m).toMatchObject({
      renovacionAuto: true,
      plan: TipoPlan.MENSUAL,
      fechaFin: '2026-11-10',
    });
  });

  it('suspender una activa funciona', async () => {
    const m = fila(EstadoMembresia.ACTIVO, '2026-10-10', '2026-11-10');
    const t = armar([m]);
    const r = await t.service.update(
      m.id,
      { estado: EstadoMembresia.SUSPENDIDO },
      gg,
      HOY,
    );
    expect(r.estado).toBe(EstadoMembresia.SUSPENDIDO);
  });

  it('reactivar sin superposición funciona', async () => {
    const susp = fila(EstadoMembresia.SUSPENDIDO, '2026-11-10', '2026-12-10');
    const vigente = fila(EstadoMembresia.ACTIVO, '2026-10-10', '2026-11-10');
    const t = armar([vigente, susp]);
    const r = await t.service.update(
      susp.id,
      { estado: EstadoMembresia.ACTIVO },
      gg,
      HOY,
    );
    expect(r.estado).toBe(EstadoMembresia.ACTIVO);
  });

  it('reactivar una que se superpone: 409', async () => {
    const susp = fila(EstadoMembresia.SUSPENDIDO, '2026-10-20', '2026-11-20');
    const vigente = fila(EstadoMembresia.ACTIVO, '2026-10-10', '2026-11-10');
    const t = armar([vigente, susp]);
    await expect(
      t.service.update(susp.id, { estado: EstadoMembresia.ACTIVO }, gg, HOY),
    ).rejects.toThrow(MENSAJE_SUPERPUESTA);
    expect(t.guardadas).toHaveLength(0);
  });

  it('reactivar una cuyo período ya terminó: 409', async () => {
    const susp = fila(EstadoMembresia.SUSPENDIDO, '2026-08-01', '2026-09-01');
    const t = armar([susp]);
    await expect(
      t.service.update(susp.id, { estado: EstadoMembresia.ACTIVO }, gg, HOY),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('si la restricción de la base lo impide (23P01): 409, no 500', async () => {
    const susp = fila(EstadoMembresia.SUSPENDIDO, '2026-11-10', '2026-12-10');
    const t = armar([susp], { falloAlGuardar: { code: '23P01' } });
    await expect(
      t.service.update(susp.id, { estado: EstadoMembresia.ACTIVO }, gg, HOY),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('una VENCIDO no se reactiva', async () => {
    const m = fila(EstadoMembresia.VENCIDO, '2026-08-01', '2026-09-01');
    const t = armar([m]);
    await expect(
      t.service.update(m.id, { estado: EstadoMembresia.ACTIVO }, gg, HOY),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
