import { Pago, Usuario, Membresia } from '../entities';
import { EstadoPago, MetodoPago, TipoActor, TipoPlan } from '../entities/enums';
import { PagosService } from './pagos.service';

// Tests con repositorios simulados: no tocan la base. Cubren la promoción
// EXTERNO → SOCIO al aprobarse un pago de membresía (ADR 0011).

const ID_TITULAR = 'titular-1';
const ID_MEMBRESIA = 'membresia-1';
const ID_RECEP = 'recep-1';
const ID_SEDE = 'sede-1';

function armar(opts: {
  rolTitular: string;
  aprobado?: boolean;
  fallaUpdateRol?: boolean;
}) {
  const pagosGuardados: Array<Record<string, unknown>> = [];
  const update = jest.fn().mockImplementation(() => {
    if (opts.fallaUpdateRol) return Promise.reject(new Error('db caída'));
    return Promise.resolve({ affected: 1 });
  });
  const titular = { id: ID_TITULAR, tipoActor: opts.rolTitular };
  const membresia = {
    id: ID_MEMBRESIA,
    plan: TipoPlan.MENSUAL,
    usuario: titular,
  };

  const repos = new Map<unknown, unknown>([
    [
      Pago,
      {
        create: (d: Record<string, unknown>) => ({ id: 'pago-1', ...d }),
        save: (p: Record<string, unknown>) => {
          pagosGuardados.push(p);
          return Promise.resolve(p);
        },
      },
    ],
    [Membresia, { findOne: () => Promise.resolve(membresia) }],
    [Usuario, { update }],
  ]);
  const manager = { getRepository: (e: unknown) => repos.get(e) };

  // Simula el rollback: si el callback falla, lo guardado se descarta.
  const dataSource = {
    transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => {
      const antes = pagosGuardados.length;
      try {
        return await cb(manager);
      } catch (e) {
        pagosGuardados.length = antes;
        throw e;
      }
    }),
  };

  const pagosRepo = {
    create: (d: Record<string, unknown>) => ({ id: 'pago-rechazado', ...d }),
    save: jest.fn((p: Record<string, unknown>) => Promise.resolve(p)),
  };
  const recepcionista = {
    id: ID_RECEP,
    tipoActor: TipoActor.RECEPCIONISTA,
    email: 'r@x.com',
    sede: { id: ID_SEDE },
  };
  const usuariosRepo = {
    findOne: ({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === ID_RECEP ? recepcionista : titular),
  };
  const membresiasRepo = { findOne: () => Promise.resolve(membresia) };
  const pasarela = {
    procesarPago: jest
      .fn()
      .mockResolvedValue({ aprobado: opts.aprobado ?? true, token: 'tok' }),
  };
  const comprobantes = { generar: jest.fn().mockResolvedValue({}) };
  const preciosService = { obtenerPrecio: jest.fn().mockResolvedValue(12500) };
  const membresiasService = {
    obtenerMembresiaVigente: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(membresia),
    renovar: jest.fn(),
  };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  const service = new PagosService(
    pagosRepo as never,
    usuariosRepo as never,
    membresiasRepo as never,
    {} as never,
    pasarela as never,
    comprobantes as never,
    preciosService as never,
    membresiasService as never,
    dataSource as never,
    auditoria as never,
  );
  return {
    service,
    update,
    pagosGuardados,
    pagosRepo,
    comprobantes,
    auditoria,
  };
}

const dtoPasarela = {
  usuarioId: ID_TITULAR,
  membresiaId: ID_MEMBRESIA,
  metodo: MetodoPago.MERCADOPAGO,
};

describe('PagosService — promoción EXTERNO → SOCIO', () => {
  it('EXTERNO + pago aprobado → pasa a SOCIO y se audita', async () => {
    const t = armar({ rolTitular: TipoActor.EXTERNO });
    const pago = await t.service.pagarConPasarela(dtoPasarela as never);
    expect(pago.estado).toBe(EstadoPago.APROBADO);
    expect(t.update).toHaveBeenCalledWith(
      { id: ID_TITULAR, tipoActor: TipoActor.EXTERNO },
      { tipoActor: TipoActor.SOCIO },
    );
    expect(t.auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'PROMOVER_EXTERNO_A_SOCIO',
        entidadId: ID_TITULAR,
        detalle: expect.objectContaining({ pagoId: 'pago-1' }),
      }),
    );
  });

  it('EXTERNO + pago rechazado → sigue EXTERNO', async () => {
    const t = armar({ rolTitular: TipoActor.EXTERNO, aprobado: false });
    const pago = await t.service.pagarConPasarela(dtoPasarela as never);
    expect(pago.estado).toBe(EstadoPago.RECHAZADO);
    expect(t.update).not.toHaveBeenCalled();
    expect(t.auditoria.registrar).not.toHaveBeenCalled();
  });

  it('SOCIO + pago aprobado → sin cambios de rol', async () => {
    const t = armar({ rolTitular: TipoActor.SOCIO });
    await t.service.pagarConPasarela(dtoPasarela as never);
    expect(t.update).not.toHaveBeenCalled();
    expect(t.auditoria.registrar).not.toHaveBeenCalled();
  });

  it('GERENTE_SEDE titular + pago aprobado → sin cambios de rol', async () => {
    const t = armar({ rolTitular: TipoActor.GERENTE_SEDE });
    await t.service.pagarConPasarela(dtoPasarela as never);
    expect(t.update).not.toHaveBeenCalled();
  });

  it('falla al guardar el rol → el pago no queda aprobado', async () => {
    const t = armar({ rolTitular: TipoActor.EXTERNO, fallaUpdateRol: true });
    await expect(
      t.service.pagarConPasarela(dtoPasarela as never),
    ).rejects.toThrow('db caída');
    expect(t.pagosGuardados).toHaveLength(0);
    expect(t.comprobantes.generar).not.toHaveBeenCalled();
    expect(t.auditoria.registrar).not.toHaveBeenCalled();
  });

  it('cobro en efectivo del staff a un EXTERNO → el titular pasa a SOCIO (no quien cobra)', async () => {
    const t = armar({ rolTitular: TipoActor.EXTERNO });
    const pago = await t.service.registrarPagoEfectivo(
      { usuarioId: ID_TITULAR, plan: TipoPlan.MENSUAL } as never,
      ID_RECEP,
    );
    expect(pago.estado).toBe(EstadoPago.APROBADO);
    expect(t.update).toHaveBeenCalledTimes(1);
    expect(t.update).toHaveBeenCalledWith(
      { id: ID_TITULAR, tipoActor: TipoActor.EXTERNO },
      { tipoActor: TipoActor.SOCIO },
    );
    expect(t.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: ID_RECEP }),
      expect.anything(),
    );
  });
});

describe('PagosService — comprobante en la respuesta', () => {
  it('el cobro en efectivo devuelve el comprobante sin referencia circular', async () => {
    const t = armar({ rolTitular: TipoActor.SOCIO });
    t.comprobantes.generar.mockResolvedValue({
      id: 'comp-1',
      pdfPath: 'https://x/c.pdf',
      generadoEn: new Date(0),
      pago: { circular: true },
    });
    const pago = await t.service.registrarPagoEfectivo(
      { usuarioId: ID_TITULAR, plan: TipoPlan.MENSUAL } as never,
      ID_RECEP,
    );
    expect(pago.comprobante).toEqual({
      id: 'comp-1',
      pdfPath: 'https://x/c.pdf',
      generadoEn: new Date(0),
    });
    expect(() => JSON.stringify(pago)).not.toThrow();
  });
});
