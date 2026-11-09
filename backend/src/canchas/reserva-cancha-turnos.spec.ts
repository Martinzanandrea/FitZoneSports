import { BadRequestException } from '@nestjs/common';
import { TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { ReservasCanchaService } from './reserva-cancha.service';

const yo: UsuarioAutenticado = {
  id: 'u1',
  tipoActor: TipoActor.EXTERNO,
  email: 'u@x.com',
  sedeId: null,
};

function armar() {
  const bookingRepo = { crearReservaSegura: jest.fn().mockResolvedValue({}) };
  const service = new ReservasCanchaService(
    {
      findOne: jest.fn().mockResolvedValue({
        id: 'c1',
        estado: 'ACTIVA',
        costoHoraBase: '1000',
        sede: { id: 's1' },
      }),
    } as never,
    {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'u1', tipoActor: TipoActor.EXTERNO }),
    } as never,
    {} as never,
    bookingRepo as never,
    {
      calcular: jest
        .fn()
        .mockReturnValue({ precioFinal: 1000, estrategia: 'ESTANDAR' }),
      esHoraPico: () => false,
    } as never,
    {} as never,
    {} as never,
  );
  return { service, bookingRepo };
}

const dto = (horaInicio: string, horaFin: string) => ({
  canchaId: 'c1',
  usuarioId: 'u1',
  fecha: '2099-01-10',
  horaInicio,
  horaFin,
});

describe('Reserva online de cancha: turno de una hora, en punto, 08:00-22:00', () => {
  it('acepta un turno válido', async () => {
    const { service, bookingRepo } = armar();
    await service.reservar(dto('10:00', '11:00'), yo);
    expect(bookingRepo.crearReservaSegura).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['08:00', '23:00'], // horaFin elegida por el cliente: pagaría 1 h por 15
    ['10:00', '10:30'],
    ['10:30', '11:30'],
    ['07:00', '08:00'],
    ['23:00', '24:00'],
    ['10:00', '10:00'],
    ['11:00', '10:00'],
  ])('rechaza %s-%s (reservar y cotizar)', async (ini, fin) => {
    const { service, bookingRepo } = armar();
    await expect(service.reservar(dto(ini, fin), yo)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.cotizar(dto(ini, fin), yo)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(bookingRepo.crearReservaSegura).not.toHaveBeenCalled();
  });
});
