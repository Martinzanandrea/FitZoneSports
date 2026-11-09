import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TipoActor } from '../entities/enums';
import { AccesoController } from './acceso.controller';

const guard = new RolesGuard(new Reflector());

function contexto(handler: string, tipoActor: TipoActor): ExecutionContext {
  return {
    getHandler: () =>
      (AccesoController.prototype as unknown as Record<string, () => unknown>)[
        handler
      ],
    getClass: () => AccesoController,
    switchToHttp: () => ({ getRequest: () => ({ user: { tipoActor } }) }),
  } as unknown as ExecutionContext;
}

describe('Control de acceso: escanear y registrar, solo RECEPCIONISTA', () => {
  describe.each(['validarIngreso', 'validarCodigo', 'registrarEgreso'])(
    '%s',
    (handler) => {
      it.each([
        TipoActor.GERENTE_SEDE,
        TipoActor.GERENTE_GENERAL,
        TipoActor.SOCIO,
        TipoActor.EXTERNO,
      ])('%s recibe 403', (rol) => {
        expect(() => guard.canActivate(contexto(handler, rol))).toThrow(
          ForbiddenException,
        );
      });

      it('RECEPCIONISTA pasa', () => {
        expect(
          guard.canActivate(contexto(handler, TipoActor.RECEPCIONISTA)),
        ).toBe(true);
      });
    },
  );
});

describe('Control de acceso: lectura de aforo y de quiénes están dentro', () => {
  describe.each(['obtenerAforo', 'listarDentro'])('%s', (handler) => {
    it.each([
      TipoActor.RECEPCIONISTA,
      TipoActor.GERENTE_SEDE,
      TipoActor.GERENTE_GENERAL,
    ])('%s pasa el guard', (rol) => {
      expect(guard.canActivate(contexto(handler, rol))).toBe(true);
    });

    it.each([TipoActor.SOCIO, TipoActor.EXTERNO])('%s recibe 403', (rol) => {
      expect(() => guard.canActivate(contexto(handler, rol))).toThrow(
        ForbiddenException,
      );
    });
  });

  const servicio = {
    obtenerAforo: jest.fn().mockResolvedValue({ actual: 1, maximo: 10 }),
  };
  const controller = new AccesoController(servicio as never);

  it('Gerente de Sede lee el aforo de su sede', async () => {
    await expect(
      controller.obtenerAforo('s1', {
        tipoActor: TipoActor.GERENTE_SEDE,
        sedeId: 's1',
      } as never),
    ).resolves.toEqual({ actual: 1, maximo: 10 });
  });

  it('Gerente de Sede recibe 403 en el aforo de otra sede', () => {
    servicio.obtenerAforo.mockClear();
    expect(() =>
      controller.obtenerAforo('s2', {
        tipoActor: TipoActor.GERENTE_SEDE,
        sedeId: 's1',
      } as never),
    ).toThrow(ForbiddenException);
    expect(servicio.obtenerAforo).not.toHaveBeenCalled();
  });

  it('Recepcionista recibe 403 en el aforo de otra sede', () => {
    expect(() =>
      controller.obtenerAforo('s2', {
        tipoActor: TipoActor.RECEPCIONISTA,
        sedeId: 's1',
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('Gerente General lee el aforo de cualquier sede', async () => {
    await expect(
      controller.obtenerAforo('s9', {
        tipoActor: TipoActor.GERENTE_GENERAL,
        sedeId: null,
      } as never),
    ).resolves.toBeDefined();
  });
});
