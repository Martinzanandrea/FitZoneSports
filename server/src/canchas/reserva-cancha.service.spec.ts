import { ForbiddenException } from '@nestjs/common';
import { EstadoResCancha, TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { ReservasCanchaService } from './reserva-cancha.service';

const usuarioCompleto = {
  id: 'u2',
  nombre: 'Ana',
  apellido: 'Paz',
  dni: '30111222',
  email: 'ana@ejemplo.com',
  telefono: '1155550000',
  fotoUrl: 'http://x/foto.png',
  tipoActor: TipoActor.SOCIO,
};

function armar() {
  const canchasRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: 'c1', sede: { id: 'sedeA', nombre: 'A' } }),
  };
  const reservasRepo = {
    findAndCount: jest.fn().mockResolvedValue([
      [
        {
          id: 'r1',
          fecha: '2026-11-01',
          horaInicio: '10:00:00',
          horaFin: '11:00:00',
          estado: EstadoResCancha.CONFIRMADA,
          usuario: usuarioCompleto,
        },
      ],
      1,
    ]),
    find: jest.fn().mockResolvedValue([
      {
        id: 'r1',
        horaInicio: '10:00:00',
        horaFin: '11:00:00',
        usuario: usuarioCompleto,
      },
    ]),
  };
  const service = new ReservasCanchaService(
    canchasRepo as never,
    {} as never,
    reservasRepo as never,
    {} as never,
    {} as never,
    {} as never,
    { find: jest.fn().mockResolvedValue([]) } as never,
  );
  return { service, canchasRepo, reservasRepo };
}

const actor = (
  tipoActor: TipoActor,
  sedeId: string | null,
): UsuarioAutenticado => ({
  id: 'p1',
  tipoActor,
  email: 'p@x.com',
  sedeId,
});

