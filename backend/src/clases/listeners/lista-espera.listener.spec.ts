import { EstadoOcurrenciaClase, EstadoResClase } from '../../entities/enums';
import {
  CanalNotificacion,
  TipoNotificacion,
} from '../../notificaciones/notificaciones.types';
import { ListaEsperaListener } from './lista-espera.listener';

interface Opciones {
  capacidad?: number;
  ocupados?: number;
  enEspera?: number;
  fallaNotificar?: boolean;
  estado?: EstadoOcurrenciaClase;
}

function armar(opts: Opciones = {}) {
  const ocurrencia = {
    id: 'o1',
    estado: opts.estado ?? EstadoOcurrenciaClase.PROGRAMADA,
    fecha: '2026-10-20',
    horaInicio: '18:00:00',
    clase: { tipoClase: 'Yoga', capacidad: opts.capacidad ?? 10, activa: true },
  };
  const mkReserva = (n: number) => ({
    id: `r${n}`,
    estado: EstadoResClase.LISTA_ESPERA,
    notificado: false,
    usuario: {
      id: `u${n}`,
      nombre: 'Ana',
      email: 'a@x.com',
      emailVerificado: true,
    },
  });
  const espera = Array.from({ length: opts.enEspera ?? 1 }, (_, i) =>
    mkReserva(i + 1),
  );
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['setLock', 'leftJoinAndSelect', 'where'])
    qb[m] = jest.fn(() => qb);
  qb.getOne = jest.fn().mockResolvedValue(ocurrencia);
  const manager = {
    createQueryBuilder: jest.fn(() => qb),
    count: jest.fn().mockResolvedValue(opts.ocupados ?? 9),
    findOne: jest.fn().mockResolvedValue(espera[0] ?? null),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const notificaciones = {
    notificarUsuario: jest.fn(() =>
      opts.fallaNotificar
        ? Promise.reject(new Error('mail caído'))
        : Promise.resolve({}),
    ),
  };
  const listener = new ListaEsperaListener(
    dataSource as never,
    notificaciones as never,
  );
  return { listener, espera, manager, qb, dataSource, notificaciones };
}

describe('ListaEsperaListener', () => {
  it('promueve al siguiente, marca notificado y lo avisa por panel y mail después del commit', async () => {
    const { listener, espera, manager, notificaciones, dataSource } = armar();
    await listener.promoverSiguienteEnEspera({ ocurrenciaId: 'o1' });

    expect(espera[0].estado).toBe(EstadoResClase.RESERVADA);
    expect(espera[0].notificado).toBe(true);
    expect(manager.save).toHaveBeenCalledWith(espera[0]);
    expect(notificaciones.notificarUsuario).toHaveBeenCalledWith(
      espera[0].usuario,
      expect.objectContaining({
        tipo: TipoNotificacion.LISTA_ESPERA_PROMOVIDA,
        mensaje: expect.stringContaining('Yoga') as unknown,
      }),
      [
        CanalNotificacion.PANEL,
        CanalNotificacion.EMAIL,
        CanalNotificacion.PUSH,
      ],
    );
    // la notificación sale una vez terminada la transacción
    expect(dataSource.transaction.mock.invocationCallOrder[0]).toBeLessThan(
      notificaciones.notificarUsuario.mock.invocationCallOrder[0],
    );
  });

  it('bloquea la fila de la ocurrencia (FOR UPDATE OF oc) y recuenta el cupo', async () => {
    const { listener, qb, manager } = armar();
    await listener.promoverSiguienteEnEspera({ ocurrenciaId: 'o1' });
    expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write', undefined, [
      'oc',
    ]);
    expect(manager.count).toHaveBeenCalledTimes(1);
  });

  it('si no queda lugar (otra reserva lo ocupó) NO promueve ni notifica', async () => {
    const { listener, espera, manager, notificaciones } = armar({
      capacidad: 10,
      ocupados: 10,
    });
    await listener.promoverSiguienteEnEspera({ ocurrenciaId: 'o1' });
    expect(espera[0].estado).toBe(EstadoResClase.LISTA_ESPERA);
    expect(manager.save).not.toHaveBeenCalled();
    expect(notificaciones.notificarUsuario).not.toHaveBeenCalled();
  });

  it('no promueve en una ocurrencia cancelada', async () => {
    const { listener, manager } = armar({
      estado: EstadoOcurrenciaClase.CANCELADA,
    });
    await listener.promoverSiguienteEnEspera({ ocurrenciaId: 'o1' });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('si nadie espera no promueve ni notifica', async () => {
    const { listener, manager, notificaciones } = armar({ enEspera: 0 });
    await listener.promoverSiguienteEnEspera({ ocurrenciaId: 'o1' });
    expect(manager.save).not.toHaveBeenCalled();
    expect(notificaciones.notificarUsuario).not.toHaveBeenCalled();
  });

  it('un fallo al notificar no revierte ni impide la promoción', async () => {
    const { listener, espera, manager } = armar({ fallaNotificar: true });
    await expect(
      listener.promoverSiguienteEnEspera({ ocurrenciaId: 'o1' }),
    ).resolves.toBeUndefined();
    expect(espera[0].estado).toBe(EstadoResClase.RESERVADA);
    expect(manager.save).toHaveBeenCalledTimes(1);
  });

  it('toma al que se anotó primero a la espera', async () => {
    const { listener, manager } = armar();
    await listener.promoverSiguienteEnEspera({ ocurrenciaId: 'o1' });
    expect(manager.findOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ order: { creadaEn: 'ASC' } }),
    );
  });
});

