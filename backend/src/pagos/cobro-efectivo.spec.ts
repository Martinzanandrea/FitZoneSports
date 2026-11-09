import type { ExecutionContext } from '@nestjs/common';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TipoActor } from '../entities/enums';
import { UsuariosController } from '../usuarios/usuarios.controller';
import { UsuariosService } from '../usuarios/usuarios.service';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { ClientesCobroQueryDto } from './dto/clientes-cobro-query.dto';

const guard = new RolesGuard(new Reflector());

function contexto(
  clase: new (...a: never[]) => object,
  handler: string,
  tipoActor: TipoActor,
): ExecutionContext {
  return {
    getHandler: () =>
      (clase.prototype as Record<string, () => unknown>)[handler],
    getClass: () => clase,
    switchToHttp: () => ({ getRequest: () => ({ user: { tipoActor } }) }),
  } as unknown as ExecutionContext;
}

const ENDPOINTS_COBRO = [
  'registrarEfectivo',
  'clientesEfectivo',
  'reservasCanchaEfectivo',
];

describe('Cobro en efectivo: solo RECEPCIONISTA', () => {
  describe.each(ENDPOINTS_COBRO)('%s', (handler) => {
    it.each([
      TipoActor.GERENTE_SEDE,
      TipoActor.GERENTE_GENERAL,
      TipoActor.SOCIO,
      TipoActor.EXTERNO,
    ])('%s recibe 403', (rol) => {
      expect(() =>
        guard.canActivate(contexto(PagosController, handler, rol)),
      ).toThrow(ForbiddenException);
    });

    it('RECEPCIONISTA pasa el guard', () => {
      expect(
        guard.canActivate(
          contexto(PagosController, handler, TipoActor.RECEPCIONISTA),
        ),
      ).toBe(true);
    });
  });
});

describe('buscar-clientes: alcance conservado para el personal que reserva', () => {
  it.each([
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
  ])('%s pasa el guard', (rol) => {
    expect(
      guard.canActivate(contexto(UsuariosController, 'buscarClientes', rol)),
    ).toBe(true);
  });

  it.each([TipoActor.SOCIO, TipoActor.EXTERNO])('%s recibe 403', (rol) => {
    expect(() =>
      guard.canActivate(contexto(UsuariosController, 'buscarClientes', rol)),
    ).toThrow(ForbiddenException);
  });
});

describe('ClientesCobroQueryDto', () => {
  const validar = (plano: object) =>
    validate(plainToInstance(ClientesCobroQueryDto, plano));

  it('acepta limit hasta 20', async () => {
    expect(await validar({ page: '1', limit: '20' })).toHaveLength(0);
  });

  it('rechaza limit mayor a 20', async () => {
    expect(await validar({ limit: '21' })).not.toHaveLength(0);
  });

  it('rechaza page menor a 1', async () => {
    expect(await validar({ page: '0' })).not.toHaveLength(0);
  });
});

const sinDependencias = () =>
  [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}] as unknown[];

function servicioCon(indice: number, dependencia: unknown) {
  const deps = sinDependencias();
  deps[indice] = dependencia;
  return new PagosService(
    ...(deps as [
      never,
      never,
      never,
      never,
      never,
      never,
      never,
      never,
      never,
      never,
      never,
    ]),
  );
}

