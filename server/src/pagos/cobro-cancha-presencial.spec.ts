import type { ExecutionContext } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import {
  EstadoCancha,
  EstadoMembresia,
  EstadoPago,
  EstadoResCancha,
  MetodoPago,
  TipoActor,
  TipoEstrategiaPrecio,
} from '../entities/enums';
import { Comprobante, Pago, ReservaCancha } from '../entities';
import { PricingCalculatorService } from '../canchas/pricing/pricing-calculator.service';
import { MemberDiscountPricing } from '../canchas/pricing/member-discount-pricing.strategy';
import { PeakHourPricing } from '../canchas/pricing/peak-hour-pricing.strategy';
import { ReservasCanchaService } from '../canchas/reserva-cancha.service';
import {
  TypeOrmBookingCanchaRepository,
  type DatosNuevaReserva,
  type IBookingCanchaRepository,
} from '../canchas/booking-cancha.repository';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { CobrarCanchaPresencialDto } from './dto/cobrar-cancha-presencial.dto';

// "Ahora" fijo: 2026-10-09 15:00 en Argentina (= 18:00 UTC).
const AHORA = new Date('2026-10-09T18:00:00Z');
const FECHA = '2026-10-10';

// ───────────────────────── Base simulada ─────────────────────────
// NO es una base real: simula una transacción (lo escrito dentro solo se
// confirma si el callback termina bien) y el lock de la fila de la cancha
// con una cola por cancha. Sirve para probar la lógica de atomicidad y de
// concurrencia, no el comportamiento de Postgres.
interface Staged {
  reservas: Array<Record<string, unknown>>;
  pagos: Array<Record<string, unknown>>;
  comprobantes: Array<Record<string, unknown>>;
}
type ManagerFalso = {
  staged: Staged;
  getRepository: (entidad: unknown) => {
    create: (x: Record<string, unknown>) => Record<string, unknown>;
    save: (x: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
};

class BaseSimulada {
  committed: Staged = { reservas: [], pagos: [], comprobantes: [] };
  fallarAlGuardarPago = false;
  private colas = new Map<string, Promise<void>>();
  private n = 0;

  siguienteId(prefijo: string) {
    return `${prefijo}-${++this.n}`;
  }

  // Espera su turno para la cancha y devuelve la función que libera el lock.
  async bloquear(canchaId: string): Promise<() => void> {
    const previa = this.colas.get(canchaId) ?? Promise.resolve();
    let liberar!: () => void;
    const mia = new Promise<void>((res) => (liberar = res));
    this.colas.set(
      canchaId,
      previa.then(() => mia),
    );
    await previa;
    return liberar;
  }

  async transaction<T>(cb: (m: ManagerFalso) => Promise<T>): Promise<T> {
    const staged: Staged = { reservas: [], pagos: [], comprobantes: [] };
    const liberaciones: Array<() => void> = [];
    const manager = {
      staged,
      liberaciones,
      getRepository: (entidad: unknown) => {
        const tabla =
          entidad === Pago
            ? 'pagos'
            : entidad === Comprobante
              ? 'comprobantes'
              : 'reservas';
        return {
          create: (x: Record<string, unknown>) => ({ ...x }),
          save: (x: Record<string, unknown>) => {
            if (tabla === 'pagos' && this.fallarAlGuardarPago) {
              return Promise.reject(new Error('fallo al guardar el pago'));
            }
            const fila = { ...x, id: x.id ?? this.siguienteId(tabla) };
            staged[tabla].push(fila);
            return Promise.resolve(fila);
          },
        };
      },
    };
    try {
      const r = await cb(manager);
      this.committed.reservas.push(...staged.reservas);
      this.committed.pagos.push(...staged.pagos);
      this.committed.comprobantes.push(...staged.comprobantes);
      return r;
    } finally {
      liberaciones.forEach((l) => l());
    }
  }
}

// Repositorio de reservas con la MISMA lógica que el real (lock, mantenimiento,
// bloqueo, sobreventa), pero escribiendo en la base simulada.
class BookingSimulado implements IBookingCanchaRepository {
  estados = new Map<string, EstadoCancha>();
  bloqueos: Array<{ canchaId: string; hora: string }> = [];
  constructor(private readonly db: BaseSimulada) {}

  async crearReservaSegura(datos: DatosNuevaReserva, m?: unknown) {
    const manager = m as ManagerFalso & { liberaciones: Array<() => void> };
    manager.liberaciones.push(await this.db.bloquear(datos.canchaId));
    if (this.estados.get(datos.canchaId) === EstadoCancha.MANTENIMIENTO) {
      throw new BadRequestException('La cancha está en mantenimiento');
    }
    if (
      this.bloqueos.some(
        (b) => b.canchaId === datos.canchaId && b.hora === datos.horaInicio,
      )
    ) {
      throw new BadRequestException(
        'La cancha tiene un bloqueo por mantenimiento en ese horario',
      );
    }
    const existe = [
      ...this.db.committed.reservas,
      ...manager.staged.reservas,
    ].some(
      (r) =>
        r.canchaId === datos.canchaId &&
        r.fecha === datos.fecha &&
        r.horaInicio === datos.horaInicio,
    );
    await Promise.resolve(); // cede el turno: sin el lock, dos requests se pisarían
    if (existe) {
      throw new ConflictException(
        'Ese horario ya fue reservado para esta cancha',
      );
    }
    const fila = {
      id: this.db.siguienteId('reservas'),
      canchaId: datos.canchaId,
      fecha: datos.fecha,
      horaInicio: datos.horaInicio,
      horaFin: datos.horaFin,
      precioFinal: String(datos.precioFinal),
      estrategiaPrecio: datos.estrategiaPrecio,
      estado: EstadoResCancha.CONFIRMADA,
    };
    manager.staged.reservas.push(fila);
    return fila as unknown as ReservaCancha;
  }
}

// ───────────────────────── Armado ─────────────────────────
const SEDE_A = 'sedeA';
const recepcionista: UsuarioAutenticado = {
  id: 'rec1',
  tipoActor: TipoActor.RECEPCIONISTA,
  email: 'r@x.com',
  sedeId: SEDE_A,
};

function armar(opts?: {
  tipoCliente?: TipoActor;
  membresia?: EstadoMembresia | null;
  costo?: string;
  canchaEstado?: EstadoCancha;
  clienteActivo?: boolean;
  fallaComprobante?: boolean;
}) {
  const db = new BaseSimulada();
  const booking = new BookingSimulado(db);
  const cancha = {
    id: 'c1',
    estado: opts?.canchaEstado ?? EstadoCancha.ACTIVA,
    costoHoraBase: opts?.costo ?? '10000',
    sede: { id: SEDE_A, nombre: 'Sede A' },
  };
  booking.estados.set('c1', cancha.estado);
  const cliente = {
    id: 'cli1',
    tipoActor: opts?.tipoCliente ?? TipoActor.EXTERNO,
    activo: opts?.clienteActivo ?? true,
  };
  const usuariosRepo = {
    findOne: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === 'rec1'
          ? { id: 'rec1', tipoActor: TipoActor.RECEPCIONISTA }
          : where.id === 'cli1'
            ? cliente
            : null,
      ),
    ),
  };
  const canchasRepo = { findOne: jest.fn().mockResolvedValue(cancha) };
  const membresiasService = {
    obtenerMembresiaVigente: jest
      .fn()
      .mockResolvedValue(opts?.membresia ? { estado: opts.membresia } : null),
  };
  const reservasCancha = new ReservasCanchaService(
    canchasRepo as never,
    usuariosRepo as never,
    {} as never,
    booking,
    new PricingCalculatorService([
      new MemberDiscountPricing(),
      new PeakHourPricing(),
    ]),
    membresiasService as never,
    { find: jest.fn().mockResolvedValue([]) } as never,
  );
  const comprobantes = {
    generar: jest.fn((pago: Record<string, unknown>, manager: ManagerFalso) => {
      if (opts?.fallaComprobante) {
        return Promise.reject(new Error('fallo al generar el comprobante'));
      }
      const c = {
        id: db.siguienteId('comprobantes'),
        pdfPath: 'https://storage/comprobante.pdf',
        generadoEn: new Date(),
        pagoId: pago.id,
      };
      manager.staged.comprobantes.push(c);
      return Promise.resolve(c);
    }),
  };
  const service = new PagosService(
    {} as never,
    usuariosRepo as never,
    {} as never,
    {} as never,
    {} as never,
    comprobantes as never,
    {} as never,
    {} as never,
    db as never,
    { registrar: jest.fn() } as never,
    reservasCancha,
  );
  return { service, db, booking, comprobantes, reservasCancha, canchasRepo };
}

