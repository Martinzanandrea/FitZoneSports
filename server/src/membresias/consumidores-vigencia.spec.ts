import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { EstadoMembresia, TipoActor, TipoPlan } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { AccesoService } from '../acceso/acceso.service';
import { ReservasClaseService } from '../clases/reserva-clase.service';
import { ReservasCanchaService } from '../canchas/reserva-cancha.service';
import { PricingCalculatorService } from '../canchas/pricing/pricing-calculator.service';
import { MemberDiscountPricing } from '../canchas/pricing/member-discount-pricing.strategy';
import { PeakHourPricing } from '../canchas/pricing/peak-hour-pricing.strategy';
import { AdminService } from '../admin/admin.service';
import { ClientesService } from '../clientes/clientes.service';
import { ClientesQueryDto } from '../clientes/dto/clientes-query.dto';
import { MembresiasService } from './membresias.service';
import { hoyArgentina } from './vigencia';

// Cada consumidor migrado se prueba con UNA VIGENTE + UNA PRÓXIMA (más filas
// vencida/suspendida/ACTIVO-terminada que antes engañaban al "primer ACTIVO").
// Fechas relativas a hoy (hora argentina) para no depender del día de corrida.
function dia(offset: number): string {
  const [a, m, d] = hoyArgentina().split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + offset)).toISOString().split('T')[0];
}

const row = (
  estado: EstadoMembresia,
  ini: number,
  fin: number,
  extra: object = {},
) => ({
  id: `${estado}-${ini}`,
  estado,
  plan: TipoPlan.MENSUAL,
  fechaInicio: dia(ini),
  fechaFin: dia(fin),
  sedeAlta: { id: 's1', nombre: 'Centro' },
  usuario: { id: 'u1', nombre: 'Ana', apellido: 'Paz', dni: '1' },
  ...extra,
});

const vigente = row(EstadoMembresia.ACTIVO, -5, 25);
const proxima = row(EstadoMembresia.ACTIVO, 25, 55);
const vencida = row(EstadoMembresia.VENCIDO, -90, -60);
const suspendida = row(EstadoMembresia.SUSPENDIDO, -30, 30);
const activaTerminada = row(EstadoMembresia.ACTIVO, -60, -5);

const repoMembresias = (filas: unknown[]) => ({
  find: jest.fn().mockResolvedValue(filas),
});

const soloProxima = [proxima, vencida, suspendida, activaTerminada];
const conAmbas = [vencida, suspendida, activaTerminada, vigente, proxima];

