import { BadRequestException } from '@nestjs/common';
import { EstadoCancha, EstadoResCancha, TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { CanchasService } from './canchas.service';

// "Ahora" fijo: 2026-10-09 15:00 en Argentina (= 18:00 UTC).
const AHORA = new Date('2026-10-09T18:00:00Z');

const gg: UsuarioAutenticado = {
  id: 'g1',
  tipoActor: TipoActor.GERENTE_GENERAL,
  email: 'g@x.com',
  sedeId: null,
};

interface Fila {
  fecha: string;
  horaFin: string;
  estado?: EstadoResCancha;
}

function armar(reservas: Fila[], historial = reservas.length) {
  const cancha = {
    id: 'c1',
    estado: EstadoCancha.ACTIVA,
    sede: { id: 'sedeA' },
  };
  const canchasRepo = {
    findOne: jest.fn().mockResolvedValue(cancha),
    save: jest.fn((c: unknown) => Promise.resolve(c)),
  };
  // El repo real filtra por estado CONFIRMADA y fecha >= hoy; el mock devuelve
  // solo las confirmadas para no replicar SQL, y el servicio aplica el corte
  // exacto por hora de fin (que es lo que se prueba).
  const reservasRepo = {
    find: jest.fn(() =>
      Promise.resolve(
        reservas.filter(
          (r) =>
            (r.estado ?? EstadoResCancha.CONFIRMADA) ===
            EstadoResCancha.CONFIRMADA,
        ),
      ),
    ),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const manager = {
    findOne: jest.fn().mockResolvedValue(cancha),
    count: jest.fn().mockResolvedValue(historial),
    getRepository: jest.fn().mockReturnValue(reservasRepo),
    delete: jest.fn(),
    remove: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((fn: (m: unknown) => Promise<void>) => fn(manager)),
  };
  const service = new CanchasService(
    canchasRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    reservasRepo as never,
    dataSource as never,
  );
  return { service, reservasRepo, canchasRepo, manager };
}

describe('CanchasService (mantenimiento y eliminación, hora Argentina)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: AHORA });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('reservasFuturasActivas', () => {
    it('una reserva pasada (día 7) no cuenta', async () => {
      const { service } = armar([{ fecha: '2026-10-07', horaFin: '11:00:00' }]);
      expect((await service.reservasFuturasActivas('c1')).cantidad).toBe(0);
    });

    it('una reserva de hoy ya terminada no cuenta', async () => {
      const { service } = armar([{ fecha: '2026-10-09', horaFin: '14:00:00' }]);
      expect((await service.reservasFuturasActivas('c1')).cantidad).toBe(0);
    });

    it('una reserva de hoy en curso cuenta', async () => {
      const { service } = armar([{ fecha: '2026-10-09', horaFin: '16:00:00' }]);
      expect((await service.reservasFuturasActivas('c1')).cantidad).toBe(1);
    });

    it('una reserva futura cuenta, con fechas únicas y ordenadas', async () => {
      const { service } = armar([
        { fecha: '2026-10-12', horaFin: '10:00:00' },
        { fecha: '2026-10-10', horaFin: '10:00:00' },
        { fecha: '2026-10-10', horaFin: '12:00:00' },
      ]);
      const r = await service.reservasFuturasActivas('c1');
      expect(r.cantidad).toBe(3);
      expect(r.fechas).toEqual(['2026-10-10', '2026-10-12']);
    });

    it('una reserva cancelada no cuenta aunque sea futura', async () => {
      const { service } = armar([
        {
          fecha: '2026-10-20',
          horaFin: '10:00:00',
          estado: EstadoResCancha.CANCELADA,
        },
      ]);
      expect((await service.reservasFuturasActivas('c1')).cantidad).toBe(0);
    });

    it('compara en hora de Argentina, no en UTC (21:30 AR ya es el día siguiente en UTC)', async () => {
      jest.setSystemTime(new Date('2026-10-10T00:30:00Z')); // 21:30 del 9 en AR
      const { service } = armar([
        { fecha: '2026-10-09', horaFin: '22:00:00' }, // sigue vigente en AR
        { fecha: '2026-10-09', horaFin: '21:00:00' }, // ya terminó en AR
      ]);
      expect((await service.reservasFuturasActivas('c1')).cantidad).toBe(1);
    });
  });

  describe('update a MANTENIMIENTO', () => {
    it('no bloquea y avisa cuántas reservas futuras siguen vigentes, sin modificarlas', async () => {
      const { service, reservasRepo, canchasRepo } = armar([
        { fecha: '2026-10-10', horaFin: '10:00:00' },
        { fecha: '2026-10-07', horaFin: '10:00:00' },
      ]);
      const r = await service.update(
        'c1',
        { estado: EstadoCancha.MANTENIMIENTO },
        gg,
      );
      expect(canchasRepo.save).toHaveBeenCalled();
      expect(r.estado).toBe(EstadoCancha.MANTENIMIENTO);
      expect(r.aviso?.cantidad).toBe(1);
      expect(r.aviso?.mensaje).toContain('10/10');
      expect(reservasRepo.save).not.toHaveBeenCalled();
      expect(reservasRepo.update).not.toHaveBeenCalled();
      expect(reservasRepo.delete).not.toHaveBeenCalled();
    });

    it('sin reservas futuras no hay aviso', async () => {
      const { service } = armar([{ fecha: '2026-10-07', horaFin: '10:00:00' }]);
      const r = await service.update(
        'c1',
        { estado: EstadoCancha.MANTENIMIENTO },
        gg,
      );
      expect(r.aviso).toBeUndefined();
    });

    it('otros cambios (p. ej. nombre) no generan aviso', async () => {
      const { service, reservasRepo } = armar([
        { fecha: '2026-10-10', horaFin: '10:00:00' },
      ]);
      const r = await service.update('c1', { nombre: 'Nueva' }, gg);
      expect(r.aviso).toBeUndefined();
      expect(reservasRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('con reservas futuras confirmadas dice cuántas y de qué fechas', async () => {
      const { service, manager } = armar(
        [{ fecha: '2026-10-11', horaFin: '10:00:00' }],
        3,
      );
      const err = await service.eliminar('c1', gg).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      const msg = (err as BadRequestException).message;
      expect(msg).toContain('1 reserva(s) confirmada(s) por cumplirse');
      expect(msg).toContain('11/10');
      expect(manager.remove).not.toHaveBeenCalled();
    });

    it('con solo historial (pasadas/canceladas) aclara que no hay nada por cumplirse', async () => {
      const { service, manager } = armar(
        [{ fecha: '2026-10-07', horaFin: '10:00:00' }],
        4,
      );
      const err = await service.eliminar('c1', gg).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      const msg = (err as BadRequestException).message;
      expect(msg).toContain('no tiene reservas por cumplirse');
      expect(msg).toContain('4 reserva(s) en su historial');
      expect(manager.remove).not.toHaveBeenCalled();
    });

    it('sin reservas la elimina', async () => {
      const { service, manager } = armar([], 0);
      await service.eliminar('c1', gg);
      expect(manager.remove).toHaveBeenCalled();
    });
  });
});

describe('CanchasService.findAll: canchas reservables', () => {
  function servicio() {
    const canchasRepo = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
    const service = new CanchasService(
      canchasRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, canchasRepo };
  }
  const usuario = (tipoActor: TipoActor): UsuarioAutenticado => ({
    id: 'u',
    tipoActor,
    email: 'u@x.com',
    sedeId: null,
  });

  it.each([TipoActor.SOCIO, TipoActor.EXTERNO])(
    '%s solo recibe canchas ACTIVAS',
    async (rol) => {
      const { service, canchasRepo } = servicio();
      await service.findAll({}, usuario(rol));
      expect(canchasRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { estado: EstadoCancha.ACTIVA } }),
      );
    },
  );

  it.each([TipoActor.GERENTE_GENERAL, TipoActor.RECEPCIONISTA])(
    '%s sigue viendo todas (gestión)',
    async (rol) => {
      const { service, canchasRepo } = servicio();
      await service.findAll({}, usuario(rol));
      expect(canchasRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    },
  );
});
