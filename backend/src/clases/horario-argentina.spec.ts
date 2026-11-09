import { BadRequestException } from '@nestjs/common';
import { EstadoResClase, TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { GeneracionOcurrenciasService } from './generacion-ocurrencias.service';
import { ReservasClaseService } from './reserva-clase.service';

// Las fechas/horas de las clases son de pared en Argentina (UTC-3). El servidor
// corre en UTC: estos tests usan horas cercanas a medianoche, donde el huso del
// servidor y el de Argentina caen en días distintos, y deben dar lo mismo con
// cualquier huso del proceso (correr también con TZ=UTC).
afterEach(() => jest.useRealTimers());

const congelar = (iso: string) => jest.useFakeTimers({ now: new Date(iso) });

describe('GeneracionOcurrenciasService: hora Argentina', () => {
  function armar(
    horarios: { diaSemana: number; horaInicio: string; horaFin: string }[],
  ) {
    const guardadas: Array<{ fecha: string; horaInicio: string }> = [];
    const clasesRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'c1', horariosSemanales: horarios }),
    };
    const ocurrenciasRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x: object) => x),
      save: jest.fn((x: { fecha: string; horaInicio: string }) => {
        guardadas.push(x);
        return Promise.resolve(x);
      }),
    };
    const service = new GeneracionOcurrenciasService(
      clasesRepo as never,
      ocurrenciasRepo as never,
    );
    return { service, guardadas };
  }

  // Viernes 2026-10-09 23:30 en Argentina = sábado 2026-10-10 02:30 UTC.
  const VIERNES_2330_AR = '2026-10-10T02:30:00Z';

  it('a las 23:30 AR de un viernes, "hoy" sigue siendo viernes (no el sábado UTC)', async () => {
    congelar(VIERNES_2330_AR);
    // Viernes (5) 23:45: todavía no empezó en Argentina.
    const { service, guardadas } = armar([
      { diaSemana: 5, horaInicio: '23:45:00', horaFin: '23:59:00' },
    ]);
    const nuevas = await service.generarParaClase('c1', 1);
    expect(nuevas).toBe(1);
    expect(guardadas).toEqual([
      expect.objectContaining({ fecha: '2026-10-09', horaInicio: '23:45:00' }),
    ]);
  });

  it('no genera la franja del viernes que ya empezó en Argentina', async () => {
    congelar(VIERNES_2330_AR);
    // Viernes 22:00 ya pasó (son las 23:30 AR): en una ventana de 1 semana
    // (viernes 9 a jueves 15) no queda ningún viernes más.
    const { service, guardadas } = armar([
      { diaSemana: 5, horaInicio: '22:00:00', horaFin: '23:00:00' },
    ]);
    expect(await service.generarParaClase('c1', 1)).toBe(0);
    expect(guardadas).toEqual([]);
  });

  it('una clase de sábado 00:15 cae el sábado 10 (la fecha no se corre por UTC)', async () => {
    congelar(VIERNES_2330_AR);
    const { service, guardadas } = armar([
      { diaSemana: 6, horaInicio: '00:15:00', horaFin: '01:00:00' },
    ]);
    await service.generarParaClase('c1', 1);
    expect(guardadas).toEqual([
      expect.objectContaining({ fecha: '2026-10-10', horaInicio: '00:15:00' }),
    ]);
  });

  it('a las 00:30 AR de un sábado (03:30 UTC) la clase de las 00:15 ya empezó: va la del sábado siguiente', async () => {
    congelar('2026-10-10T03:30:00Z');
    const { service, guardadas } = armar([
      { diaSemana: 6, horaInicio: '00:15:00', horaFin: '01:00:00' },
    ]);
    await service.generarParaClase('c1', 2);
    expect(guardadas.map((g) => g.fecha)).toEqual(['2026-10-17']);
  });

  it('cada fecha generada cae en el día de la semana de su grilla', async () => {
    congelar(VIERNES_2330_AR);
    const { service, guardadas } = armar([
      { diaSemana: 1, horaInicio: '07:00:00', horaFin: '08:00:00' },
    ]);
    await service.generarParaClase('c1', 3);
    expect(guardadas.map((g) => g.fecha)).toEqual([
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
  });
});

