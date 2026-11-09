import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { Usuario } from '../entities';
import { EstadoResClase } from '../entities/enums';
import { TypeOrmBookingClaseRepository } from './booking-clase.repository';

// Sin base real: se mockean DataSource y EntityManager para verificar la
// forma de la consulta y la decisión RESERVADA / LISTA_ESPERA.
function armar(
  ocurrencia: unknown,
  cupoOcupado: number,
  previa: unknown = null,
) {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(ocurrencia),
  };
  const manager = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    count: jest.fn().mockResolvedValue(cupoOcupado),
    findOne: jest.fn().mockResolvedValue(previa),
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

  describe('reactivación de reserva CANCELADA', () => {
    const cancelada = () => ({
      id: 'r1',
      estado: EstadoResClase.CANCELADA,
      canceladaEn: new Date('2026-01-01'),
      creadaEn: new Date('2026-01-01'),
      notificado: true,
    });

    it('reserva tras cancelar: reactiva la misma fila como RESERVADA y no inserta otra', async () => {
      const previa = cancelada();
      const { repo, manager } = armar(
        { id: 'o1', clase: { capacidad: 2 } },
        1,
        previa,
      );
      const r = await repo.reservarSegura({ ocurrenciaId: 'o1', usuario });
      expect(r).toBe(previa);
      expect(r.id).toBe('r1');
      expect(r.estado).toBe(EstadoResClase.RESERVADA);
      expect(r.ocurrencia.id).toBe('o1');
      expect(r.ocurrencia.clase.capacidad).toBe(2);
      expect(r.usuario).toBe(usuario);
      expect(r.canceladaEn).toBeNull();
      expect(r.notificado).toBe(false);
      expect(r.creadaEn.getTime()).toBeGreaterThan(
        new Date('2026-01-01').getTime(),
      );
      expect(manager.create).not.toHaveBeenCalled();
    });

    it('reserva tras cancelar sin cupo: queda en LISTA_ESPERA', async () => {
      const { repo } = armar(
        { id: 'o1', clase: { capacidad: 2 } },
        2,
        cancelada(),
      );
      const r = await repo.reservarSegura({ ocurrenciaId: 'o1', usuario });
      expect(r.estado).toBe(EstadoResClase.LISTA_ESPERA);
    });

    it.each([EstadoResClase.RESERVADA, EstadoResClase.LISTA_ESPERA])(
      'con una reserva %s del mismo usuario lanza Conflict y no guarda',
      async (estado) => {
        const { repo, manager } = armar(
          { id: 'o1', clase: { capacidad: 2 } },
          0,
          { id: 'r1', estado },
        );
        await expect(
          repo.reservarSegura({ ocurrenciaId: 'o1', usuario }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(manager.save).not.toHaveBeenCalled();
      },
    );

    it('busca la fila previa solo del usuario y la ocurrencia pedidos (no pisa la de otro usuario)', async () => {
      const { repo, manager } = armar({ id: 'o1', clase: { capacidad: 2 } }, 0);
      await repo.reservarSegura({ ocurrenciaId: 'o1', usuario });
      expect(manager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { ocurrencia: { id: 'o1' }, usuario: { id: 'u1' } },
        }),
      );
      // sin fila previa del usuario: inserta una nueva
      expect(manager.create).toHaveBeenCalledTimes(1);
    });
  });
});
