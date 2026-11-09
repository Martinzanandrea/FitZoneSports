import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TipoActor } from '../entities/enums';
import { ReservasClaseController } from './reserva-clase.controller';
import { ReservasCanchaController } from '../canchas/reservas-cancha.controller';

// Se ejecuta el RolesGuard real sobre la metadata @Roles real de cada
// handler: demuestra el 403 sin levantar la app ni la base.
function contexto(
  clase: new (...args: never[]) => object,
  handler: string,
  tipoActor: TipoActor,
): ExecutionContext {
  return {
    getHandler: () =>
      (clase.prototype as Record<string, () => unknown>)[handler],
    getClass: () => clase,
    switchToHttp: () => ({ getRequest: () => ({ user: { tipoActor } }) }),
  } as unknown as ExecutionContext;
}

const guard = new RolesGuard(new Reflector());

const LISTADOS_GENERALES: Array<
  [string, new (...a: never[]) => object, string]
> = [
  [
    'GET /reservas-cancha/cancha/:id',
    ReservasCanchaController,
    'findPorCancha',
  ],
  [
    'GET /clases/ocurrencias/:id/reservas',
    ReservasClaseController,
    'findPorOcurrencia',
  ],
];

describe('Listados generales de reservas: solo personal', () => {
  describe.each(LISTADOS_GENERALES)('%s', (_n, clase, handler) => {
    it.each([TipoActor.SOCIO, TipoActor.EXTERNO])('%s recibe 403', (rol) => {
      expect(() => guard.canActivate(contexto(clase, handler, rol))).toThrow(
        ForbiddenException,
      );
    });

    it.each([
      TipoActor.RECEPCIONISTA,
      TipoActor.GERENTE_SEDE,
      TipoActor.GERENTE_GENERAL,
    ])('%s pasa el guard', (rol) => {
      expect(guard.canActivate(contexto(clase, handler, rol))).toBe(true);
    });
  });
});

describe('Endpoints propios de Socio/Externo', () => {
  it.each([
    [ReservasCanchaController, 'misReservas'],
    [ReservasCanchaController, 'ocupacion'],
    [ReservasClaseController, 'misReservas'],
  ] as Array<[new (...a: never[]) => object, string]>)(
    '%p.%s está permitido para SOCIO y EXTERNO',
    (clase, handler) => {
      for (const rol of [TipoActor.SOCIO, TipoActor.EXTERNO]) {
        expect(guard.canActivate(contexto(clase, handler, rol))).toBe(true);
      }
    },
  );

  it('mis reservas de cancha usa el id del JWT, no un parámetro', async () => {
    const service = { misReservas: jest.fn().mockResolvedValue({}) };
    const ctrl = new ReservasCanchaController(service as never);
    await ctrl.misReservas(
      { id: 'jwt-user', tipoActor: 'SOCIO', email: 'a@b.c', sedeId: null },
      '2026-11-01',
    );
    expect(service.misReservas).toHaveBeenCalledWith(
      'jwt-user',
      expect.anything(),
      undefined,
    );
  });

  it('mis reservas de clase usa el id del JWT, no un parámetro', async () => {
    const service = { misReservas: jest.fn().mockResolvedValue({}) };
    const ctrl = new ReservasClaseController(service as never);
    await ctrl.misReservas(
      { id: 'jwt-user', tipoActor: 'EXTERNO', email: 'a@b.c', sedeId: null },
      '2026-11-01',
    );
    expect(service.misReservas).toHaveBeenCalledWith(
      'jwt-user',
      expect.anything(),
      undefined,
    );
  });
});
