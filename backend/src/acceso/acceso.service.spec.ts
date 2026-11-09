import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EstadoMembresia, TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { AccesoService } from './acceso.service';
import { ClavesQrService } from './claves-qr.service';

// Sin base real: los repositorios son dobles en memoria. El JwtService es el
// real (con un secreto de prueba) para que firma y vencimiento se verifiquen
// de verdad. "Hoy" queda congelado: 2026-10-09 15:00 en Argentina.
const AHORA = new Date('2026-10-09T18:00:00Z');
const SECRETO = 'secreto-solo-para-pruebas';

const fila = (estado: EstadoMembresia, inicio: string, fin: string) => ({
  id: `${estado}-${inicio}`,
  estado,
  fechaInicio: inicio,
  fechaFin: fin,
});
const vigente = fila(EstadoMembresia.ACTIVO, '2026-10-01', '2026-11-01');
const proxima = fila(EstadoMembresia.ACTIVO, '2026-11-01', '2026-12-01');
const vencida = fila(EstadoMembresia.VENCIDO, '2026-08-01', '2026-09-01');
const suspendida = fila(EstadoMembresia.SUSPENDIDO, '2026-10-01', '2026-11-01');

const recepcion = (sedeId: string): UsuarioAutenticado => ({
  id: `rec-${sedeId}`,
  tipoActor: TipoActor.RECEPCIONISTA,
  email: 'r@x.com',
  sedeId,
});
const recepA = recepcion('sA');
const recepB = recepcion('sB');
const gg: UsuarioAutenticado = {
  id: 'gg',
  tipoActor: TipoActor.GERENTE_GENERAL,
  email: 'g@x.com',
  sedeId: null,
};

interface Sesion {
  id: string;
  usuario: { id: string };
  sede: { id: string };
  horaIngreso: Date;
  horaEgreso: Date | null;
}

interface Opciones {
  usuarios?: Record<string, unknown>;
  membresias?: Record<string, unknown[]>;
  aforoMaximo?: number;
  sesiones?: Sesion[];
  falloAlGuardar?: Error;
}

const sesionAbierta = (usuarioId: string, sedeId: string): Sesion => ({
  id: `ses-${usuarioId}`,
  usuario: { id: usuarioId },
  sede: { id: sedeId },
  horaIngreso: new Date(AHORA),
  horaEgreso: null,
});

function armar(opts: Opciones = {}) {
  const usuarios: Record<string, unknown> = opts.usuarios ?? {
    u1: { id: 'u1', tipoActor: TipoActor.SOCIO, activo: true },
  };
  const membresias = opts.membresias ?? { u1: [vigente] };
  const sedes: Record<string, unknown> = {
    sA: { id: 'sA', aforoMaximo: opts.aforoMaximo ?? 10 },
    sB: { id: 'sB', aforoMaximo: 10 },
  };
  const sesiones: Sesion[] = opts.sesiones ?? [];

  const accesoRepo = {
    // Query builder mínimo: recuerda los parámetros de `where` y resuelve
    // sobre la lista de sesiones, igual que lo haría la consulta SQL.
    createQueryBuilder: jest.fn(() => {
      const p: { usuarioId?: string; sedeId?: string } = {};
      const qb: Record<string, unknown> = {};
      qb.leftJoinAndSelect = () => qb;
      qb.andWhere = () => qb;
      qb.where = (_sql: string, params: typeof p) => {
        Object.assign(p, params);
        return qb;
      };
      qb.getCount = () =>
        Promise.resolve(
          sesiones.filter((s) => !s.horaEgreso && s.sede.id === p.sedeId)
            .length,
        );
      qb.getOne = () =>
        Promise.resolve(
          sesiones.find((s) => !s.horaEgreso && s.usuario.id === p.usuarioId) ??
            null,
        );
      return qb;
    }),
    create: jest.fn(
      (datos: { usuario: { id: string }; sede: { id: string } }) => ({
        id: `ses-${sesiones.length + 1}`,
        usuario: datos.usuario,
        sede: datos.sede,
        horaIngreso: new Date(),
        horaEgreso: null,
      }),
    ),
    save: jest.fn((s: Sesion) => {
      if (opts.falloAlGuardar) return Promise.reject(opts.falloAlGuardar);
      if (!sesiones.includes(s)) sesiones.push(s);
      return Promise.resolve(s);
    }),
  };
  const usuariosRepo = {
    findOne: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(usuarios[where.id] ?? null),
    ),
  };
  const sedesRepo = {
    findOne: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(sedes[where.id] ?? null),
    ),
  };
  const membresiasRepo = {
    find: jest.fn(({ where }: { where: { usuario: { id: string } } }) =>
      Promise.resolve(membresias[where.usuario.id] ?? []),
    ),
  };
  const jwt = new JwtService({ secret: SECRETO });
  const service = new AccesoService(
    accesoRepo as never,
    usuariosRepo as never,
    sedesRepo as never,
    membresiasRepo as never,
    jwt,
    new ClavesQrService({ get: () => undefined } as never),
  );
  return { service, jwt, accesoRepo, sesiones };
}