describe('ReservasCanchaService.findPorCancha (alcance por sede)', () => {
  it.each([TipoActor.RECEPCIONISTA, TipoActor.GERENTE_SEDE])(
    '%s de la misma sede puede listar',
    async (rol) => {
      const { service } = armar();
      const r = await service.findPorCancha(
        'c1',
        undefined,
        undefined,
        actor(rol, 'sedeA'),
      );
      expect(r.data).toHaveLength(1);
    },
  );

  it.each([TipoActor.RECEPCIONISTA, TipoActor.GERENTE_SEDE])(
    '%s de otra sede recibe 403 y no consulta reservas',
    async (rol) => {
      const { service, reservasRepo } = armar();
      await expect(
        service.findPorCancha('c1', undefined, undefined, actor(rol, 'sedeB')),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(reservasRepo.findAndCount).not.toHaveBeenCalled();
    },
  );

  it('personal de sede sin sede asignada falla cerrado', async () => {
    const { service } = armar();
    await expect(
      service.findPorCancha(
        'c1',
        undefined,
        undefined,
        actor(TipoActor.RECEPCIONISTA, null),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('GERENTE_GENERAL ve cualquier sede', async () => {
    const { service } = armar();
    const r = await service.findPorCancha(
      'c1',
      undefined,
      undefined,
      actor(TipoActor.GERENTE_GENERAL, null),
    );
    expect(r.total).toBe(1);
  });

  it.each([TipoActor.SOCIO, TipoActor.EXTERNO])(
    'defensa en profundidad: %s también recibe 403 en el servicio',
    async (rol) => {
      const { service } = armar();
      await expect(
        service.findPorCancha('c1', undefined, undefined, actor(rol, null)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('el usuario sale reducido: sin dni, email, teléfono ni fotoUrl', async () => {
    const { service } = armar();
    const r = await service.findPorCancha(
      'c1',
      undefined,
      undefined,
      actor(TipoActor.GERENTE_GENERAL, null),
    );
    expect(r.data[0].usuario).toEqual({
      id: 'u2',
      nombre: 'Ana',
      apellido: 'Paz',
    });
    expect(JSON.stringify(r)).not.toMatch(
      /30111222|ana@ejemplo|1155550000|foto/,
    );
  });
});

describe('ReservasCanchaService.misReservas / ocupacion', () => {
  it('misReservas filtra por el usuario recibido y solo CONFIRMADA', async () => {
    const { service, reservasRepo } = armar();
    reservasRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 'r9',
          fecha: '2026-11-02',
          horaInicio: '09:00:00',
          horaFin: '10:00:00',
          precioFinal: '1000.00',
          estrategiaPrecio: 'SOCIO',
          estado: EstadoResCancha.CONFIRMADA,
          creadaEn: new Date(),
          usuario: usuarioCompleto,
          cancha: {
            id: 'c1',
            nombre: 'Cancha 1',
            sede: { id: 's', nombre: 'S' },
          },
        },
      ],
      1,
    ]);
    const r = await service.misReservas('u1', { desde: '2026-11-01' });
    const arg = (reservasRepo.findAndCount.mock.calls as unknown[][])[0][0] as {
      where: { usuario: { id: string }; estado: EstadoResCancha };
    };
    expect(arg.where.usuario).toEqual({ id: 'u1' });
    expect(arg.where.estado).toBe(EstadoResCancha.CONFIRMADA);
    expect(r.data[0]).not.toHaveProperty('usuario');
    expect(JSON.stringify(r)).not.toMatch(/30111222|ana@ejemplo|1155550000/);
  });

  it('misReservas rechaza fechas con formato inválido', async () => {
    const { service } = armar();
    await expect(
      service.misReservas('u1', { fecha: 'mañana' }),
    ).rejects.toThrow();
  });

  it('ocupacion devuelve solo horarios, sin usuarios', async () => {
    const { service } = armar();
    const r = await service.ocupacion('c1', '2026-11-01');
    expect(r).toEqual([{ horaInicio: '10:00:00', horaFin: '11:00:00' }]);
  });
});

describe('ReservasCanchaService.ocupacion: mantenimiento y bloqueos', () => {
  function conCancha(
    estado: string,
    bloqueos: Array<{ desde: string; hasta: string }>,
  ) {
    const canchasRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'c1', estado }),
    };
    const reservasRepo = {
      find: jest
        .fn()
        .mockResolvedValue([{ horaInicio: '10:00:00', horaFin: '11:00:00' }]),
    };
    const bloqueosRepo = {
      find: jest.fn().mockResolvedValue(
        bloqueos.map((b) => ({
          desde: new Date(b.desde),
          hasta: new Date(b.hasta),
        })),
      ),
    };
    return new ReservasCanchaService(
      canchasRepo as never,
      {} as never,
      reservasRepo as never,
      {} as never,
      {} as never,
      {} as never,
      bloqueosRepo as never,
    );
  }

  it('cancha en mantenimiento: todos los turnos figuran ocupados', async () => {
    const r = await conCancha('MANTENIMIENTO', []).ocupacion(
      'c1',
      '2026-11-01',
    );
    expect(r).toHaveLength(15);
    expect(r[0].horaInicio).toBe('08:00:00');
    expect(r[14].horaInicio).toBe('22:00:00');
  });

  it('bloqueo por rango: solo ocupa los turnos afectados (hora de Argentina)', async () => {
    // 14:00 a 16:00 en Argentina = 17:00 a 19:00 UTC
    const r = await conCancha('ACTIVA', [
      { desde: '2026-11-01T17:00:00Z', hasta: '2026-11-01T19:00:00Z' },
    ]).ocupacion('c1', '2026-11-01');
    expect(r.map((t) => t.horaInicio)).toEqual([
      '10:00:00',
      '14:00:00',
      '15:00:00',
    ]);
  });

  it('un bloqueo que termina justo cuando empieza un turno no lo toca', async () => {
    const r = await conCancha('ACTIVA', [
      { desde: '2026-11-01T12:00:00Z', hasta: '2026-11-01T13:00:00Z' }, // 09:00-10:00 AR
    ]).ocupacion('c1', '2026-11-01');
    expect(r.map((t) => t.horaInicio)).toEqual(['09:00:00', '10:00:00']);
  });

  it('un bloqueo de otro día no afecta', async () => {
    const r = await conCancha('ACTIVA', [
      { desde: '2026-11-02T12:00:00Z', hasta: '2026-11-02T20:00:00Z' },
    ]).ocupacion('c1', '2026-11-01');
    expect(r).toHaveLength(1);
  });
});
