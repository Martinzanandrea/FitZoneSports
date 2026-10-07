import { NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { Usuario } from '../entities';
import { EstadoResClase } from '../entities/enums';
import { TypeOrmBookingClaseRepository } from './booking-clase.repository';

// Sin base real: se mockean DataSource y EntityManager para verificar la
// forma de la consulta y la decisión RESERVADA / LISTA_ESPERA.
function armar(ocurrencia: unknown, cupoOcupado: number) {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(ocurrencia),
  };
  const manager = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    count: jest.fn().mockResolvedValue(cupoOcupado),
    create: jest.fn((_e: unknown, datos: object) => datos),
    save: jest.fn((r: unknown) => Promise.resolve(r)),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  } as unknown as DataSource;
  return { repo: new TypeOrmBookingClaseRepository(dataSource), qb, manager };
}

const usuario = { id: 'u1' } as Usuario;

describe('TypeOrmBookingClaseRepository.reservarSegura', () => {
  it('bloquea solo la ocurrencia (FOR UPDATE OF oc), no el lado anulable del join', async () => {
    const { repo, qb } = armar({ id: 'o1', clase: { capacidad: 5 } }, 0);
    await repo.reservarSegura({ ocurrenciaId: 'o1', usuario });
    expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write', undefined, ['oc']);
  });

  it('reserva cuando hay cupo', async () => {
    const { repo } = armar({ id: 'o1', clase: { capacidad: 2 } }, 1);
    const r = await repo.reservarSegura({ ocurrenciaId: 'o1', usuario });
    expect(r.estado).toBe(EstadoResClase.RESERVADA);
  });

  it('manda a lista de espera con el último cupo ocupado', async () => {
    const { repo } = armar({ id: 'o1', clase: { capacidad: 2 } }, 2);
    const r = await repo.reservarSegura({ ocurrenciaId: 'o1', usuario });
    expect(r.estado).toBe(EstadoResClase.LISTA_ESPERA);
  });

  it('lanza NotFound si la ocurrencia no existe y no cuenta ni guarda', async () => {
    const { repo, manager } = armar(null, 0);
    await expect(repo.reservarSegura({ ocurrenciaId: 'x', usuario })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.count).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
});