describe('PagosService.listarClientesParaCobro', () => {
  const recep = { id: 'r', tipoActor: TipoActor.RECEPCIONISTA, sedeId: 's1' };

  function armar() {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: '45' }])
      .mockResolvedValueOnce([
        {
          id: 'u1',
          nombre: 'Ana',
          apellido: 'Paz',
          dni: '1',
          tipo_actor: 'SOCIO',
          // Aunque llegaran, no deben salir en la respuesta.
          email: 'a@x.com',
          telefono: '555',
          password_hash: 'h',
        },
      ]);
    return { service: servicioCon(8, { query }), query };
  }

  it('Recepcionista sin sede: 403 y no consulta la base', async () => {
    const { service, query } = armar();
    await expect(
      service.listarClientesParaCobro(new ClientesCobroQueryDto(), {
        ...recep,
        sedeId: null,
      } as never),
    ).rejects.toThrow(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });

  it('pagina en la base: LIMIT/OFFSET enlazados y orden estable', async () => {
    const { service, query } = armar();
    const res = await service.listarClientesParaCobro(
      Object.assign(new ClientesCobroQueryDto(), { page: 3, limit: 10 }),
      recep as never,
    );
    const [sql, params] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('ORDER BY lower(u.apellido), lower(u.nombre), u.id');
    expect(sql).toMatch(/LIMIT \$3 OFFSET \$4/);
    expect(params).toEqual(['s1', 'CONFIRMADA', 10, 20]);
    expect(res).toMatchObject({ total: 45, page: 3, limit: 10, totalPages: 5 });
  });

  it('nunca pide más de 20 aunque el DTO llegue sin validar', async () => {
    const { service, query } = armar();
    await service.listarClientesParaCobro(
      Object.assign(new ClientesCobroQueryDto(), { limit: 500 }),
      recep as never,
    );
    const [, params] = query.mock.calls[1] as [string, unknown[]];
    expect(params[params.length - 2]).toBe(20);
  });

  it('q va enlazado y con comodines de LIKE escapados', async () => {
    const { service, query } = armar();
    await service.listarClientesParaCobro(
      Object.assign(new ClientesCobroQueryDto(), { q: '50%_a;--' }),
      recep as never,
    );
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(['s1', 'CONFIRMADA', '%50\\%\\_a;--%']);
    expect(sql).not.toContain('a;--');
    expect(sql).toContain('ILIKE $3');
  });

  it('filtra por la sede de quien cobra y solo SOCIO/EXTERNO activos', async () => {
    const { service, query } = armar();
    await service.listarClientesParaCobro(
      new ClientesCobroQueryDto(),
      recep as never,
    );
    const [sql] = query.mock.calls[1] as [string];
    expect(sql).toContain("u.tipo_actor IN ('SOCIO', 'EXTERNO')");
    expect(sql).toContain('AND u.activo');
    expect(sql).toContain('u.sede_id = $1');
    expect(sql).toContain('m.sede_alta_id = $1');
    expect(sql).toContain('c.sede_id = $1');
    expect(sql).not.toMatch(/email|telefono|password/);
  });

  it('la respuesta incluye solo los campos mínimos', async () => {
    const { service } = armar();
    const res = await service.listarClientesParaCobro(
      new ClientesCobroQueryDto(),
      recep as never,
    );
    expect(Object.keys(res.data[0]).sort()).toEqual([
      'apellido',
      'dni',
      'id',
      'nombre',
      'tipoActor',
    ]);
    expect(JSON.stringify(res)).not.toMatch(/email|555|password|hash/i);
  });
});

describe('PagosService.reservasCanchaParaCobro', () => {
  it('sin sede: 403', async () => {
    const service = servicioCon(3, {});
    await expect(
      service.reservasCanchaParaCobro('u', {
        tipoActor: TipoActor.RECEPCIONISTA,
        sedeId: null,
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('busca solo las del cliente y de la sede de quien cobra, sin las ya pagadas, con tope', async () => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of [
      'innerJoinAndSelect',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'take',
    ]) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.getMany = jest.fn().mockResolvedValue([]);
    const service = servicioCon(3, {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    });
    await service.reservasCanchaParaCobro('u9', {
      tipoActor: TipoActor.RECEPCIONISTA,
      sedeId: 's1',
    } as never);
    const params = qb.andWhere.mock.calls.map((c) => c as unknown[]);
    expect(params).toContainEqual(['r.usuario_id = :usuarioId', { usuarioId: 'u9' }]);
    expect(params).toContainEqual(['s.id = :sedeId', { sedeId: 's1' }]);
    expect(
      params.some((c) => /NOT EXISTS .*pagos.*estado/.test(String(c[0]))),
    ).toBe(true);
    expect(qb.take).toHaveBeenCalledWith(50);
  });
});

describe('UsuariosService.buscarClientes', () => {
  function armar() {
    const qb: Record<string, jest.Mock> = {};
    for (const m of [
      'select',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'take',
    ]) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.getMany = jest.fn().mockResolvedValue([]);
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = new UsuariosService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, qb };
  }

  it('menos de 3 caracteres: 400', async () => {
    const { service } = armar();
    await expect(service.buscarClientes('ab')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('máximo 20, solo activos, comodines escapados y campos mínimos', async () => {
    const { service, qb } = armar();
    await service.buscarClientes('50%_x');
    expect(qb.take).toHaveBeenCalledWith(20);
    expect(qb.andWhere).toHaveBeenCalledWith('u.activo = true');
    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), {
      q: '%50\\%\\_x%',
    });
    expect(qb.select).toHaveBeenCalledWith([
      'u.id',
      'u.nombre',
      'u.apellido',
      'u.dni',
      'u.tipoActor',
    ]);
  });
});
