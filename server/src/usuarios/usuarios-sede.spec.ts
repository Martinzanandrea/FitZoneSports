import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TipoActor } from '../entities/enums';
import { UsuariosService } from './usuarios.service';

function armar(usuario: unknown, sedeExiste = true) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(usuario),
    save: jest.fn().mockResolvedValue(usuario),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    manager: { exists: jest.fn().mockResolvedValue(sedeExiste) },
  };
  const service = new UsuariosService(
    repo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, repo };
}

describe('UsuariosService.asignarSede', () => {
  it('rechaza roles no reubicables sin guardar', async () => {
    const { service, repo } = armar({
      id: 'u',
      tipoActor: TipoActor.SOCIO,
      activo: true,
    });
    await expect(service.asignarSede('u', 's')).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza usuarios dados de baja sin guardar', async () => {
    const { service, repo } = armar({
      id: 'u',
      tipoActor: TipoActor.RECEPCIONISTA,
      activo: false,
    });
    await expect(service.asignarSede('u', 's')).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza sede inexistente con 404 sin guardar', async () => {
    const { service, repo } = armar(
      { id: 'u', tipoActor: TipoActor.RECEPCIONISTA, activo: true },
      false,
    );
    await expect(service.asignarSede('u', 's')).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('UsuariosService.findStaff: orden', () => {
  it('activos primero y luego apellido y nombre, en la consulta completa', async () => {
    const { service, repo } = armar(null);
    await service.findStaff({ page: 2, limit: 10 }, {
      tipoActor: TipoActor.GERENTE_GENERAL,
    } as never);
    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { activo: 'DESC', apellido: 'ASC', nombre: 'ASC', id: 'ASC' },
        skip: 10,
        take: 10,
      }),
    );
  });
});
