import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from './auth/types/usuario-autenticado.type';
import { TipoActor } from './entities/enums';
import { AccesoController } from './acceso/acceso.controller';
import { MembresiasController } from './membresias/membresias.controller';
import { PagosController } from './pagos/pagos.controller';
import { UsuariosController } from './usuarios/usuarios.controller';
import { InstructoresService } from './instructores/instructores.service';
import { ClasesService } from './clases/clases.service';
import { PagosService } from './pagos/pagos.service';
import { ReservasCanchaService } from './canchas/reserva-cancha.service';
import { ReservasClaseService } from './clases/reserva-clase.service';
import { CanchasService } from './canchas/canchas.service';

const u = (
  tipoActor: TipoActor,
  sedeId: string | null = null,
  id = 'x1',
): UsuarioAutenticado => ({ id, tipoActor, email: 'x@x.com', sedeId });
const socio = u(TipoActor.SOCIO, null, 'socio1');
const externo = u(TipoActor.EXTERNO, null, 'ext1');
const recepA = u(TipoActor.RECEPCIONISTA, 'sedeA', 'recA');
const gsA = u(TipoActor.GERENTE_SEDE, 'sedeA', 'gsA');
const gsB = u(TipoActor.GERENTE_SEDE, 'sedeB', 'gsB');
const gg = u(TipoActor.GERENTE_GENERAL, null, 'gg');

describe('GET /instructores: teléfono solo para gerentes', () => {
  const instructor = {
    id: 'i1',
    nombre: 'Lucía Gómez',
    especialidad: 'Yoga',
    telefono: '1155550000',
    activo: true,
  };
  function armar(inst = instructor) {
    const repo = {
      findAndCount: jest.fn().mockResolvedValue([[inst], 1]),
      findOne: jest.fn().mockResolvedValue(inst),
    };
    return { service: new InstructoresService(repo as never), repo };
  }

  it.each([socio, externo, recepA])(
    '%# recibe solo id, nombre y especialidad (sin teléfono ni estado)',
    async (user) => {
      const { service } = armar();
      const r = await service.findAll({}, user);
      expect(r.data[0]).toEqual({
        id: 'i1',
        nombre: 'Lucía Gómez',
        especialidad: 'Yoga',
      });
      expect(JSON.stringify(r)).not.toContain('1155550000');
      const uno = await service.findOneVisible('i1', user);
      expect(uno).toEqual({
        id: 'i1',
        nombre: 'Lucía Gómez',
        especialidad: 'Yoga',
      });
    },
  );

  it('los clientes solo ven instructores activos', async () => {
    const { service, repo } = armar();
    await service.findAll({}, socio);
    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { activo: true } }),
    );
    const inactivo = armar({ ...instructor, activo: false });
    await expect(
      inactivo.service.findOneVisible('i1', socio),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([gg, gsA])('gerentes ven la ficha completa', async (user) => {
    const { service } = armar();
    const r = await service.findAll({}, user);
    expect((r.data[0] as { telefono: string }).telefono).toBe('1155550000');
  });
});