describe('ReservasClaseService: límites de reserva/cancelación en hora Argentina', () => {
  const dueno = { id: 'u1', tipoActor: TipoActor.SOCIO } as UsuarioAutenticado;
  const gg = { id: 'gg', tipoActor: TipoActor.GERENTE_GENERAL } as UsuarioAutenticado;

  function armar(opts: {
    fecha: string;
    horaInicio: string;
    reserva?: unknown;
  }) {
    const ocurrencia = {
      id: 'o1',
      estado: 'PROGRAMADA',
      fecha: opts.fecha,
      horaInicio: opts.horaInicio,
      clase: { activa: true, sede: { id: 's1' } },
    };
    const reservasRepo = {
      findOne: jest.fn().mockResolvedValue(opts.reserva ?? null),
      save: jest.fn((x: object) => Promise.resolve(x)),
    };
    const bookingRepo = {
      reservarSegura: jest.fn().mockResolvedValue({ id: 'nueva' }),
    };
    const service = new ReservasClaseService(
      reservasRepo as never,
      { findOne: jest.fn().mockResolvedValue(ocurrencia) } as never,
      {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'u1', tipoActor: TipoActor.SOCIO }),
      } as never,
      {
        find: jest.fn().mockResolvedValue([
          { estado: 'ACTIVO', fechaInicio: '2020-01-01', fechaFin: '2999-12-31' },
        ]),
      } as never,
      bookingRepo as never,
      { emit: jest.fn() } as never,
    );
    return { service, bookingRepo, reservasRepo };
  }

  describe('el staff anota a otro hasta 30 min antes', () => {
    // Clase: sábado 2026-10-10 00:10 en Argentina.
    it('23:30 AR (40 min antes): se puede, aunque en UTC "ya pasó"', async () => {
      congelar('2026-10-10T02:30:00Z'); // 23:30 AR del viernes
      const { service, bookingRepo } = armar({
        fecha: '2026-10-10',
        horaInicio: '00:10:00',
      });
      await service.reservar('o1', 'u1', gg);
      expect(bookingRepo.reservarSegura).toHaveBeenCalledTimes(1);
    });

    it('23:50 AR (20 min antes): se rechaza', async () => {
      congelar('2026-10-10T02:50:00Z'); // 23:50 AR del viernes
      const { service, bookingRepo } = armar({
        fecha: '2026-10-10',
        horaInicio: '00:10:00',
      });
      await expect(service.reservar('o1', 'u1', gg)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(bookingRepo.reservarSegura).not.toHaveBeenCalled();
    });
  });

  it('el socio reserva solo con 48 h: clase del lunes 00:10 AR, jueves 00:20 AR sí / jueves 23:00 AR no', async () => {
    // Lunes 2026-10-12 00:10 AR. Jueves 08/10 00:20 AR = 03:20 UTC → 71h50.
    congelar('2026-10-08T03:20:00Z');
    const a = armar({ fecha: '2026-10-12', horaInicio: '00:10:00' });
    await a.service.reservar('o1', 'u1', dueno);
    expect(a.bookingRepo.reservarSegura).toHaveBeenCalledTimes(1);

    // Sábado 10/10 23:00 AR = domingo 02:00 UTC → 25h10 antes: no alcanza.
    congelar('2026-10-11T02:00:00Z');
    const b = armar({ fecha: '2026-10-12', horaInicio: '00:10:00' });
    await expect(b.service.reservar('o1', 'u1', dueno)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  describe('cancelar hasta 2 h antes', () => {
    const reserva = {
      id: 'r1',
      estado: EstadoResClase.RESERVADA,
      usuario: { id: 'u1' },
      ocurrencia: {
        id: 'o1',
        fecha: '2026-10-10',
        horaInicio: '01:00:00',
        clase: { sede: { id: 's1' } },
      },
    };

    it('22:30 AR del viernes (2,5 h antes de la 01:00): se puede cancelar', async () => {
      congelar('2026-10-10T01:30:00Z'); // 22:30 AR
      const { service, reservasRepo } = armar({
        fecha: '2026-10-10',
        horaInicio: '01:00:00',
        reserva: { ...reserva },
      });
      const r = await service.cancelar('r1', dueno);
      expect(r.estado).toBe(EstadoResClase.CANCELADA);
      expect(reservasRepo.save).toHaveBeenCalledTimes(1);
    });

    it('23:30 AR del viernes (1,5 h antes): se rechaza', async () => {
      congelar('2026-10-10T02:30:00Z'); // 23:30 AR
      const { service, reservasRepo } = armar({
        fecha: '2026-10-10',
        horaInicio: '01:00:00',
        reserva: { ...reserva },
      });
      await expect(service.cancelar('r1', dueno)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(reservasRepo.save).not.toHaveBeenCalled();
    });
  });
});