// Simulación de la carrera cancelación / reserva nueva. NO es una base real:
// una cola hace de lock de la fila de la ocurrencia.
describe('Carrera entre promoción y reserva nueva (simulada)', () => {
  it('con un solo lugar libre, solo uno de los dos entra: no hay sobreventa', async () => {
    const capacidad = 2;
    let ocupados = 1; // un lugar libre
    let cola: Promise<void> = Promise.resolve();
    const enEspera = [
      {
        id: 'r1',
        estado: EstadoResClase.LISTA_ESPERA,
        notificado: false,
        usuario: { id: 'u1' },
      },
    ];

    // transacción con lock: serializa a todos los que la usan
    const conLock = async <T>(cb: () => Promise<T>): Promise<T> => {
      const previa = cola;
      let liberar!: () => void;
      cola = new Promise<void>((r) => (liberar = r));
      await previa;
      try {
        return await cb();
      } finally {
        liberar();
      }
    };

    const qb: Record<string, jest.Mock> = {};
    for (const m of ['setLock', 'leftJoinAndSelect', 'where'])
      qb[m] = jest.fn(() => qb);
    qb.getOne = jest.fn().mockResolvedValue({
      id: 'o1',
      estado: EstadoOcurrenciaClase.PROGRAMADA,
      fecha: '2026-10-20',
      horaInicio: '18:00:00',
      clase: { tipoClase: 'Yoga', capacidad, activa: true },
    });
    const manager = {
      createQueryBuilder: () => qb,
      count: jest.fn(async () => {
        const visto = ocupados;
        await Promise.resolve(); // cede el turno: sin lock se pisarían
        return visto;
      }),
      findOne: jest.fn().mockResolvedValue(enEspera[0]),
      save: jest.fn(async (x: unknown) => {
        ocupados += 1;
        return x;
      }),
    };
    const listener = new ListaEsperaListener(
      {
        transaction: (cb: (m: typeof manager) => Promise<unknown>) =>
          conLock(() => cb(manager)),
      } as never,
      { notificarUsuario: jest.fn().mockResolvedValue({}) } as never,
    );

    // la "reserva nueva" usa el mismo lock y la misma regla de cupo
    const reservaNueva = conLock(async () => {
      const visto = await manager.count();
      if (visto < capacidad) ocupados += 1;
    });
    await Promise.all([
      listener.promoverSiguienteEnEspera({ ocurrenciaId: 'o1' }),
      reservaNueva,
    ]);
    expect(ocupados).toBeLessThanOrEqual(capacidad);
    expect(ocupados).toBe(2);
  });
});