describe('GET /clases/:id y /ocurrencias: vista reducida y alcance por sede', () => {
  const clase = {
    id: 'c1',
    tipoClase: 'Yoga',
    capacidad: 10,
    horasSemanalesTotales: '3.0',
    activa: true,
    creadaEn: new Date(),
    sede: {
      id: 'sedeA',
      nombre: 'A',
      direccion: 'Calle 1',
      aforoMaximo: 80,
      activa: true,
    },
    instructor: {
      id: 'i1',
      nombre: 'Lu',
      especialidad: 'Yoga',
      telefono: '1155550000',
      activo: true,
    },
    horariosSemanales: [
      {
        id: 'h1',
        diaSemana: 1,
        horaInicio: '18:00:00',
        horaFin: '19:00:00',
        clase: {},
      },
    ],
  };
  function armar() {
    const clasesRepo = {
      findOne: jest.fn().mockResolvedValue(clase),
      findAndCount: jest.fn().mockResolvedValue([[clase], 1]),
    };
    const qb: Record<string, jest.Mock> = {};
    for (const m of [
      'innerJoin',
      'where',
      'orderBy',
      'addOrderBy',
      'andWhere',
      'skip',
      'take',
    ]) {
      qb[m] = jest.fn(() => qb);
    }
    qb.getManyAndCount = jest.fn().mockResolvedValue([
      [
        {
          id: 'o1',
          fecha: '2026-10-20',
          horaInicio: '18:00:00',
          horaFin: '19:00:00',
          estado: 'PROGRAMADA',
          creadaEn: new Date(),
        },
      ],
      1,
    ]);
    const ocurrenciasRepo = {
      createQueryBuilder: jest.fn(() => qb),
      manager: {
        createQueryBuilder: () => {
          const q: Record<string, jest.Mock> = {};
          for (const m of [
            'select',
            'addSelect',
            'where',
            'andWhere',
            'groupBy',
          ])
            q[m] = jest.fn(() => q);
          q.getRawMany = jest.fn().mockResolvedValue([]);
          return q;
        },
      },
    };
    const service = new ClasesService(
      clasesRepo as never,
      {} as never,
      {} as never,
      ocurrenciasRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, clasesRepo };
  }

  it.each([socio, externo])(
    '%# recibe un DTO sin sede ni instructor completos',
    async (user) => {
      const { service } = armar();
      const uno = await service.findOneVisible('c1', user);
      const lista = await service.findAll(undefined, undefined, user);
      for (const r of [uno, lista.data[0]]) {
        const txt = JSON.stringify(r);
        expect(txt).not.toContain('1155550000');
        expect(txt).not.toContain('Calle 1');
        expect(txt).not.toContain('aforoMaximo');
        expect(txt).toContain('Yoga');
      }
    },
  );

  it('las ocurrencias para un cliente no traen campos internos', async () => {
    const { service } = armar();
    const r = await service.listarOcurrencias(
      'c1',
      undefined,
      undefined,
      undefined,
      socio,
    );
    expect(Object.keys(r.data[0]).sort()).toEqual([
      'cupoOcupado',
      'estado',
      'fecha',
      'horaFin',
      'horaInicio',
      'id',
    ]);
  });

  it.each([
    ['GERENTE_SEDE', gsB],
    ['RECEPCIONISTA de otra sede', u(TipoActor.RECEPCIONISTA, 'sedeB')],
    ['RECEPCIONISTA sin sede', u(TipoActor.RECEPCIONISTA, null)],
  ])(
    '%s: 403 sobre una clase de otra sede (detalle y ocurrencias)',
    async (_n, user) => {
      const { service } = armar();
      await expect(service.findOneVisible('c1', user)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.listarOcurrencias('c1', undefined, undefined, undefined, user),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each([gsA, recepA, gg])(
    '%# ve la clase de su sede (o todas, el GG) con la ficha completa',
    async (user) => {
      const { service } = armar();
      const r = (await service.findOneVisible('c1', user)) as {
        instructor: { telefono?: string };
      };
      expect(r.instructor.telefono).toBe('1155550000');
    },
  );

  it('la recepción solo lista clases de su sede, y sin sede no ve nada', async () => {
    const { service, clasesRepo } = armar();
    await service.findAll('sedeB', undefined, recepA);
    expect(clasesRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sede: { id: 'sedeA' }, activa: true },
      }),
    );
    clasesRepo.findAndCount.mockClear();
    const vacio = await service.findAll(
      undefined,
      undefined,
      u(TipoActor.RECEPCIONISTA, null),
    );
    expect(vacio.data).toEqual([]);
    expect(clasesRepo.findAndCount).not.toHaveBeenCalled();
  });
});

describe('QR de acceso: solo el propio socio', () => {
  it('nadie genera el QR de otra persona (ni el personal)', () => {
    const service = { generarQr: jest.fn() };
    const c = new AccesoController(service as never);
    for (const user of [recepA, gsA, gg, socio]) {
      expect(() => c.generarQr('otro-usuario', user)).toThrow(
        ForbiddenException,
      );
    }
    expect(service.generarQr).not.toHaveBeenCalled();
    c.generarQr('socio1', socio);
    expect(service.generarQr).toHaveBeenCalledWith('socio1');
  });

  it('historial de accesos: el personal de sede ve solo su sede; el propio y el GG, todo', () => {
    const service = { findHistorialPorUsuario: jest.fn() };
    const c = new AccesoController(service as never);
    c.findHistorial('socio1', gsA, {});
    c.findHistorial('socio1', gg, {});
    c.findHistorial('socio1', socio, {});
    const sedes = service.findHistorialPorUsuario.mock.calls.map(
      (x) => (x as unknown[])[2],
    );
    expect(sedes).toEqual(['sedeA', undefined, undefined]);
    expect(() =>
      c.findHistorial('socio1', u(TipoActor.RECEPCIONISTA, null), {}),
    ).toThrow(ForbiddenException);
  });
});

