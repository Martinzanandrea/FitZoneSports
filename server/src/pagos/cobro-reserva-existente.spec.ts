import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Pago, ReservaCancha } from '../entities';
import {
  EstadoPago,
  EstadoResCancha,
  MetodoPago,
  TipoActor,
} from '../entities/enums';
import { PagosService } from './pagos.service';

// Cobro en efectivo de una reserva YA existente. Base simulada (no es una base
// real): transacción que confirma al terminar bien y lock de fila por cola.
interface Opciones {
  duenoId?: string;
  estado?: EstadoResCancha;
  pagoPrevio?: boolean;
  sedeReserva?: string;
}

function armar(opts: Opciones = {}) {
  const reserva = {
    id: 'res1',
    estado: opts.estado ?? EstadoResCancha.CONFIRMADA,
    precioFinal: '8500.00',
    usuario: { id: opts.duenoId ?? 'cli1' },
    cancha: { sede: { id: opts.sedeReserva ?? 'sedeA' } },
  };
  const pagosConfirmados: Array<Record<string, unknown>> = opts.pagoPrevio
    ? [{ reservaId: 'res1', estado: EstadoPago.APROBADO }]
    : [];
  let cola: Promise<void> = Promise.resolve();

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
          qb.setLock = jest.fn(() => {
            qb.__lock = jest.fn();
            return qb;
          });
          // El lock real espera a que la transacción anterior termine.
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
                [...pagosConfirmados].some((p) => p.estado === where.estado),
              ),
            create: (d: Record<string, unknown>) => ({ ...d, id: 'pago1' }),
            save: (p: Record<string, unknown>) => {
              staged.push({ ...p, reservaId: 'res1' });
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
      Promise.resolve(
        where.id === 'rec1'
          ? {
              id: 'rec1',
              tipoActor: TipoActor.RECEPCIONISTA,
              email: 'r@x.com',
              sede: { id: 'sedeA' },
            }
          : { id: where.id, tipoActor: TipoActor.SOCIO },
      ),
    ),
  };
  const reservasCanchaRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'res1' }),
  };
  const comprobantes = { generar: jest.fn().mockResolvedValue({ id: 'c1' }) };
  const service = new PagosService(
    {} as never,
    usuariosRepo as never,
    {} as never,
    reservasCanchaRepo as never,
    {} as never,
    comprobantes as never,
    {} as never,
    {} as never,
    { transaction } as never,
    { registrar: jest.fn() } as never,
    {} as never,
  );
  return { service, pagosConfirmados, comprobantes };
}

const dto = {
  usuarioId: 'cli1',
  reservaCanchaId: '11111111-1111-4111-8111-111111111111',
};

describe('Cobro en efectivo de una reserva existente', () => {
  it('cobra el monto de la reserva (ignora el que mande el cliente)', async () => {
    const { service, pagosConfirmados } = armar();
    const pago = await service.registrarPagoEfectivo(
      { ...dto, monto: 1 },
      'rec1',
    );
    expect(pago.monto).toBe('8500.00');
    expect(pago.metodo).toBe(MetodoPago.EFECTIVO);
    expect(pagosConfirmados).toHaveLength(1);
  });

  it('si ya tiene un pago aprobado: 409 y no genera otro pago ni comprobante', async () => {
    const { service, pagosConfirmados, comprobantes } = armar({
      pagoPrevio: true,
    });
    await expect(
      service.registrarPagoEfectivo(dto, 'rec1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(pagosConfirmados).toHaveLength(1);
    expect(comprobantes.generar).not.toHaveBeenCalled();
  });

  it('si la reserva es de otro usuario: 404', async () => {
    const { service, pagosConfirmados } = armar({ duenoId: 'otro' });
    await expect(
      service.registrarPagoEfectivo(dto, 'rec1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(pagosConfirmados).toHaveLength(0);
  });

  it('una reserva cancelada no se cobra: 409', async () => {
    const { service } = armar({ estado: EstadoResCancha.CANCELADA });
    await expect(
      service.registrarPagoEfectivo(dto, 'rec1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('una reserva de otra sede: 403', async () => {
    const { service, pagosConfirmados } = armar({ sedeReserva: 'sedeB' });
    await expect(
      service.registrarPagoEfectivo(dto, 'rec1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(pagosConfirmados).toHaveLength(0);
  });

  it('carrera SIMULADA (no es una base real): dos cobros a la vez, uno solo se registra', async () => {
    const { service, pagosConfirmados } = armar();
    const r = await Promise.allSettled([
      service.registrarPagoEfectivo(dto, 'rec1'),
      service.registrarPagoEfectivo(dto, 'rec1'),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const rechazado = r.find((x) => x.status === 'rejected');
    expect((rechazado as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictException,
    );
    expect(pagosConfirmados).toHaveLength(1);
  });
});
