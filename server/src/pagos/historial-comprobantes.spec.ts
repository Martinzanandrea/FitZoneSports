import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Comprobante, Pago } from '../entities';
import { EstadoPago, TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { HistorialPagosService, puedeVerPago } from './historial-pagos.service';
import { PagosService } from './pagos.service';

const u = (
  tipoActor: TipoActor,
  sedeId: string | null = null,
  id = 'x1',
): UsuarioAutenticado => ({ id, tipoActor, email: 'x@x.com', sedeId });
const socio = u(TipoActor.SOCIO, null, 'socio1');
const externo = u(TipoActor.EXTERNO, null, 'ext1');
const recepA = u(TipoActor.RECEPCIONISTA, 'sedeA', 'recA');
const gsA = u(TipoActor.GERENTE_SEDE, 'sedeA', 'gsA');
const gg = u(TipoActor.GERENTE_GENERAL, null, 'gg');

function armarHistorial(filas: unknown[] = []) {
  const query = jest.fn((sql: string, _params?: unknown[]) => {
    if (sql.includes('COUNT(*)::text AS cantidad')) {
      return Promise.resolve([
        { cantidad: '2', aprobado: '15000', efectivo: '5000', online: '10000' },
      ]);
    }
    if (sql.includes('COUNT(*)::text AS total')) {
      return Promise.resolve([{ total: '1' }]);
    }
    return Promise.resolve(filas);
  });
  const config = { get: jest.fn().mockReturnValue('https://x.supabase.co') };
  return {
    service: new HistorialPagosService({ query } as never, config as never),
    query,
  };
}

describe('GET /pagos (historial del personal)', () => {
  it('el recepcionista y el gerente de sede quedan acotados a SU sede', async () => {
    for (const user of [recepA, gsA]) {
      const { service, query } = armarHistorial();
      // Intenta pasar otra sede: se ignora.
      await service.listar({ sedeId: 'sedeB' } as never, user);
      const params = query.mock.calls[0][1] as unknown[];
      expect(params).toContain('sedeA');
      expect(params).not.toContain('sedeB');
    }
  });

  it('fail-closed: sin sede asignada no lista nada', async () => {
    const { service, query } = armarHistorial();
    await expect(
      service.listar({} as never, u(TipoActor.RECEPCIONISTA, null)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });

  it('el GG ve todas las sedes y puede filtrar una', async () => {
    const a = armarHistorial();
    await a.service.listar({} as never, gg);
    expect(a.query.mock.calls[0][1]).toEqual([]);
    const b = armarHistorial();
    await b.service.listar({ sedeId: 'sedeB' } as never, gg);
    expect(b.query.mock.calls[0][1]).toContain('sedeB');
  });

  it('filtros: fechas en hora Argentina, método, tipo, estado, todo parametrizado', async () => {
    const { service, query } = armarHistorial();
    await service.listar(
      {
        desde: '2026-10-01',
        hasta: '2026-10-09',
        metodo: 'ONLINE',
        tipo: 'CANCHA',
        estado: EstadoPago.APROBADO,
      } as never,
      gg,
    );
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("AT TIME ZONE 'America/Argentina/Buenos_Aires'");
    expect(sql).toContain("p.metodo <> 'EFECTIVO'");
    expect(sql).toContain('p.reserva_cancha_id IS NOT NULL');
    expect(query.mock.calls[0][1]).toEqual([
      '2026-10-01',
      '2026-10-09',
      EstadoPago.APROBADO,
    ]);
    expect(sql).not.toContain('2026-10-01');
  });

  it('búsqueda: mínimo 3 caracteres y comodines LIKE escapados', async () => {
    const corta = armarHistorial();
    await expect(
      corta.service.listar({ q: 'ab' } as never, gg),
    ).rejects.toBeInstanceOf(BadRequestException);
    const ok = armarHistorial();
    await ok.service.listar({ q: '50%_x' } as never, gg);
    expect(ok.query.mock.calls[0][1]).toEqual(['%50\\%\\_x%']);
  });

  it('pagina en SQL, calcula totales en SQL y arma las filas sin datos de más', async () => {
    const fila = {
      id: 'p1',
      fecha: new Date(0),
      usuario_id: 'c1',
      nombre: 'Ana',
      apellido: 'Paz',
      metodo: 'EFECTIVO',
      monto: '5000.00',
      estado: 'APROBADO',
      tipo: 'MEMBRESIA',
      plan: 'MENSUAL',
      cancha_nombre: null,
      res_fecha: null,
      res_hora_inicio: null,
      sede_id: 'sedeA',
      sede_nombre: 'Centro',
      cobrador_nombre: 'Rita',
      cobrador_apellido: 'Gómez',
      comprobante_id: 'comp1',
    };
    const { service, query } = armarHistorial([fila]);
    const r = await service.listar({ page: 2, limit: 10 } as never, recepA);
    const sqlFilas = query.mock.calls[1][0] as string;
    expect(sqlFilas).toContain('LIMIT');
    expect(query.mock.calls[1][1]).toEqual(['sedeA', 10, 10]);
    expect(r.totales).toEqual({
      cantidad: 2,
      montoAprobado: '15000',
      montoEfectivo: '5000',
      montoOnline: '10000',
    });
    expect(r.data[0]).toEqual(
      expect.objectContaining({
        concepto: 'Membresía Mensual',
        cliente: { id: 'c1', nombre: 'Ana', apellido: 'Paz' },
        cobradoPor: 'Rita Gómez',
        comprobanteId: 'comp1',
        sede: { id: 'sedeA', nombre: 'Centro' },
      }),
    );
  });
});

describe('GET /pagos/mias', () => {
  it('usa SIEMPRE el usuario del JWT y no devuelve quién cobró ni datos de otros', async () => {
    const fila = {
      id: 'p1',
      fecha: new Date(0),
      usuario_id: 'socio1',
      nombre: 'Ana',
      apellido: 'Paz',
      metodo: 'EFECTIVO',
      monto: '5000.00',
      estado: 'APROBADO',
      tipo: 'CANCHA',
      plan: null,
      cancha_nombre: 'Cancha 1',
      res_fecha: '2026-10-10',
      res_hora_inicio: '18:00:00',
      sede_id: 'sedeA',
      sede_nombre: 'Centro',
      cobrador_nombre: 'Rita',
      cobrador_apellido: 'Gómez',
      comprobante_id: null,
    };
    const { service, query } = armarHistorial([fila]);
    // Un usuarioId inyectado en la query se ignora: el servicio ni lo mira.
    const r = await service.listarMios(
      { usuarioId: 'victima' } as never,
      socio,
    );
    for (const call of query.mock.calls) {
      expect((call[1] as unknown[])[0]).toBe('socio1');
      expect(call[1]).not.toContain('victima');
    }
    const json = JSON.stringify(r);
    expect(json).not.toContain('Rita');
    expect(json).not.toContain('cobradoPor');
    expect(json).not.toContain('Ana');
    expect(r.data[0].concepto).toBe('Cancha Cancha 1 · 2026-10-10 18:00');
  });
});

describe('acceso a comprobantes', () => {
  it.each([
    [socio, { usuarioId: 'socio1', sedeId: 'sedeZ' }, true],
    [socio, { usuarioId: 'otro', sedeId: 'sedeA' }, false],
    [externo, { usuarioId: 'otro', sedeId: null }, false],
    [recepA, { usuarioId: 'otro', sedeId: 'sedeA' }, true],
    [recepA, { usuarioId: 'otro', sedeId: 'sedeB' }, false],
    [recepA, { usuarioId: 'otro', sedeId: null }, false],
    [gsA, { usuarioId: 'otro', sedeId: 'sedeB' }, false],
    [u(TipoActor.GERENTE_SEDE, null), { usuarioId: 'o', sedeId: null }, false],
    [gg, { usuarioId: 'otro', sedeId: 'sedeB' }, true],
  ])('%# puedeVerPago', (user, pago, esperado) => {
    expect(puedeVerPago(user, pago)).toBe(esperado);
  });

  it('GET /comprobantes/:id/archivo: 404 si no es del usuario ni de su sede', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([
        {
          pdf_path: 'https://x.supabase.co/a.pdf',
          usuario_id: 'otro',
          sede_id: 'sedeB',
        },
      ]);
    const config = { get: jest.fn().mockReturnValue('https://x.supabase.co') };
    const service = new HistorialPagosService(
      { query } as never,
      config as never,
    );
    await expect(service.obtenerArchivo('c1', socio)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.obtenerArchivo('c1', recepA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404 si el comprobante no existe', async () => {
    const service = new HistorialPagosService(
      { query: jest.fn().mockResolvedValue([]) } as never,
      { get: jest.fn() } as never,
    );
    await expect(service.obtenerArchivo('c1', gg)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('entrega el PDF al dueño; no descarga de un host que no es el Supabase configurado', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
    } as Response);
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          pdf_path: 'https://x.supabase.co/a.pdf',
          usuario_id: 'socio1',
          sede_id: 'sedeA',
        },
      ])
      .mockResolvedValueOnce([
        {
          pdf_path: 'https://malo.example/a.pdf',
          usuario_id: 'socio1',
          sede_id: 'sedeA',
        },
      ]);
    const config = { get: jest.fn().mockReturnValue('https://x.supabase.co') };
    const service = new HistorialPagosService(
      { query } as never,
      config as never,
    );
    const r = await service.obtenerArchivo('c1', socio);
    expect(r.buffer).toEqual(Buffer.from([1, 2, 3]));
    await expect(service.obtenerArchivo('c2', socio)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });
});

describe('comprobante bajo demanda', () => {
  function armar(opts: {
    pago?: Record<string, unknown> | null;
    existente?: Record<string, unknown> | null;
  }) {
    const pago =
      opts.pago === undefined
        ? {
            id: 'p1',
            estado: EstadoPago.APROBADO,
            usuario: { id: 'cli1' },
            membresia: { sedeAlta: { id: 'sedeA' } },
          }
        : opts.pago;
    const manager = {
      getRepository: (e: unknown) => {
        if (e === Pago) {
          const qb: Record<string, jest.Mock> = {};
          qb.setLock = jest.fn(() => qb);
          qb.where = jest.fn(() => qb);
          qb.getOne = jest.fn().mockResolvedValue(pago);
          return {
            createQueryBuilder: () => qb,
            findOne: jest.fn().mockResolvedValue(pago),
          };
        }
        if (e === Comprobante) {
          return {
            findOne: jest.fn().mockResolvedValue(opts.existente ?? null),
          };
        }
        return {};
      },
    };
    const comprobantes = {
      generar: jest
        .fn()
        .mockResolvedValue({ id: 'nuevo', generadoEn: new Date(0) }),
    };
    const service = new PagosService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      comprobantes as never,
      {} as never,
      {} as never,
      { transaction: (cb: (m: unknown) => unknown) => cb(manager) } as never,
      {} as never,
      {} as never,
    );
    return { service, comprobantes };
  }

  it('genera el comprobante de un pago aprobado sin comprobante', async () => {
    const t = armar({});
    const r = await t.service.generarComprobanteBajoDemanda('p1', recepA);
    expect(r).toEqual({ id: 'nuevo', generadoEn: new Date(0), creado: true });
    expect(t.comprobantes.generar).toHaveBeenCalledTimes(1);
  });

  it('no duplica: si ya existe devuelve el existente', async () => {
    const t = armar({ existente: { id: 'viejo', generadoEn: new Date(1) } });
    const r = await t.service.generarComprobanteBajoDemanda('p1', gg);
    expect(r).toEqual({ id: 'viejo', generadoEn: new Date(1), creado: false });
    expect(t.comprobantes.generar).not.toHaveBeenCalled();
  });

  it('409 si el pago no está aprobado', async () => {
    const t = armar({
      pago: {
        id: 'p1',
        estado: EstadoPago.RECHAZADO,
        usuario: { id: 'cli1' },
        membresia: { sedeAlta: { id: 'sedeA' } },
      },
    });
    await expect(
      t.service.generarComprobanteBajoDemanda('p1', recepA),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(t.comprobantes.generar).not.toHaveBeenCalled();
  });

  it('404 si el pago es de otra sede o no existe', async () => {
    const otra = armar({
      pago: {
        id: 'p1',
        estado: EstadoPago.APROBADO,
        usuario: { id: 'cli1' },
        membresia: { sedeAlta: { id: 'sedeB' } },
      },
    });
    await expect(
      otra.service.generarComprobanteBajoDemanda('p1', recepA),
    ).rejects.toBeInstanceOf(NotFoundException);
    const nada = armar({ pago: null });
    await expect(
      nada.service.generarComprobanteBajoDemanda('p1', gg),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(otra.comprobantes.generar).not.toHaveBeenCalled();
  });
});