describe('Membresías y contraseñas: alcance', () => {
  it('no hay alta ni renovación de membresía sin pago por la API', () => {
    const proto = MembresiasController.prototype as unknown as Record<string, unknown>;
    expect(proto.create).toBeUndefined();
    expect(proto.renovar).toBeUndefined();
  });

  it('el personal no paga una membresía en otra sede en nombre de otra persona', () => {
    const pagos = { pagarConPasarela: jest.fn() };
    const c = new PagosController(pagos as never, {} as never);
    const dto = {
      usuarioId: 'cli',
      sedeAltaId: 'sedeB',
      plan: 'MENSUAL',
    } as never;
    expect(() => c.pagarConPasarela(dto, recepA)).toThrow(ForbiddenException);
    expect(() => c.pagarConPasarela(dto, gsA)).toThrow(ForbiddenException);
    c.pagarConPasarela(dto, gg);
    expect(pagos.pagarConPasarela).toHaveBeenCalledTimes(1);
  });

  it('una membresía ajena de otra sede no se puede leer', async () => {
    const service = {
      findOne: jest.fn().mockResolvedValue({
        usuario: { id: 'cli' },
        sedeAlta: { id: 'sedeB' },
      }),
    };
    const c = new MembresiasController(service as never);
    await expect(c.findOne('m1', gsA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(c.findOne('m1', gg)).resolves.toBeDefined();
  });

  it('solo se cambia la propia contraseña', async () => {
    const service = { changePassword: jest.fn() };
    const c = new UsuariosController(service as never);
    const dto = { passwordActual: 'a', password: 'b' } as never;
    await expect(c.changePassword('otro', dto, gg)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await c.changePassword('socio1', dto, socio);
    expect(service.changePassword).toHaveBeenCalledTimes(1);
  });
});

describe('Pagos: alcance por sede', () => {
  function armar(pago: unknown) {
    const repo = {
      findOne: jest.fn().mockResolvedValue(pago),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const s = new PagosService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { s, repo };
  }
  const pagoDeSedeB = {
    id: 'p',
    usuario: { id: 'cli' },
    membresia: { sedeAlta: { id: 'sedeB' } },
  };

  it('el personal de otra sede recibe 403; el GG y el dueño, no', async () => {
    const { s } = armar(pagoDeSedeB);
    await expect(s.findOne('p', gsA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(s.findOne('p', recepA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(s.findOne('p', gg)).resolves.toBeDefined();
    await expect(
      s.findOne('p', u(TipoActor.SOCIO, null, 'cli')),
    ).resolves.toBeDefined();
  });

  it('un pago cuya sede no se puede determinar es 403 para el personal de sede (fail-closed)', async () => {
    const { s } = armar({ id: 'p', usuario: { id: 'cli' } });
    await expect(s.findOne('p', gsA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('el listado por usuario filtra por la sede del personal', async () => {
    const { s, repo } = armar(null);
    await s.findPorUsuario('cli', {}, gsA);
    const where = (repo.findAndCount.mock.calls[0] as [{ where: unknown[] }])[0]
      .where;
    expect(Array.isArray(where)).toBe(true);
    expect(JSON.stringify(where)).toContain('sedeA');
    await s.findPorUsuario('cli', {}, gg);
    const todo = (repo.findAndCount.mock.calls[1] as [{ where: unknown }])[0]
      .where;
    expect(Array.isArray(todo)).toBe(false);
    await s.findPorUsuario('cli', {}, u(TipoActor.SOCIO, null, 'cli'));
    expect(
      Array.isArray(
        (repo.findAndCount.mock.calls[2] as [{ where: unknown }])[0].where,
      ),
    ).toBe(false);
  });
});

describe('Cancelar reservas de otra persona: alcance por sede', () => {
  it('canchas', async () => {
    const reserva = {
      usuario: { id: 'cli' },
      cancha: { sede: { id: 'sedeB' } },
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(reserva),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
    };
    const s = new ReservasCanchaService(
      {} as never,
      {} as never,
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(s.cancelar('r', gsA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.save).not.toHaveBeenCalled();
    await expect(s.cancelar('r', gg)).resolves.toBeDefined();
    await expect(
      s.cancelar('r', u(TipoActor.SOCIO, null, 'cli')),
    ).resolves.toBeDefined();
  });

  it('clases', async () => {
    const reserva = {
      estado: 'CANCELADA',
      usuario: { id: 'cli' },
      ocurrencia: { id: 'o', clase: { sede: { id: 'sedeB' } } },
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(reserva),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
    };
    const s = new ReservasClaseService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { emit: jest.fn() } as never,
    );
    await expect(s.cancelar('r', recepA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('Canchas: un Gerente de Sede no lee canchas de otra sede por id', () => {
  it('findOneVisible', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'c', sede: { id: 'sedeB' } }),
    };
    const s = new CanchasService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(s.findOneVisible('c', gsA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(s.findOneVisible('c', socio)).resolves.toBeDefined();
    await expect(s.findOneVisible('c', gg)).resolves.toBeDefined();
  });
});
