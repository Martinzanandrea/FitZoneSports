import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EstadoResClase, TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { ReservasClaseService } from './reserva-clase.service';

const enDias = (d: number) => {
  const f = new Date(Date.now() + d * 24 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    fecha: `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`,
    horaInicio: `${p(f.getHours())}:${p(f.getMinutes())}:00`,
  };
};

function armar(reservaPrevia: unknown) {
  const ocurrencia = {
    id: 'o1',
    estado: 'PROGRAMADA',
    ...enDias(5),
    clase: { sede: { id: 's1' } },
  };
  const reservasRepo = { findOne: jest.fn().mockResolvedValue(reservaPrevia) };
  const ocurrenciasRepo = { findOne: jest.fn().mockResolvedValue(ocurrencia) };
  const usuariosRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: 'u1', tipoActor: TipoActor.SOCIO }),
  };
  const membresiasRepo = {
    findOne: jest.fn().mockResolvedValue({
      estado: 'ACTIVO',
      fechaVencimiento: enDias(30).fecha,
    }),
  };
  const bookingRepo = {
    reservarSegura: jest.fn().mockResolvedValue({ id: 'nueva' }),
  };
  const service = new ReservasClaseService(
    reservasRepo as never,
    ocurrenciasRepo as never,
    usuariosRepo as never,
    membresiasRepo as never,
    bookingRepo,
    { emit: jest.fn() } as never,
  );
  return { service, bookingRepo, reservasRepo };
}

const actor = { id: 'u1', tipoActor: TipoActor.SOCIO } as UsuarioAutenticado;

describe('ReservasClaseService.reservar (duplicados)', () => {
  it('reserva tras cancelar: una fila CANCELADA no bloquea y delega al repository', async () => {
    const { service, bookingRepo } = armar({
      id: 'r1',
      estado: EstadoResClase.CANCELADA,
    });
    await service.reservar('o1', 'u1', actor);
    expect(bookingRepo.reservarSegura).toHaveBeenCalledTimes(1);
  });

  it.each([EstadoResClase.RESERVADA, EstadoResClase.LISTA_ESPERA])(
    'con reserva %s responde 409 y no delega',
    async (estado) => {
      const { service, bookingRepo } = armar({ id: 'r1', estado });
      await expect(service.reservar('o1', 'u1', actor)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(bookingRepo.reservarSegura).not.toHaveBeenCalled();
    },
  );

  it('consulta la reserva previa solo del usuario y la ocurrencia pedidos', async () => {
    const { service, reservasRepo } = armar(null);
    await service.reservar('o1', 'u1', actor);
    expect(reservasRepo.findOne).toHaveBeenCalledWith({
      where: { ocurrencia: { id: 'o1' }, usuario: { id: 'u1' } },
    });
  });
});

const usuarioCompleto = {
  id: 'u2',
  nombre: 'Ana',
  apellido: 'Paz',
  dni: '30111222',
  email: 'ana@ejemplo.com',
  telefono: '1155550000',
  fotoUrl: 'http://x/foto.png',
};

function armarListado() {
  const reservasRepo = {
    findAndCount: jest
      .fn()
      .mockResolvedValue([
        [{ id: 'r1', estado: 'RESERVADA', usuario: usuarioCompleto }],
        1,
      ]),
  };
  const ocurrenciasRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: 'o1', clase: { sede: { id: 'sedeA' } } }),
  };
  const service = new ReservasClaseService(
    reservasRepo as never,
    ocurrenciasRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, reservasRepo };
}

const personal = (tipoActor: TipoActor, sedeId: string | null) =>
  ({ id: 'p1', tipoActor, email: 'p@x.com', sedeId }) as UsuarioAutenticado;

describe('ReservasClaseService.findPorOcurrencia (alcance por sede)', () => {
  it.each([TipoActor.RECEPCIONISTA, TipoActor.GERENTE_SEDE])(
    '%s de otra sede o sin sede recibe 403 y no consulta reservas',
    async (rol) => {
      for (const sedeId of ['sedeB', null]) {
        const { service, reservasRepo } = armarListado();
        await expect(
          service.findPorOcurrencia('o1', {}, personal(rol, sedeId)),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(reservasRepo.findAndCount).not.toHaveBeenCalled();
      }
    },
  );

  it.each([TipoActor.SOCIO, TipoActor.EXTERNO])(
    'defensa en profundidad: %s recibe 403 en el servicio',
    async (rol) => {
      const { service } = armarListado();
      await expect(
        service.findPorOcurrencia('o1', {}, personal(rol, null)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('personal de la misma sede y GG ven el listado con usuario reducido', async () => {
    for (const p of [
      personal(TipoActor.RECEPCIONISTA, 'sedeA'),
      personal(TipoActor.GERENTE_GENERAL, null),
    ]) {
      const { service } = armarListado();
      const r = await service.findPorOcurrencia('o1', {}, p);
      expect(r.data[0].usuario).toEqual({
        id: 'u2',
        nombre: 'Ana',
        apellido: 'Paz',
      });
      expect(JSON.stringify(r)).not.toMatch(
        /30111222|ana@ejemplo|1155550000|foto/,
      );
    }
  });
});

describe('ReservasClaseService.misReservas', () => {
  it('filtra por el usuario recibido y solo estados activos, sin exponer usuarios', async () => {
    const { service, reservasRepo } = armarListado();
    reservasRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 'r9',
          estado: 'RESERVADA',
          creadaEn: new Date(),
          usuario: usuarioCompleto,
          ocurrencia: {
            id: 'o1',
            fecha: '2026-11-02',
            horaInicio: '09:00:00',
            horaFin: '10:00:00',
            estado: 'PROGRAMADA',
            clase: {
              id: 'c1',
              tipoClase: 'Yoga',
              sede: { id: 's', nombre: 'S' },
              instructor: { id: 'i', nombre: 'Luz' },
            },
          },
        },
      ],
      1,
    ]);
    const r = await service.misReservas('u1', '2026-11-01');
    const arg = (reservasRepo.findAndCount.mock.calls as unknown[][])[0][0] as {
      where: { usuario: { id: string } };
    };
    expect(arg.where.usuario).toEqual({ id: 'u1' });
    expect(r.data[0].ocurrencia.clase.instructor.nombre).toBe('Luz');
    expect(r.data[0]).not.toHaveProperty('usuario');
    expect(JSON.stringify(r)).not.toMatch(/30111222|ana@ejemplo|1155550000/);
  });

  it('rechaza un filtro desde con formato inválido', async () => {
    const { service } = armarListado();
    await expect(service.misReservas('u1', 'ayer')).rejects.toThrow();
  });
});