beforeEach(() => {
  jest.useFakeTimers({ now: AHORA });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('AccesoService.generarQr', () => {
  it('con membresía vigente devuelve token, código de 6 dígitos y expiración de 60 s', async () => {
    const { service, jwt } = armar();
    const r = await service.generarQr('u1');
    expect(r.expiraEn).toBe(60);
    expect(r.codigoCorto).toMatch(/^\d{6}$/);
    const payload = jwt.verify<{ usuarioId: string; tipo: string }>(r.qrToken);
    expect(payload).toMatchObject({ usuarioId: 'u1', tipo: 'qr-acceso' });
  });

  it('el token vence a los 60 segundos exactos de emitido', async () => {
    const { service, jwt } = armar();
    const { qrToken } = await service.generarQr('u1');
    const { iat, exp } = jwt.decode<{ iat: number; exp: number }>(qrToken);
    expect(exp - iat).toBe(60);
  });

  it('vigente + próxima: genera igual (la próxima no molesta)', async () => {
    const { service } = armar({ membresias: { u1: [proxima, vigente] } });
    await expect(service.generarQr('u1')).resolves.toBeDefined();
  });

  it.each([
    ['vencida', [vencida]],
    ['suspendida', [suspendida]],
    ['solo próxima (aún no empezó)', [proxima]],
    ['sin membresías', []],
  ])('%s: 403 y no emite código', async (_n, filas) => {
    const { service } = armar({ membresias: { u1: filas } });
    await expect(service.generarQr('u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('un código de un QR rechazado no queda registrado', async () => {
    const { service } = armar({ membresias: { u1: [vencida] } });
    await expect(service.generarQr('u1')).rejects.toThrow();
    await expect(
      service.validarCodigo('000000', 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usuario inexistente: 404', async () => {
    const { service } = armar();
    await expect(service.generarQr('nadie')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('quien no es socio (externo): 403', async () => {
    const { service } = armar({
      usuarios: {
        e1: { id: 'e1', tipoActor: TipoActor.EXTERNO, activo: true },
      },
    });
    await expect(service.generarQr('e1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('AccesoService.validarIngreso (token)', () => {
  it('token válido: registra el ingreso en la sede', async () => {
    const { service, accesoRepo, sesiones } = armar();
    const { qrToken } = await service.generarQr('u1');
    const r = await service.validarIngreso(qrToken, 'sA', recepA);
    expect(r.usuario).toMatchObject({ id: 'u1' });
    expect(r.sede).toMatchObject({ id: 'sA' });
    expect(r.horaEgreso).toBeNull();
    expect(accesoRepo.save).toHaveBeenCalledTimes(1);
    expect(sesiones).toHaveLength(1);
  });

  it('firma inválida (otro secreto): 400 y no guarda', async () => {
    const { service, accesoRepo } = armar();
    const falso = new JwtService({ secret: 'otro-secreto' }).sign(
      { usuarioId: 'u1', tipo: 'qr-acceso' },
      { expiresIn: '60s' },
    );
    await expect(
      service.validarIngreso(falso, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('token manipulado o basura: 400', async () => {
    const { service } = armar();
    await expect(
      service.validarIngreso('no-es-un-jwt', 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('token vencido (61 s después): 400 y no guarda', async () => {
    const { service, accesoRepo } = armar();
    const { qrToken } = await service.generarQr('u1');
    jest.setSystemTime(new Date(AHORA.getTime() + 61_000));
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('a los 59 s todavía sirve', async () => {
    const { service } = armar();
    const { qrToken } = await service.generarQr('u1');
    jest.setSystemTime(new Date(AHORA.getTime() + 59_000));
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).resolves.toBeDefined();
  });

  it("tipo distinto de 'qr-acceso' (firmado con el mismo secreto): 400", async () => {
    const { service, jwt, accesoRepo } = armar();
    const otro = jwt.sign({ usuarioId: 'u1', tipo: 'sesion' });
    await expect(
      service.validarIngreso(otro, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('token sin campo tipo: 400', async () => {
    const { service, jwt } = armar();
    const sinTipo = jwt.sign({ usuarioId: 'u1' });
    await expect(
      service.validarIngreso(sinTipo, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usuario inexistente: 404', async () => {
    const { service, jwt } = armar();
    const t = jwt.sign({ usuarioId: 'fantasma', tipo: 'qr-acceso' });
    await expect(
      service.validarIngreso(t, 'sA', recepA),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('usuario dado de baja: 400 y no guarda', async () => {
    const { service, jwt, accesoRepo } = armar({
      usuarios: {
        u1: { id: 'u1', tipoActor: TipoActor.SOCIO, activo: false },
      },
    });
    const t = jwt.sign({ usuarioId: 'u1', tipo: 'qr-acceso' });
    await expect(
      service.validarIngreso(t, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('la membresía venció entre la emisión y la validación: 403', async () => {
    const membresias: Record<string, unknown[]> = { u1: [vigente] };
    const { service, accesoRepo } = armar({ membresias });
    const { qrToken } = await service.generarQr('u1');
    membresias.u1 = [vencida];
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('sede inexistente: 404', async () => {
    const { service, jwt } = armar();
    const t = jwt.sign({ usuarioId: 'u1', tipo: 'qr-acceso' });
    await expect(service.validarIngreso(t, 'sZ', gg)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // Un solo uso: cada QR lleva un jti y el servidor recuerda los ya usados
  // hasta que vencen. Una captura de pantalla no sirve para entrar dos veces.
  it('el token QR es de un solo uso: el segundo intento es 409', async () => {
    const { service, sesiones } = armar();
    const { qrToken } = await service.generarQr('u1');
    await service.validarIngreso(qrToken, 'sA', recepA);
    await service.registrarEgreso('u1', recepA);
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(sesiones).toHaveLength(1);
  });

  it('un intento fallido (otra sede) no consume el QR', async () => {
    const { service } = armar();
    const { qrToken } = await service.generarQr('u1');
    await expect(
      service.validarIngreso(qrToken, 'sA', recepB),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).resolves.toBeDefined();
  });

  it('dos lecturas simultáneas del mismo QR: entra una sola', async () => {
    const { service, sesiones } = armar();
    const { qrToken } = await service.generarQr('u1');
    const resultados = await Promise.allSettled([
      service.validarIngreso(qrToken, 'sA', recepA),
      service.validarIngreso(qrToken, 'sA', recepA),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(sesiones).toHaveLength(1);
  });

  it('un QR nuevo del mismo socio sirve después del egreso', async () => {
    const { service } = armar();
    const primero = await service.generarQr('u1');
    await service.validarIngreso(primero.qrToken, 'sA', recepA);
    await service.registrarEgreso('u1', recepA);
    const segundo = await service.generarQr('u1');
    await expect(
      service.validarIngreso(segundo.qrToken, 'sA', recepA),
    ).resolves.toBeDefined();
  });
});

describe('AccesoService.validarCodigo (código corto)', () => {
  it('código válido: registra el ingreso', async () => {
    const { service, sesiones } = armar();
    const { codigoCorto } = await service.generarQr('u1');
    const r = await service.validarCodigo(codigoCorto, 'sA', recepA);
    expect(r.usuario).toMatchObject({ id: 'u1' });
    expect(sesiones).toHaveLength(1);
  });

  it('código inexistente: 400', async () => {
    const { service, accesoRepo } = armar();
    await expect(
      service.validarCodigo('123456', 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('código vencido (61 s): 400 y no guarda', async () => {
    const { service, accesoRepo } = armar();
    const { codigoCorto } = await service.generarQr('u1');
    jest.setSystemTime(new Date(AHORA.getTime() + 61_000));
    await expect(
      service.validarCodigo(codigoCorto, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('un solo uso: el segundo intento falla por código, no por RN01', async () => {
    const { service, sesiones } = armar();
    const { codigoCorto } = await service.generarQr('u1');
    await service.validarCodigo(codigoCorto, 'sA', recepA);
    // Egreso: así RN01 ya no sería un obstáculo; el rechazo es del código.
    await service.registrarEgreso('u1', recepA);
    await expect(
      service.validarCodigo(codigoCorto, 'sA', recepA),
    ).rejects.toThrow('Código inválido o expirado');
    expect(sesiones).toHaveLength(1);
  });

  it('un intento fallido (otra sede) no consume el código', async () => {
    const { service } = armar();
    const { codigoCorto } = await service.generarQr('u1');
    await expect(
      service.validarCodigo(codigoCorto, 'sA', recepB),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.validarCodigo(codigoCorto, 'sA', recepA),
    ).resolves.toBeDefined();
  });

  it('un código por socio: cada código abre a su dueño', async () => {
    const { service } = armar({
      usuarios: {
        u1: { id: 'u1', tipoActor: TipoActor.SOCIO, activo: true },
        u2: { id: 'u2', tipoActor: TipoActor.SOCIO, activo: true },
      },
      membresias: { u1: [vigente], u2: [vigente] },
    });
    const a = await service.generarQr('u1');
    const b = await service.generarQr('u2');
    expect(a.codigoCorto).not.toBe(b.codigoCorto);
    const ra = await service.validarCodigo(a.codigoCorto, 'sA', recepA);
    const rb = await service.validarCodigo(b.codigoCorto, 'sA', recepA);
    expect(ra.usuario).toMatchObject({ id: 'u1' });
    expect(rb.usuario).toMatchObject({ id: 'u2' });
  });
});

describe('RN01: un usuario no puede estar en dos sedes a la vez', () => {
  it('con sesión abierta, un segundo ingreso responde 409 y no guarda otro', async () => {
    const { service, sesiones, accesoRepo } = armar();
    const { qrToken } = await service.generarQr('u1');
    await service.validarIngreso(qrToken, 'sA', recepA);
    const { qrToken: otro } = await service.generarQr('u1');
    await expect(
      service.validarIngreso(otro, 'sA', recepA),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(sesiones).toHaveLength(1);
    expect(accesoRepo.save).toHaveBeenCalledTimes(1);
  });

  it('con sesión abierta en la sede A, ingresar en la sede B también es 409', async () => {
    const { service, sesiones } = armar({
      sesiones: [sesionAbierta('u1', 'sA')],
    });
    const { qrToken } = await service.generarQr('u1');
    await expect(
      service.validarIngreso(qrToken, 'sB', recepB),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(sesiones).toHaveLength(1);
  });

  it('también por código corto', async () => {
    const { service } = armar({ sesiones: [sesionAbierta('u1', 'sA')] });
    const { codigoCorto } = await service.generarQr('u1');
    await expect(
      service.validarCodigo(codigoCorto, 'sB', recepB),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('tras el egreso, el ingreso vuelve a ser posible (incluso en otra sede)', async () => {
    const { service, sesiones } = armar();
    const t1 = await service.generarQr('u1');
    await service.validarIngreso(t1.qrToken, 'sA', recepA);
    await service.registrarEgreso('u1', recepA);
    const t2 = await service.generarQr('u1');
    const r = await service.validarIngreso(t2.qrToken, 'sB', recepB);
    expect(r.sede).toMatchObject({ id: 'sB' });
    expect(sesiones).toHaveLength(2);
    expect(sesiones.filter((s) => !s.horaEgreso)).toHaveLength(1);
  });

  // Dos validaciones simultáneas pueden superar juntas el chequeo de sesión
  // abierta; el índice único parcial de la base rechaza la segunda y el
  // servicio lo traduce a 409 (antes llegaba como 500).
  it('el conflicto por índice único (23505) se traduce a 409', async () => {
    const error23505 = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      {
        driverError: {
          code: '23505',
          constraint: 'uq_acceso_abierto_por_usuario',
        },
      },
    );
    const { service } = armar({ falloAlGuardar: error23505 });
    const { qrToken } = await service.generarQr('u1');
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('otros errores de la base se propagan sin tocar', async () => {
    const otro = new Error('conexión caída');
    const { service } = armar({ falloAlGuardar: otro });
    const { qrToken } = await service.generarQr('u1');
    await expect(service.validarIngreso(qrToken, 'sA', recepA)).rejects.toBe(otro);
  });
});

describe('Aforo', () => {
  it('con la sede llena rechaza el ingreso (409) y no guarda', async () => {
    const { service, accesoRepo } = armar({
      aforoMaximo: 2,
      sesiones: [sesionAbierta('x1', 'sA'), sesionAbierta('x2', 'sA')],
    });
    const { qrToken } = await service.generarQr('u1');
    await expect(service.validarIngreso(qrToken, 'sA', recepA)).rejects.toThrow(
      'aforo máximo',
    );
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('con un lugar libre lo permite', async () => {
    const { service, sesiones } = armar({
      aforoMaximo: 2,
      sesiones: [sesionAbierta('x1', 'sA')],
    });
    const { qrToken } = await service.generarQr('u1');
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).resolves.toBeDefined();
    expect(sesiones).toHaveLength(2);
  });

  it('las sesiones cerradas y las de otra sede no cuentan', async () => {
    const cerrada: Sesion = {
      ...sesionAbierta('x1', 'sA'),
      horaEgreso: new Date(AHORA),
    };
    const { service } = armar({
      aforoMaximo: 1,
      sesiones: [cerrada, sesionAbierta('x2', 'sB')],
    });
    const { qrToken } = await service.generarQr('u1');
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).resolves.toBeDefined();
  });

  it('obtenerAforo devuelve actual y máximo; sede inexistente: 404', async () => {
    const { service } = armar({
      aforoMaximo: 5,
      sesiones: [sesionAbierta('x1', 'sA')],
    });
    await expect(service.obtenerAforo('sA')).resolves.toEqual({
      actual: 1,
      maximo: 5,
    });
    await expect(service.obtenerAforo('sZ')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('Alcance por sede', () => {
  it('un recepcionista de otra sede no puede validar un token: 403 y no guarda', async () => {
    const { service, accesoRepo } = armar();
    const { qrToken } = await service.generarQr('u1');
    await expect(
      service.validarIngreso(qrToken, 'sA', recepB),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('un recepcionista de otra sede no puede validar un código: 403', async () => {
    const { service } = armar();
    const { codigoCorto } = await service.generarQr('u1');
    await expect(
      service.validarCodigo(codigoCorto, 'sA', recepB),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un recepcionista de otra sede no puede registrar el egreso: 403 y la sesión sigue abierta', async () => {
    const { service, sesiones } = armar({
      sesiones: [sesionAbierta('u1', 'sA')],
    });
    await expect(service.registrarEgreso('u1', recepB)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(sesiones[0].horaEgreso).toBeNull();
  });

  it('un recepcionista sin sede asignada no puede validar: 403', async () => {
    const { service } = armar();
    const { qrToken } = await service.generarQr('u1');
    const sinSede = { ...recepA, sedeId: null };
    await expect(
      service.validarIngreso(qrToken, 'sA', sinSede),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el gerente general valida y registra egreso en cualquier sede', async () => {
    const { service, sesiones } = armar();
    const { qrToken } = await service.generarQr('u1');
    await expect(
      service.validarIngreso(qrToken, 'sB', gg),
    ).resolves.toBeDefined();
    await expect(service.registrarEgreso('u1', gg)).resolves.toBeDefined();
    expect(sesiones[0].horaEgreso).not.toBeNull();
  });

  it('un socio no puede validar ingresos: 403', async () => {
    const { service } = armar();
    const { qrToken } = await service.generarQr('u1');
    const socio: UsuarioAutenticado = {
      id: 'u1',
      tipoActor: TipoActor.SOCIO,
      email: 's@x.com',
      sedeId: null,
    };
    await expect(
      service.validarIngreso(qrToken, 'sA', socio),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Egreso', () => {
  it('registra la hora de salida y guarda la sesión', async () => {
    const { service, sesiones, accesoRepo } = armar({
      sesiones: [sesionAbierta('u1', 'sA')],
    });
    jest.setSystemTime(new Date(AHORA.getTime() + 3_600_000));
    const r = await service.registrarEgreso('u1', recepA);
    expect(r.horaEgreso).toEqual(new Date(AHORA.getTime() + 3_600_000));
    expect(sesiones[0].horaEgreso).toEqual(r.horaEgreso);
    expect(accesoRepo.save).toHaveBeenCalledWith(sesiones[0]);
  });

  it('sin sesión abierta falla con un mensaje claro (404) y no guarda', async () => {
    const { service, accesoRepo } = armar();
    const p = service.registrarEgreso('u1', recepA);
    await expect(p).rejects.toBeInstanceOf(NotFoundException);
    await expect(p).rejects.toThrow('no tiene ningún ingreso abierto');
    expect(accesoRepo.save).not.toHaveBeenCalled();
  });

  it('un segundo egreso seguido también falla (la sesión ya está cerrada)', async () => {
    const { service } = armar({ sesiones: [sesionAbierta('u1', 'sA')] });
    await service.registrarEgreso('u1', recepA);
    await expect(service.registrarEgreso('u1', recepA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
