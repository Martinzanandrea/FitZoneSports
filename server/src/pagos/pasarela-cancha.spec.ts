import { ConflictException, NotFoundException } from '@nestjs/common';
import { Pago, ReservaCancha } from '../entities';
import {
  EstadoPago,
  EstadoResCancha,
  MetodoPago,
  TipoActor,
} from '../entities/enums';
import { PagosService } from './pagos.service';

// POST /pagos/pasarela con reservaCanchaId: misma protección que el efectivo.
// Base simulada: transacción que confirma al terminar bien y lock por cola.
interface Opciones {
  duenoId?: string;
  estado?: EstadoResCancha;
  pagoPrevio?: boolean;
  aprobado?: boolean;
}

function armar(opts: Opciones = {}) {
  const reserva = {
    id: 'res1',
    estado: opts.estado ?? EstadoResCancha.CONFIRMADA,
    precioFinal: '8500.00',
    usuario: { id: opts.duenoId ?? 'cli1' },
  };
  const pagosConfirmados: Array<Record<string, unknown>> = opts.pagoPrevio
    ? [{ estado: EstadoPago.APROBADO }]
    : [];
  let cola: Promise<void> = Promise.resolve();
  const lock = jest.fn();

  const transaction = async <T>(cb: (m: unknown) => Promise<T>): Promise<T> => {
    const staged: Array<Record<string, unknown>> = [];
    let liberar: () => void = () => undefined;
    const manager = {
      getRepository: (entidad: unknown) => {
        if (entidad === ReservaCancha) {
          const qb: Record<string, jest.Mock> = {};
          for (const m of ['innerJoinAndSelect', 'where']) {
            qb[m] = jest.fn(() => qb);
          }
          qb.setLock = jest.fn((...a: unknown[]) => {
            lock(...a);
            return qb;
          });
          qb.getOne = jest.fn(async () => {
            const previa = cola;
            cola = new Promise<void>((r) => (liberar = r));
            await previa;
            return reserva;
          });
          return { createQueryBuilder: () => qb };
        }
        if (entidad === Pago) {
          return {
            exists: ({ where }: { where: { estado: EstadoPago } }) =>
              Promise.resolve(
                pagosConfirmados.some((p) => p.estado === where.estado),
              ),
            create: (d: Record<string, unknown>) => ({ ...d, id: 'pago1' }),
            save: (p: Record<string, unknown>) => {
              staged.push(p);
              return Promise.resolve(p);
            },
          };
        }
        return {};
      },
    };
    try {
      const r = await cb(manager);
      pagosConfirmados.push(...staged);
      return r;
    } finally {
      liberar();
    }
  };

  const usuariosRepo = {
    findOne: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, tipoActor: TipoActor.SOCIO }),
    ),
  };
  const reservasCanchaRepo = {
    findOne: jest
      .fn()
      .mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === 'res1' ? { id: 'res1' } : null),
      ),
  };
  const pasarela = {
    procesarPago: jest
      .fn()
      .mockResolvedValue({ aprobado: opts.aprobado ?? true, token: 'tok' }),
  };
  const comprobantes = { generar: jest.fn().mockResolvedValue({ id: 'c1' }) };
  const service = new PagosService(
    {} as never,
    usuariosRepo as never,
    {} as never,
    reservasCanchaRepo as never,
    pasarela as never,
    comprobantes as never,
    {} as never,
    {} as never,
    { transaction } as never,
    { registrar: jest.fn() } as never,
    {} as never,
  );
  return { service, pagosConfirmados, comprobantes, pasarela, lock };
}

const dto = {
  usuarioId: 'cli1',
  reservaCanchaId: 'res1',
  metodo: MetodoPago.MERCADOPAGO,
} as never;

describe('POST /pagos/pasarela con reserva de cancha', () => {
  it('cobra el precio de la reserva (no el del cliente), con lock, y genera comprobante', async () => {
    const t = armar();
    const pago = await t.service.pagarConPasarela(
      { ...(dto as object), monto: 1 } as never,
      'cli1',
    );
    expect(pago.estado).toBe(EstadoPago.APROBADO);
    expect(pago.monto).toBe('8500');
    expect(t.pasarela.procesarPago).toHaveBeenCalledWith(
      8500,
      MetodoPago.MERCADOPAGO,
      false,
    );
    expect(t.lock).toHaveBeenCalledWith('pessimistic_write', undefined, ['r']);
    expect(t.comprobantes.generar).toHaveBeenCalledTimes(1);
  });

  it('409 si la reserva ya tiene un pago aprobado, sin llamar a la pasarela', async () => {
    const t = armar({ pagoPrevio: true });
    await expect(
      t.service.pagarConPasarela(dto, 'cli1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(t.pasarela.procesarPago).not.toHaveBeenCalled();
  });

  it('409 si la reserva está cancelada', async () => {
    const t = armar({ estado: EstadoResCancha.CANCELADA });
    await expect(
      t.service.pagarConPasarela(dto, 'cli1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(t.pasarela.procesarPago).not.toHaveBeenCalled();
  });

  it('404 si la reserva es de otro usuario (distinto del JWT)', async () => {
    const t = armar({ duenoId: 'otro' });
    await expect(
      t.service.pagarConPasarela(dto, 'cli1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(t.pasarela.procesarPago).not.toHaveBeenCalled();
  });

  it('404 si quien paga (JWT) no es el dueño aunque mande su usuarioId', async () => {
    const t = armar({ duenoId: 'cli1' });
    await expect(
      t.service.pagarConPasarela(dto, 'staff-que-no-es-dueno'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404 si la reserva no existe', async () => {
    const t = armar();
    await expect(
      t.service.pagarConPasarela(
        { ...(dto as object), reservaCanchaId: 'nope' } as never,
        'cli1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechazado: se registra el intento, sin comprobante', async () => {
    const t = armar({ aprobado: false });
    const pago = await t.service.pagarConPasarela(dto, 'cli1');
    expect(pago.estado).toBe(EstadoPago.RECHAZADO);
    expect(t.comprobantes.generar).not.toHaveBeenCalled();
  });

  it('dos pagos simultáneos: uno cobra y el otro recibe 409 (un solo cobro)', async () => {
    const t = armar();
    const resultados = await Promise.allSettled([
      t.service.pagarConPasarela(dto, 'cli1'),
      t.service.pagarConPasarela(dto, 'cli1'),
    ]);
    const ok = resultados.filter((r) => r.status === 'fulfilled');
    const mal = resultados.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(ok).toHaveLength(1);
    expect(mal).toHaveLength(1);
    expect(mal[0].reason).toBeInstanceOf(ConflictException);
    expect(t.pasarela.procesarPago).toHaveBeenCalledTimes(1);
  });
});