const dto = (horaInicio = '10:00', horaFin = '11:00') => ({
  usuarioId: 'cli1',
  canchaId: 'c1',
  fecha: FECHA,
  horaInicio,
  horaFin,
});

describe('Cobro presencial de cancha', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: AHORA });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('crea la reserva y el pago en una operación y devuelve el comprobante', async () => {
    const { service, db } = armar();
    const pago = await service.cobrarCanchaPresencial(dto(), recepcionista);

    expect(db.committed.reservas).toHaveLength(1);
    expect(db.committed.pagos).toHaveLength(1);
    expect(db.committed.comprobantes).toHaveLength(1);
    expect(pago.metodo).toBe(MetodoPago.EFECTIVO);
    expect(pago.estado).toBe(EstadoPago.APROBADO);
    expect(pago.registradoPor).toMatchObject({ id: 'rec1' });
    expect(pago.reservaCancha).toBe(db.committed.reservas[0]);
    expect(pago.comprobante).toMatchObject({
      pdfPath: 'https://storage/comprobante.pdf',
    });
  });

  it('el precio lo calcula el servidor: ignora un monto enviado por el cliente', async () => {
    const { service } = armar({ costo: '10000' });
    const conMontoTruchado = { ...dto(), monto: 1, precioFinal: 1 };
    const pago = await service.cobrarCanchaPresencial(
      conMontoTruchado,
      recepcionista,
    );
    expect(pago.monto).toBe('10000');
    // y el DTO validado ni siquiera conoce un campo de monto
    expect(Object.keys(new CobrarCanchaPresencialDto())).not.toContain('monto');
  });

  it('descuento de socio activo (15%)', async () => {
    const { service, db } = armar({
      tipoCliente: TipoActor.SOCIO,
      membresia: EstadoMembresia.ACTIVO,
    });
    const pago = await service.cobrarCanchaPresencial(dto(), recepcionista);
    expect(pago.monto).toBe('8500');
    expect(db.committed.reservas[0].estrategiaPrecio).toBe(
      TipoEstrategiaPrecio.SOCIO_DESCUENTO,
    );
  });

  it('recargo de hora pico (19:00) para un externo', async () => {
    const { service, db } = armar();
    const pago = await service.cobrarCanchaPresencial(
      dto('19:00', '20:00'),
      recepcionista,
    );
    expect(pago.monto).toBe('11500');
    expect(db.committed.reservas[0].estrategiaPrecio).toBe(
      TipoEstrategiaPrecio.HORA_PICO,
    );
  });

  it('socio activo en hora pico: descuento y recargo', async () => {
    const { service } = armar({
      tipoCliente: TipoActor.SOCIO,
      membresia: EstadoMembresia.ACTIVO,
    });
    const pago = await service.cobrarCanchaPresencial(
      dto('19:00', '20:00'),
      recepcionista,
    );
    expect(pago.monto).toBe('9775');
  });

  it.each([EstadoMembresia.VENCIDO, EstadoMembresia.SUSPENDIDO])(
    'socio con cuota %s paga la tarifa de externo, sin descuento',
    async (estado) => {
      const { service, db } = armar({
        tipoCliente: TipoActor.SOCIO,
        membresia: estado,
      });
      const pago = await service.cobrarCanchaPresencial(dto(), recepcionista);
      expect(pago.monto).toBe('10000');
      expect(db.committed.reservas[0].estrategiaPrecio).toBe(
        TipoEstrategiaPrecio.ESTANDAR,
      );
    },
  );

  describe('atomicidad: si algo falla, no queda nada guardado', () => {
    const vacio = (db: BaseSimulada) =>
      expect(db.committed).toEqual({
        reservas: [],
        pagos: [],
        comprobantes: [],
      });

    it('horario ocupado', async () => {
      const { service, db } = armar();
      await service.cobrarCanchaPresencial(dto(), recepcionista);
      const antes = JSON.stringify(db.committed);
      await expect(
        service.cobrarCanchaPresencial(dto(), recepcionista),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(JSON.stringify(db.committed)).toBe(antes);
    });

    it('cancha en mantenimiento', async () => {
      const { service, db } = armar({
        canchaEstado: EstadoCancha.MANTENIMIENTO,
      });
      await expect(
        service.cobrarCanchaPresencial(dto(), recepcionista),
      ).rejects.toThrow('mantenimiento');
      vacio(db);
    });

    it('franja bloqueada por mantenimiento (la detecta el repositorio, ya bajo lock)', async () => {
      const { service, db, booking } = armar();
      booking.bloqueos.push({ canchaId: 'c1', hora: '10:00' });
      await expect(
        service.cobrarCanchaPresencial(dto(), recepcionista),
      ).rejects.toThrow('bloqueo por mantenimiento');
      vacio(db);
    });

    it('falla al registrar el pago: la reserva ya insertada se descarta', async () => {
      const { service, db } = armar();
      db.fallarAlGuardarPago = true;
      await expect(
        service.cobrarCanchaPresencial(dto(), recepcionista),
      ).rejects.toThrow('fallo al guardar el pago');
      vacio(db);
    });

    it('falla el comprobante: se descartan reserva y pago', async () => {
      const { service, db } = armar({ fallaComprobante: true });
      await expect(
        service.cobrarCanchaPresencial(dto(), recepcionista),
      ).rejects.toThrow('fallo al generar el comprobante');
      vacio(db);
    });
  });

  it('concurrencia (SIMULADA, no contra base real): dos cobros del mismo turno, uno solo gana', async () => {
    const { service, db } = armar();
    const resultados = await Promise.allSettled([
      service.cobrarCanchaPresencial(dto(), recepcionista),
      service.cobrarCanchaPresencial(dto(), recepcionista),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazado = resultados.find((r) => r.status === 'rejected');
    expect((rechazado as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictException,
    );
    expect(db.committed.reservas).toHaveLength(1);
    expect(db.committed.pagos).toHaveLength(1);
  });

  describe('validaciones y alcance por sede', () => {
    it('Recepcionista de otra sede: 403', async () => {
      const { service, db } = armar();
      await expect(
        service.cobrarCanchaPresencial(dto(), {
          ...recepcionista,
          sedeId: 'sedeB',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.committed.reservas).toHaveLength(0);
    });

    it('Recepcionista sin sede: 403 (fail-closed)', async () => {
      const { service } = armar();
      await expect(
        service.cobrarCanchaPresencial(dto(), {
          ...recepcionista,
          sedeId: null,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cliente inactivo: 400', async () => {
      const { service } = armar({ clienteActivo: false });
      await expect(
        service.cobrarCanchaPresencial(dto(), recepcionista),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cliente que no es Socio ni Externo: 400', async () => {
      const { service } = armar({ tipoCliente: TipoActor.RECEPCIONISTA });
      await expect(
        service.cobrarCanchaPresencial(dto(), recepcionista),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
      ['07:00', '08:00'],
      ['10:30', '11:30'],
      ['10:00', '12:00'],
      ['23:00', '24:00'],
    ])('turno inválido %s-%s: 400', async (ini, fin) => {
      const { service } = armar();
      await expect(
        service.cobrarCanchaPresencial(dto(ini, fin), recepcionista),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('turno que ya comenzó (hora de Argentina): 400', async () => {
      const { service } = armar();
      await expect(
        service.cobrarCanchaPresencial(
          { ...dto('14:00', '15:00'), fecha: '2026-10-09' },
          recepcionista,
        ),
      ).rejects.toThrow('ya comenzó');
    });
  });
});

describe('Cobro presencial: permisos por rol', () => {
  const guard = new RolesGuard(new Reflector());
  const ctx = (tipoActor: TipoActor) =>
    ({
      getHandler: () =>
        (PagosController.prototype as unknown as Record<string, () => unknown>)[
          'cobrarCanchaPresencial'
        ],
      getClass: () => PagosController,
      switchToHttp: () => ({ getRequest: () => ({ user: { tipoActor } }) }),
    }) as unknown as ExecutionContext;

  it.each([
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
    TipoActor.SOCIO,
    TipoActor.EXTERNO,
  ])('%s recibe 403', (rol) => {
    expect(() => guard.canActivate(ctx(rol))).toThrow(ForbiddenException);
  });

  it('RECEPCIONISTA pasa el guard', () => {
    expect(guard.canActivate(ctx(TipoActor.RECEPCIONISTA))).toBe(true);
  });

  it('el DTO valida formatos', async () => {
    const malo = plainToInstance(CobrarCanchaPresencialDto, {
      usuarioId: 'x',
      canchaId: 'y',
      fecha: '10/10/2026',
      horaInicio: '9',
      horaFin: '10',
    });
    expect((await validate(malo)).length).toBe(5);
  });
});

describe('Mantenimiento: las reservas (online y presencial) se rechazan sin tocar las previas', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: AHORA });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reserva online sobre cancha en mantenimiento: 400', async () => {
    const { reservasCancha, db } = armar({
      canchaEstado: EstadoCancha.MANTENIMIENTO,
    });
    db.committed.reservas.push({ id: 'previa' });
    const socio: UsuarioAutenticado = {
      id: 'cli1',
      tipoActor: TipoActor.EXTERNO,
      email: 'c@x.com',
      sedeId: null,
    };
    await expect(
      reservasCancha.reservar({ ...dto(), fecha: FECHA }, socio),
    ).rejects.toThrow('mantenimiento');
    await expect(
      reservasCancha.cotizar({ ...dto(), fecha: FECHA }, socio),
    ).rejects.toThrow('mantenimiento');
    expect(db.committed.reservas).toEqual([{ id: 'previa' }]);
  });

  describe('repositorio real (con manager simulado)', () => {
    function managerConResultados(opts: {
      cancha: { estado: EstadoCancha } | null;
      bloqueo?: unknown;
      existente?: unknown;
    }) {
      const resultados = [
        opts.cancha,
        opts.bloqueo ?? null,
        opts.existente ?? null,
      ];
      let i = 0;
      const qb = {
        setLock: () => qb,
        where: () => qb,
        andWhere: () => qb,
        getOne: () => Promise.resolve(resultados[i++]),
      };
      return {
        createQueryBuilder: jest.fn(() => qb),
        create: jest.fn((_e: unknown, x: unknown) => x),
        save: jest.fn((x: unknown) => Promise.resolve(x)),
      };
    }
    const datos = {
      canchaId: 'c1',
      usuario: {} as never,
      fecha: FECHA,
      horaInicio: '10:00',
      horaFin: '11:00',
      precioFinal: 1,
      estrategiaPrecio: TipoEstrategiaPrecio.ESTANDAR,
    };

    it('cancha en mantenimiento: rechaza y no inserta', async () => {
      const manager = managerConResultados({
        cancha: { estado: EstadoCancha.MANTENIMIENTO },
      });
      const transaction = jest.fn();
      const repo = new TypeOrmBookingCanchaRepository({ transaction } as never);
      await expect(
        repo.crearReservaSegura(datos, manager as never),
      ).rejects.toThrow('mantenimiento');
      expect(manager.save).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled(); // usó la transacción de afuera
    });

    it('franja bloqueada: rechaza y no inserta', async () => {
      const manager = managerConResultados({
        cancha: { estado: EstadoCancha.ACTIVA },
        bloqueo: { id: 'b1' },
      });
      const repo = new TypeOrmBookingCanchaRepository({} as never);
      await expect(
        repo.crearReservaSegura(datos, manager as never),
      ).rejects.toThrow('bloqueo por mantenimiento');
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('sin manager externo abre su propia transacción', async () => {
      const manager = managerConResultados({
        cancha: { estado: EstadoCancha.ACTIVA },
      });
      const transaction = jest.fn((cb: (m: unknown) => unknown) => cb(manager));
      const repo = new TypeOrmBookingCanchaRepository({ transaction } as never);
      await repo.crearReservaSegura(datos);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(manager.save).toHaveBeenCalledTimes(1);
    });
  });
});