describe('acceso por QR', () => {
  const armar = (filas: unknown[]) =>
    new AccesoService(
      {} as never,
      {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'u1', tipoActor: TipoActor.SOCIO }),
      } as never,
      {} as never,
      repoMembresias(filas) as never,
      { sign: jest.fn().mockReturnValue('jwt') } as never,
    );

  it('con vigente + próxima genera el QR', async () => {
    await expect(armar(conAmbas).generarQr('u1')).resolves.toMatchObject({
      qrToken: 'jwt',
    });
  });
  it('con solo una próxima (aún no empezó) no genera el QR', async () => {
    await expect(armar(soloProxima).generarQr('u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('una ACTIVO ya terminada (cron sin correr) no da acceso', async () => {
    await expect(
      armar([activaTerminada]).generarQr('u1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('reserva de clases', () => {
  const armar = (filas: unknown[]) => {
    const bookingRepo = {
      reservarSegura: jest.fn().mockResolvedValue({ id: 'r' }),
    };
    const ocurrencia = {
      id: 'o1',
      estado: 'PROGRAMADA',
      fecha: dia(5),
      horaInicio: '10:00:00',
      clase: { activa: true, sede: { id: 's1' } },
    };
    const service = new ReservasClaseService(
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { findOne: jest.fn().mockResolvedValue(ocurrencia) } as never,
      {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'u1', tipoActor: TipoActor.SOCIO }),
      } as never,
      repoMembresias(filas) as never,
      bookingRepo,
      { emit: jest.fn() } as never,
    );
    return { service, bookingRepo };
  };
  const actor = { id: 'u1', tipoActor: TipoActor.SOCIO } as UsuarioAutenticado;

  it('con vigente + próxima reserva', async () => {
    const t = armar(conAmbas);
    await t.service.reservar('o1', 'u1', actor);
    expect(t.bookingRepo.reservarSegura).toHaveBeenCalledTimes(1);
  });
  it('con solo una próxima, vencida o suspendida no reserva', async () => {
    for (const filas of [soloProxima, [vencida], [suspendida]]) {
      const t = armar(filas);
      await expect(
        t.service.reservar('o1', 'u1', actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(t.bookingRepo.reservarSegura).not.toHaveBeenCalled();
    }
  });
});

describe('precio de cancha (descuento de socio solo con vigente HOY)', () => {
  const precio = async (filas: unknown[]) => {
    const membresias = new MembresiasService(
      repoMembresias(filas) as never,
      {} as never,
      {} as never,
    );
    const service = new ReservasCanchaService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new PricingCalculatorService([
        new MemberDiscountPricing(),
        new PeakHourPricing(),
      ]),
      membresias,
      {} as never,
    );
    const r = await (
      service as unknown as {
        calcularPrecio: (
          c: object,
          u: object,
          h: string,
        ) => Promise<{ precioFinal: number }>;
      }
    ).calcularPrecio(
      { costoHoraBase: '10000' },
      { id: 'u1', tipoActor: TipoActor.SOCIO },
      '10:00',
    );
    return r.precioFinal;
  };

  it('con vigente + próxima: 15% de descuento', async () => {
    expect(await precio(conAmbas)).toBe(8500);
  });
  it('con solo una próxima o terminada: tarifa de externo', async () => {
    expect(await precio(soloProxima)).toBe(10000);
    expect(await precio([activaTerminada])).toBe(10000);
  });
});

describe('reporte por sede y popularidad de planes', () => {
  const armar = (filas: unknown[], qb?: object) =>
    new AdminService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        find: jest.fn().mockResolvedValue(filas),
        createQueryBuilder: () => qb,
      } as never,
      {
        find: jest.fn().mockResolvedValue([{ id: 's1', nombre: 'Centro' }]),
      } as never,
    );
  const gg = {
    id: 'gg',
    tipoActor: TipoActor.GERENTE_GENERAL,
  } as UsuarioAutenticado;

  it('cuenta vigentes hoy: la próxima no es activa y la ACTIVO terminada es vencida', async () => {
    const [r] = await armar(conAmbas).obtenerMembresiasPorSede(undefined, gg);
    expect(r.activas).toBe(1);
    expect(r.programadas).toBe(1);
    expect(r.suspendidas).toBe(1);
    expect(r.vencidas).toBe(2); // VENCIDO + ACTIVO terminada
    // Campos existentes intactos; los nuevos se agregan.
    expect(r.socios.find((s) => s.vigente)).toEqual(
      expect.objectContaining({
        usuarioId: 'u1',
        nombre: 'Ana Paz',
        dni: '1',
        plan: TipoPlan.MENSUAL,
        estado: EstadoMembresia.ACTIVO,
        fechaFin: vigente.fechaFin,
        vigente: true,
        proxima: false,
      }),
    );
  });

  it('popularidad de planes cuenta solo membresías vigentes hoy (por fechas)', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ plan: 'MENSUAL', socios: '3' }]),
    };
    const r = await armar([], qb).obtenerPopularidadPlanes(gg);
    expect(r).toEqual([{ plan: 'MENSUAL', socios: 3 }]);
    const [sql, params] = qb.where.mock.calls[0] as [string, { hoy: string }];
    expect(sql).toContain('fecha_inicio <= :hoy');
    expect(sql).toContain('fecha_fin > :hoy');
    expect(params.hoy).toBe(hoyArgentina());
  });
});

describe('vencimiento en el listado de clientes', () => {
  it('la consulta elige la vigente hoy y excluye a las próximas', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: '0' }])
      .mockResolvedValueOnce([]);
    const service = new ClientesService({ query } as never);
    await service.listar(new ClientesQueryDto());
    const sql = (query.mock.calls[1] as [string])[0];
    const hoy = hoyArgentina();
    expect(sql).toContain(
      `NOT (mm.estado = 'ACTIVO' AND mm.fecha_inicio > '${hoy}'::date)`,
    );
    expect(sql).toContain(
      `mm.fecha_inicio <= '${hoy}'::date AND mm.fecha_fin > '${hoy}'::date`,
    );
  });
});
