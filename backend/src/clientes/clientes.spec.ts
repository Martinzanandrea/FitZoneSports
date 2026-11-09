import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { DataSource } from 'typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TipoActor } from '../entities/enums';
import { ClientesController } from './clientes.controller';
import {
  ClientesService,
  ORDEN_CLIENTES,
  armarConsultaClientes,
} from './clientes.service';
import { ClientesQueryDto, TipoCliente } from './dto/clientes-query.dto';

function contexto(tipoActor: TipoActor): ExecutionContext {
  return {
    getHandler: () =>
      (ClientesController.prototype as unknown as Record<string, () => unknown>)
        .listar,
    getClass: () => ClientesController,
    switchToHttp: () => ({ getRequest: () => ({ user: { tipoActor } }) }),
  } as unknown as ExecutionContext;
}

const guard = new RolesGuard(new Reflector());

describe('GET /personal/clientes: permisos', () => {
  it.each([
    TipoActor.SOCIO,
    TipoActor.EXTERNO,
    TipoActor.RECEPCIONISTA,
    TipoActor.GERENTE_SEDE,
  ])('%s recibe 403', (rol) => {
    expect(() => guard.canActivate(contexto(rol))).toThrow(ForbiddenException);
  });

  it('GERENTE_GENERAL pasa el guard', () => {
    expect(guard.canActivate(contexto(TipoActor.GERENTE_GENERAL))).toBe(true);
  });
});

describe('armarConsultaClientes: filtros', () => {
  const q = (parcial: Partial<ClientesQueryDto>) =>
    Object.assign(new ClientesQueryDto(), parcial);

  it('sin filtros no agrega WHERE', () => {
    expect(armarConsultaClientes(q({}))).toEqual({ where: '', params: [] });
  });

  it('la búsqueda es parametrizada y escapa comodines de LIKE', () => {
    const { where, params } = armarConsultaClientes(q({ q: " 50%_x'; -- " }));
    expect(params).toEqual(["%50\\%\\_x'; --%"]);
    expect(where).toContain('c.nombre ILIKE $1');
    expect(where).toContain('c.apellido ILIKE $1');
    expect(where).toContain('c.dni ILIKE $1');
    expect(where).toContain('c.email ILIKE $1');
    expect(where).not.toContain("x'");
  });

  it('filtra por tipo con parámetro', () => {
    const { where, params } = armarConsultaClientes(
      q({ tipo: TipoCliente.INSTRUCTOR }),
    );
    expect(where).toBe('WHERE c.tipo = $1');
    expect(params).toEqual(['INSTRUCTOR']);
  });

  it('filtra por estado ACTIVO y BAJA', () => {
    expect(armarConsultaClientes(q({ estado: 'ACTIVO' })).where).toBe(
      'WHERE c.activo',
    );
    expect(armarConsultaClientes(q({ estado: 'BAJA' })).where).toBe(
      'WHERE NOT c.activo',
    );
  });

  it('combina filtros con AND y numera los parámetros', () => {
    const { where, params } = armarConsultaClientes(
      q({ q: 'ana', tipo: TipoCliente.SOCIO, estado: 'BAJA' }),
    );
    expect(params).toEqual(['%ana%', 'SOCIO']);
    expect(where).toContain('c.tipo = $2');
    expect(where).toMatch(/ AND NOT c\.activo$/);
  });
});

describe('ORDEN_CLIENTES', () => {
  it('activos primero, luego apellido y nombre, con desempate estable', () => {
    expect(ORDEN_CLIENTES).toMatch(
      /^ORDER BY c\.activo DESC, lower\(COALESCE\(c\.apellido, c\.nombre\)\), lower\(c\.nombre\), c\.id$/,
    );
  });
});

describe('ClientesService.listar', () => {
  const fila = {
    id: 'u1',
    tipo: 'SOCIO',
    nombre: 'Ana',
    apellido: 'Paz',
    dni: '123',
    email: 'ana@x.com',
    telefono: null,
    activo: true,
    sede_id: 's1',
    sede_nombre: 'Centro',
    plan: 'MENSUAL',
    vencimiento: '2026-12-01',
    // Aunque la base devolviera algo extra, no debe filtrarse a la respuesta.
    password_hash: 'secreto',
  };

  function armar(filas: unknown[], total: string) {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total }])
      .mockResolvedValueOnce(filas);
    const service = new ClientesService({ query } as unknown as DataSource);
    return { service, query };
  }

  it('pagina en la base y calcula totales', async () => {
    const { service, query } = armar([fila], '45');
    const res = await service.listar(
      Object.assign(new ClientesQueryDto(), { page: 3, limit: 10 }),
    );
    const [sqlLista, paramsLista] = query.mock.calls[1] as [string, unknown[]];
    expect(sqlLista).toContain(ORDEN_CLIENTES);
    expect(sqlLista).toContain('LIMIT $1 OFFSET $2');
    expect(paramsLista).toEqual([10, 20]);
    expect(res).toMatchObject({ total: 45, page: 3, limit: 10, totalPages: 5 });
  });

  it('devuelve solo campos necesarios, sin datos sensibles', async () => {
    const { service } = armar([fila], '1');
    const res = await service.listar(new ClientesQueryDto());
    expect(Object.keys(res.data[0]).sort()).toEqual(
      [
        'activo',
        'apellido',
        'dni',
        'email',
        'id',
        'membresia',
        'nombre',
        'sede',
        'telefono',
        'tipo',
      ].sort(),
    );
    expect(JSON.stringify(res)).not.toMatch(/password|hash|secreto|token/i);
    expect(res.data[0].sede).toEqual({ id: 's1', nombre: 'Centro' });
    expect(res.data[0].membresia).toEqual({
      plan: 'MENSUAL',
      vencimiento: '2026-12-01',
    });
  });

  it('instructor: sin sede ni membresía', async () => {
    const { service } = armar(
      [
        {
          ...fila,
          id: 'i1',
          tipo: 'INSTRUCTOR',
          apellido: null,
          dni: null,
          email: null,
          sede_id: null,
          sede_nombre: null,
          plan: null,
          vencimiento: null,
        },
      ],
      '1',
    );
    const res = await service.listar(new ClientesQueryDto());
    expect(res.data[0]).toMatchObject({
      tipo: 'INSTRUCTOR',
      sede: null,
      membresia: null,
    });
  });

  it('sin resultados: totalPages mínimo 1', async () => {
    const { service } = armar([], '0');
    const res = await service.listar(new ClientesQueryDto());
    expect(res).toMatchObject({ data: [], total: 0, totalPages: 1 });
  });
});
