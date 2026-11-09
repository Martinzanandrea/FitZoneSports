import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TipoActor, TipoPlan } from '../entities/enums';
import { Membresia, Sede, Usuario } from '../entities';
import { MembresiasService } from './membresias.service';

function armar(opts: {
  usuario?: Record<string, unknown> | null;
  sede?: Record<string, unknown> | null;
  activa?: boolean;
}) {
  const membresiasRepo = {
    find: jest.fn().mockResolvedValue(
      opts.activa
        ? [{ estado: 'ACTIVO', fechaInicio: '2020-01-01', fechaFin: '2999-12-01' }]
        : [],
    ),
    create: jest.fn((x: object) => x),
    save: jest.fn((x: object) => Promise.resolve(x)),
  };
  const usuariosRepo = { findOne: jest.fn().mockResolvedValue(opts.usuario) };
  const sedesRepo = { findOne: jest.fn().mockResolvedValue(opts.sede) };
  const service = new MembresiasService(
    membresiasRepo as never,
    usuariosRepo as never,
    sedesRepo as never,
  );
  const repos = new Map<unknown, unknown>([
    [Membresia, membresiasRepo],
    [Usuario, usuariosRepo],
    [Sede, sedesRepo],
  ]);
  const manager = { getRepository: (e: unknown) => repos.get(e) } as never;
  return { service, membresiasRepo, manager };
}

const dto = { usuarioId: 'u1', sedeAltaId: 's1', plan: TipoPlan.MENSUAL };
const ok = { id: 'u1', tipoActor: TipoActor.EXTERNO, activo: true };
const sedeOk = { id: 's1', activa: true };

describe('MembresiasService: no se crean membresías huérfanas', () => {
  it('con titular y sede válidos la crea', async () => {
    const { service, membresiasRepo, manager } = armar({ usuario: ok, sede: sedeOk });
    await service.alta(dto, manager);
    expect(membresiasRepo.save).toHaveBeenCalledTimes(1);
  });

  it('titular inexistente: 404 sin guardar', async () => {
    const { service, membresiasRepo, manager } = armar({ usuario: null, sede: sedeOk });
    await expect(service.alta(dto, manager)).rejects.toBeInstanceOf(NotFoundException);
    expect(membresiasRepo.save).not.toHaveBeenCalled();
  });

  it('sede inexistente: 404 sin guardar', async () => {
    const { service, membresiasRepo, manager } = armar({ usuario: ok, sede: null });
    await expect(service.alta(dto, manager)).rejects.toBeInstanceOf(NotFoundException);
    expect(membresiasRepo.save).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...ok, tipoActor: TipoActor.RECEPCIONISTA }, sedeOk],
    [{ ...ok, tipoActor: TipoActor.GERENTE_GENERAL }, sedeOk],
    [{ ...ok, activo: false }, sedeOk],
    [ok, { ...sedeOk, activa: false }],
  ])('titular o sede no válidos: 400 sin guardar', async (usuario, sede) => {
    const { service, membresiasRepo, manager } = armar({ usuario, sede });
    await expect(service.alta(dto, manager)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(membresiasRepo.save).not.toHaveBeenCalled();
  });

  it('con una membresía previa aplica las mismas validaciones', async () => {
    const { service, membresiasRepo, manager } = armar({
      usuario: { ...ok, activo: false },
      sede: sedeOk,
      activa: true,
    });
    await expect(service.alta(dto, manager)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(membresiasRepo.save).not.toHaveBeenCalled();
  });
});
