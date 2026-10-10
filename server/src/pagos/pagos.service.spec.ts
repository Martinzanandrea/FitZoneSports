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
  vigente?: Record<string, unknown> | null;
  fallaPago?: boolean;
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
          if (opts.fallaPago) return Promise.reject(new Error('pago no guardado'));
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
    obtenerMembresiaVigente: jest.fn().mockResolvedValue(opts.vigente ?? null),
    create: jest.fn().mockResolvedValue(membresia),
    renovar: jest.fn().mockResolvedValue(membresia),
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
    {} as never,
  );
  return {
    service,
    membresiasService,
    manager,
    update,
    pagosGuardados,
    pagosRepo,
    comprobantes,
    auditoria,
  };
}

const dtoPasarela = {
  usuarioId: ID_TITULAR,
  plan: TipoPlan.MENSUAL,
  sedeAltaId: ID_SEDE,
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
    expect(t.auditoria.registrar).not.toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'PROMOVER_EXTERNO_A_SOCIO' }),
    );
  });

  it('SOCIO + pago aprobado → sin cambios de rol', async () => {
    const t = armar({ rolTitular: TipoActor.SOCIO });
    await t.service.pagarConPasarela(dtoPasarela as never);
    expect(t.update).not.toHaveBeenCalled();
    expect(t.auditoria.registrar).not.toHaveBeenCalled();
  });

  it('GERENTE_SEDE no puede pagar una membresía: se rechaza antes de cobrar', async () => {
    const t = armar({ rolTitular: TipoActor.GERENTE_SEDE });
    await expect(
      t.service.pagarConPasarela(dtoPasarela as never),
    ).rejects.toThrow('Solo un socio o un cliente externo');
    expect(t.update).not.toHaveBeenCalled();
    expect(t.membresiasService.create).not.toHaveBeenCalled();
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

describe('PagosService — una membresía solo queda activa con un pago aprobado', () => {
  it('pago aprobado: membresía y pago se crean en la MISMA transacción', async () => {
    const t = armar({ rolTitular: TipoActor.EXTERNO });
    const pago = await t.service.pagarConPasarela(dtoPasarela as never);
    expect(pago.estado).toBe(EstadoPago.APROBADO);
    expect(t.membresiasService.create).toHaveBeenCalledTimes(1);
    expect(t.membresiasService.create).toHaveBeenCalledWith(
      { usuarioId: ID_TITULAR, sedeAltaId: ID_SEDE, plan: TipoPlan.MENSUAL },
      t.manager,
    );
    expect(t.pagosGuardados).toHaveLength(1);
    expect(t.pagosGuardados[0]).toEqual(
      expect.objectContaining({ membresia: expect.objectContaining({ id: ID_MEMBRESIA }) }),
    );
  });

  it('pago rechazado: no se crea ni renueva ninguna membresía y no se guarda pago', async () => {
    const t = armar({ rolTitular: TipoActor.EXTERNO, aprobado: false });
    const pago = await t.service.pagarConPasarela(dtoPasarela as never);
    expect(pago.estado).toBe(EstadoPago.RECHAZADO);
    expect(t.membresiasService.create).not.toHaveBeenCalled();
    expect(t.membresiasService.renovar).not.toHaveBeenCalled();
    expect(t.pagosGuardados).toHaveLength(0);
    expect(t.auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'PAGO_RECHAZADO' }),
    );
  });

  it('pago rechazado de quien ya tiene membresía ACTIVO: no la toca', async () => {
    const t = armar({
      rolTitular: TipoActor.SOCIO,
      aprobado: false,
      vigente: { estado: 'ACTIVO', sedeAlta: { id: ID_SEDE } },
    });
    await t.service.pagarConPasarela(dtoPasarela as never);
    expect(t.membresiasService.renovar).not.toHaveBeenCalled();
  });

  it('si falla guardar el pago, la transacción se deshace (nada queda activo sin pago)', async () => {
    const t = armar({ rolTitular: TipoActor.EXTERNO, fallaPago: true });
    await expect(
      t.service.pagarConPasarela(dtoPasarela as never),
    ).rejects.toThrow('pago no guardado');
    expect(t.pagosGuardados).toHaveLength(0);
    expect(t.comprobantes.generar).not.toHaveBeenCalled();
  });

  it('renovación con pago: renueva dentro de la transacción, con la sede de la vigente', async () => {
    const t = armar({
      rolTitular: TipoActor.SOCIO,
      vigente: { estado: 'ACTIVO', sedeAlta: { id: 'sede-vieja' } },
    });
    const pago = await t.service.pagarConPasarela({
      ...dtoPasarela,
      sedeAltaId: undefined,
    } as never);
    expect(pago.estado).toBe(EstadoPago.APROBADO);
    expect(t.membresiasService.create).not.toHaveBeenCalled();
    expect(t.membresiasService.renovar).toHaveBeenCalledWith(
      { usuarioId: ID_TITULAR, sedeAltaId: 'sede-vieja', plan: TipoPlan.MENSUAL },
      t.manager,
    );
    expect(t.pagosGuardados).toHaveLength(1);
  });

  it('Socio vencido: volver a ser activo exige un pago (crea una membresía nueva con él)', async () => {
    const t = armar({
      rolTitular: TipoActor.SOCIO,
      vigente: { estado: 'VENCIDO', sedeAlta: { id: ID_SEDE } },
    });
    await t.service.pagarConPasarela(dtoPasarela as never);
    expect(t.membresiasService.renovar).not.toHaveBeenCalled();
    expect(t.membresiasService.create).toHaveBeenCalledTimes(1);
    expect(t.pagosGuardados).toHaveLength(1);
  });

  it('Socio vencido con pago rechazado: no se reactiva nada', async () => {
    const t = armar({
      rolTitular: TipoActor.SOCIO,
      aprobado: false,
      vigente: { estado: 'VENCIDO', sedeAlta: { id: ID_SEDE } },
    });
    await t.service.pagarConPasarela(dtoPasarela as never);
    expect(t.membresiasService.create).not.toHaveBeenCalled();
    expect(t.membresiasService.renovar).not.toHaveBeenCalled();
  });

  it('sin sede de alta (cliente nuevo sin sedeAltaId): 400 antes de cobrar', async () => {
    const t = armar({ rolTitular: TipoActor.EXTERNO });
    await expect(
      t.service.pagarConPasarela({ ...dtoPasarela, sedeAltaId: undefined } as never),
    ).rejects.toThrow('sedeAltaId');
    expect(t.membresiasService.create).not.toHaveBeenCalled();
  });
});
