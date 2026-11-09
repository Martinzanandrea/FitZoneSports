import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { generateKeyPairSync, randomUUID } from 'crypto';
import { AUDITABLE_KEY } from '../auditoria/decorators/auditable.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { EstadoMembresia, TipoActor } from '../entities/enums';
import { AccesoController } from './acceso.controller';
import { AccesoService } from './acceso.service';
import { ClavesQrService } from './claves-qr.service';
import { SincronizarAccesoDto } from './dto/sincronizar-acceso.dto';

// Sin base real: la base es un doble en memoria que respeta los dos índices
// únicos (jti y sesión abierta) y revierte la transacción ante un error.
// "Ahora" queda congelado: 2026-10-09 15:00 en Argentina.
const AHORA = new Date('2026-10-09T18:00:00Z');
const SEG = Math.floor(AHORA.getTime() / 1000);
const SECRETO = 'secreto-solo-para-pruebas';
const SEDE_A = '550e8400-e29b-41d4-a716-446655440001';
const SEDE_B = '550e8400-e29b-41d4-a716-446655440002';
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

const config = (valores: Record<string, string> = {}) =>
  ({ get: (clave: string) => valores[clave] }) as unknown as ConfigService;

const recepA: UsuarioAutenticado = {
  id: 'rec-a',
  tipoActor: TipoActor.RECEPCIONISTA,
  email: 'r@x.com',
  sedeId: SEDE_A,
};

const vigente = {
  id: 'm1',
  estado: EstadoMembresia.ACTIVO,
  fechaInicio: '2026-10-01',
  fechaFin: '2026-11-01',
};
const vencida = {
  id: 'm0',
  estado: EstadoMembresia.VENCIDO,
  fechaInicio: '2026-08-01',
  fechaFin: '2026-09-01',
};

const errorUnique = (constraint: string) =>
  Object.assign(new Error('duplicate key'), { code: '23505', constraint });

interface FilaEvento {
  clientEventId: string;
  sedeId: string;
  usuarioId: string | null;
  qrJti: string | null;
  ocurridoEn: Date;
  estado: string;
  codigo: string;
  mensaje: string | null;
  accesoId: string | null;
}
interface FilaAcceso {
  id: string;
  usuarioId: string;
  sedeId: string;
  horaIngreso: Date;
  sincronizadoEn: Date;
  observacion: string | null;
}

interface Opciones {
  membresias?: unknown[];
  usuarios?: Record<string, unknown>;
  aforoActual?: number;
  aforoMaximo?: number;
  abiertas?: string[];
  conClave?: boolean;
  // Simula una carrera: se ejecuta al abrir cada transacción, ya confirmada.
  antesDeInsertarEvento?: (estado: Estado) => void;
}
interface Estado {
  eventos: FilaEvento[];
  accesos: FilaAcceso[];
  abiertas: Set<string>;
  commits: number;
}

function armar(opts: Opciones = {}) {
  const estado: Estado = {
    eventos: [],
    accesos: [],
    abiertas: new Set(opts.abiertas ?? []),
    commits: 0,
  };
  const instantanea = () => ({
    eventos: [...estado.eventos],
    accesos: [...estado.accesos],
    abiertas: new Set(estado.abiertas),
  });

  const manager = {
    query: jest.fn((sql: string, p: unknown[]) => {
      if (sql.includes('SELECT estado')) {
        const f = estado.eventos.find((e) => e.clientEventId === p[0]);
        return Promise.resolve(
          f ? [{ estado: f.estado, codigo: f.codigo, acceso_id: f.accesoId }] : [],
        );
      }
      if (sql.includes('INSERT INTO eventos_acceso_offline')) {
        if (estado.eventos.some((e) => e.clientEventId === p[0])) {
          return Promise.reject(errorUnique('eventos_acceso_offline_pkey'));
        }
        if (p[3] && estado.eventos.some((e) => e.qrJti === p[3])) {
          return Promise.reject(errorUnique('uq_evento_offline_jti'));
        }
        estado.eventos.push({
          clientEventId: p[0] as string,
          sedeId: p[1] as string,
          usuarioId: p[2] as string | null,
          qrJti: p[3] as string | null,
          ocurridoEn: p[4] as Date,
          estado: p[5] as string,
          codigo: p[6] as string,
          mensaje: p[7] as string | null,
          accesoId: p[8] as string | null,
        });
        return Promise.resolve([]);
      }
      if (sql.includes('INSERT INTO control_acceso')) {
        if (estado.abiertas.has(p[1] as string)) {
          return Promise.reject(errorUnique('uq_acceso_abierto_por_usuario'));
        }
        estado.abiertas.add(p[1] as string);
        estado.accesos.push({
          id: p[0] as string,
          usuarioId: p[1] as string,
          sedeId: p[2] as string,
          horaIngreso: p[3] as Date,
          sincronizadoEn: p[4] as Date,
          observacion: p[5] as string | null,
        });
        return Promise.resolve([]);
      }
      if (sql.includes('UPDATE eventos_acceso_offline')) {
        const f = estado.eventos.find((e) => e.clientEventId === p[0]);
        if (f) f.accesoId = p[1] as string;
        return Promise.resolve([]);
      }
      return Promise.reject(new Error(`SQL inesperado: ${sql}`));
    }),
    transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      // Otro proceso confirma lo suyo justo antes de que empiece esta transacción.
      opts.antesDeInsertarEvento?.(estado);
      const antes = instantanea();
      try {
        const r = await cb(manager);
        estado.commits++;
        return r;
      } catch (err) {
        Object.assign(estado, antes);
        throw err;
      }
    }),
  };

  const accesoRepo = {
    manager,
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, unknown> = {};
      qb.where = () => qb;
      qb.andWhere = () => qb;
      qb.getCount = () => Promise.resolve(opts.aforoActual ?? 0);
      return qb;
    }),
  };
  const usuarios = opts.usuarios ?? {
    [U1]: { id: U1, tipoActor: TipoActor.SOCIO, activo: true },
    [U2]: { id: U2, tipoActor: TipoActor.SOCIO, activo: true },
  };
  const usuariosRepo = {
    findOne: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(usuarios[where.id] ?? null),
    ),
  };
  const sedesRepo = {
    findOne: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        [SEDE_A, SEDE_B].includes(where.id)
          ? { id: where.id, aforoMaximo: opts.aforoMaximo ?? 10 }
          : null,
      ),
    ),
  };
  const membresiasRepo = {
    find: jest.fn(() => Promise.resolve(opts.membresias ?? [vigente])),
  };
  const jwt = new JwtService({ secret: SECRETO });
  const claves =
    opts.conClave === false
      ? new ClavesQrService(config())
      : new ClavesQrService(config({ QR_CLAVE_EFIMERA: 'true' }));
  const service = new AccesoService(
    accesoRepo as never,
    usuariosRepo as never,
    sedesRepo as never,
    membresiasRepo as never,
    jwt,
    claves,
  );

  // Firma un QR como lo haría la API (o uno manipulado): los tiempos son de pared.
  const firmar = (
    payload: Record<string, unknown> = {},
    opcionesFirma: { kid?: string; secret?: string; algorithm?: 'ES256' } = {},
  ) =>
    jwt.sign(
      {
        usuarioId: U1,
        tipo: 'qr-acceso',
        jti: randomUUID(),
        iat: SEG,
        exp: SEG + 60,
        ...payload,
      },
      {
        secret: opcionesFirma.secret ?? (claves.clavePrivada as string),
        algorithm: opcionesFirma.algorithm ?? 'ES256',
        keyid: opcionesFirma.kid ?? claves.publica?.kid,
      },
    );

  return { service, jwt, claves, estado, manager, firmar, usuariosRepo };
}

const evento = (qrToken: string, desplazamientoSeg = 10, id = randomUUID()) => ({
  clientEventId: id,
  qrToken,
  ocurridoEn: new Date(AHORA.getTime() + desplazamientoSeg * 1000).toISOString(),
});
const en = (desdeSeg: number) =>
  new Date(AHORA.getTime() + desdeSeg * 1000).toISOString();

beforeEach(() => {
  jest.useFakeTimers({ now: AHORA });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('AccesoService.sincronizarIngresosOffline', () => {
  it('un QR válido crea el ingreso QR_OFFLINE y deja el evento vinculado', async () => {
    const { service, estado, firmar } = armar();
    const ev = evento(firmar(), -5);
    const { resultados } = await service.sincronizarIngresosOffline(
      SEDE_A,
      [ev],
      recepA,
    );
    expect(resultados).toHaveLength(1);
    expect(resultados[0]).toMatchObject({
      clientEventId: ev.clientEventId,
      estado: 'CREADO',
      codigo: 'OK',
    });
    expect(estado.accesos).toHaveLength(1);
    expect(estado.accesos[0]).toMatchObject({
      usuarioId: U1,
      sedeId: SEDE_A,
      observacion: null,
    });
    expect(estado.accesos[0].horaIngreso.toISOString()).toBe(ev.ocurridoEn);
    expect(estado.accesos[0].sincronizadoEn).toEqual(AHORA);
    expect(resultados[0].accesoId).toBe(estado.accesos[0].id);
    expect(estado.eventos[0]).toMatchObject({
      clientEventId: ev.clientEventId,
      sedeId: SEDE_A,
      usuarioId: U1,
      estado: 'CREADO',
      accesoId: estado.accesos[0].id,
    });
    expect(estado.eventos[0].qrJti).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('los datos salen del token firmado, no del cliente', async () => {
    const { service, estado, firmar } = armar();
    const token = firmar({ usuarioId: U2 });
    await service.sincronizarIngresosOffline(
      SEDE_A,
      [{ ...evento(token), usuarioId: U1 } as never],
      recepA,
    );
    expect(estado.accesos[0].usuarioId).toBe(U2);
  });

  describe('1. idempotencia', () => {
    it('reenviar el mismo evento devuelve lo guardado y no toca nada', async () => {
      const { service, estado, firmar } = armar();
      const ev = evento(firmar());
      const [primero] = (
        await service.sincronizarIngresosOffline(SEDE_A, [ev], recepA)
      ).resultados;
      const commits = estado.commits;
      const [segundo] = (
        await service.sincronizarIngresosOffline(SEDE_A, [ev], recepA)
      ).resultados;
      expect(segundo).toMatchObject({
        clientEventId: ev.clientEventId,
        estado: 'CREADO',
        codigo: 'YA_PROCESADO',
        accesoId: primero.accesoId,
      });
      expect(estado.accesos).toHaveLength(1);
      expect(estado.eventos).toHaveLength(1);
      expect(estado.commits).toBe(commits);
    });

    it('también devuelve el estado guardado de un rechazo', async () => {
      const { service, estado } = armar();
      const ev = evento('no-es-un-jwt');
      await service.sincronizarIngresosOffline(SEDE_A, [ev], recepA);
      const [r] = (
        await service.sincronizarIngresosOffline(SEDE_A, [ev], recepA)
      ).resultados;
      expect(r).toMatchObject({ estado: 'RECHAZADO', codigo: 'YA_PROCESADO' });
      expect(r.accesoId).toBeUndefined();
      expect(estado.eventos).toHaveLength(1);
    });

    it('el mismo clientEventId dos veces en un lote se procesa una sola vez', async () => {
      const { service, estado, firmar } = armar();
      const ev = evento(firmar());
      const { resultados } = await service.sincronizarIngresosOffline(
        SEDE_A,
        [ev, ev],
        recepA,
      );
      expect(resultados.map((r) => r.codigo)).toEqual(['OK', 'YA_PROCESADO']);
      expect(estado.accesos).toHaveLength(1);
    });

    it('una carrera por el mismo clientEventId devuelve lo del ganador, sin 500', async () => {
      let ya = false;
      const { service, estado, firmar } = armar({
        antesDeInsertarEvento: (e) => {
          if (ya) return;
          ya = true;
          e.eventos.push({
            clientEventId: ev.clientEventId,
            sedeId: SEDE_A,
            usuarioId: U1,
            qrJti: randomUUID(),
            ocurridoEn: new Date(),
            estado: 'CREADO',
            codigo: 'OK',
            mensaje: null,
            accesoId: 'ganador',
          });
        },
      });
      const ev = evento(firmar());
      const [r] = (
        await service.sincronizarIngresosOffline(SEDE_A, [ev], recepA)
      ).resultados;
      expect(r).toMatchObject({
        estado: 'CREADO',
        codigo: 'YA_PROCESADO',
        accesoId: 'ganador',
      });
      expect(estado.accesos).toHaveLength(0);
    });
  });

  describe('2. TOKEN_INVALIDO', () => {
    const rechazado = async (
      construir: (a: ReturnType<typeof armar>) => string,
      opts?: Opciones,
    ) => {
      const a = armar(opts);
      const ev = evento(construir(a));
      const { resultados } = await a.service.sincronizarIngresosOffline(
        SEDE_A,
        [ev],
        recepA,
      );
      return { r: resultados[0], estado: a.estado };
    };

    it.each([
      ['basura', () => 'no-es-un-jwt'],
      [
        'alg none',
        () =>
          `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
            JSON.stringify({ usuarioId: U1, tipo: 'qr-acceso', jti: randomUUID(), iat: SEG, exp: SEG + 60 }),
          ).toString('base64url')}.`,
      ],
      [
        'HS256 con JWT_SECRET',
        (a: ReturnType<typeof armar>) =>
          a.jwt.sign({ usuarioId: U1, tipo: 'qr-acceso', jti: randomUUID() }, { expiresIn: '60s' }),
      ],
      [
        'ES256 firmado con otra clave',
        (a: ReturnType<typeof armar>) =>
          a.firmar(
            {},
            {
              secret: generateKeyPairSync('ec', { namedCurve: 'P-256' })
                .privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
            },
          ),
      ],
      [
        'kid desconocido',
        (a: ReturnType<typeof armar>) => a.firmar({}, { kid: 'otro-kid' }),
      ],
      [
        'tipo distinto de qr-acceso',
        (a: ReturnType<typeof armar>) => a.firmar({ tipo: 'sesion' }),
      ],
      [
        'jti que no es UUID',
        (a: ReturnType<typeof armar>) => a.firmar({ jti: 'no-uuid' }),
      ],
      [
        'sin usuarioId',
        (a: ReturnType<typeof armar>) => a.firmar({ usuarioId: undefined }),
      ],
    ])('%s -> RECHAZADO / TOKEN_INVALIDO', async (_n, construir) => {
      const { r, estado } = await rechazado(construir);
      expect(r).toMatchObject({ estado: 'RECHAZADO', codigo: 'TOKEN_INVALIDO' });
      expect(estado.accesos).toHaveLength(0);
      expect(estado.eventos[0]).toMatchObject({
        estado: 'RECHAZADO',
        codigo: 'TOKEN_INVALIDO',
        usuarioId: null,
        qrJti: null,
      });
    });

    it('sin clave ES256 en el servidor todo token es inválido', async () => {
      const a = armar({ conClave: false });
      const token = a.jwt.sign(
        { usuarioId: U1, tipo: 'qr-acceso', jti: randomUUID() },
        { expiresIn: '60s' },
      );
      const { resultados } = await a.service.sincronizarIngresosOffline(
        SEDE_A,
        [evento(token)],
        recepA,
      );
      expect(resultados[0].codigo).toBe('TOKEN_INVALIDO');
    });

    it('ignora solo la expiración: un QR vencido con ocurridoEn dentro de la ventana vale', async () => {
      const { service, firmar } = armar();
      const token = firmar({ iat: SEG - 600, exp: SEG - 540 });
      const ev = { ...evento(token), ocurridoEn: en(-560) };
      const { resultados } = await service.sincronizarIngresosOffline(
        SEDE_A,
        [ev],
        recepA,
      );
      expect(resultados[0]).toMatchObject({ estado: 'CREADO' });
    });
  });

  describe('3. QR_VENCIDO (ventana [iat - 120 s, exp + 120 s])', () => {
    const caso = async (iat: number, exp: number, ocurridoEn: string) => {
      const a = armar();
      const ev = { ...evento(a.firmar({ iat, exp })), ocurridoEn };
      const { resultados } = await a.service.sincronizarIngresosOffline(
        SEDE_A,
        [ev],
        recepA,
      );
      return { r: resultados[0], estado: a.estado };
    };

    it('justo dentro de la tolerancia anterior: vale', async () => {
      expect((await caso(SEG - 600, SEG - 540, en(-600 - 119))).r.estado).toBe('CREADO');
    });
    it('antes de iat - 120 s: rechazado', async () => {
      const { r, estado } = await caso(SEG - 600, SEG - 540, en(-600 - 121));
      expect(r).toMatchObject({ estado: 'RECHAZADO', codigo: 'QR_VENCIDO' });
      expect(estado.eventos[0].usuarioId).toBe(U1);
      expect(estado.accesos).toHaveLength(0);
    });
    it('justo dentro de la tolerancia posterior: vale', async () => {
      expect((await caso(SEG - 600, SEG - 540, en(-540 + 119))).r.estado).toBe('CREADO');
    });
    it('después de exp + 120 s: rechazado', async () => {
      const { r } = await caso(SEG - 600, SEG - 540, en(-540 + 121));
      expect(r).toMatchObject({ estado: 'RECHAZADO', codigo: 'QR_VENCIDO' });
    });
    it('un ocurridoEn muy futuro no se cuela por la ventana', async () => {
      const { r } = await caso(SEG, SEG + 60, en(3600));
      expect(r.codigo).toBe('QR_VENCIDO');
    });
  });

  describe('4. fecha', () => {
    it('de hace más de 72 h: RECHAZADO / FECHA_INVALIDA', async () => {
      const { service, estado, firmar } = armar();
      const hace = SEG - 100 * 3600;
      const ev = { ...evento(firmar({ iat: hace, exp: hace + 60 })), ocurridoEn: en(-100 * 3600 + 10) };
      const { resultados } = await service.sincronizarIngresosOffline(SEDE_A, [ev], recepA);
      expect(resultados[0]).toMatchObject({ estado: 'RECHAZADO', codigo: 'FECHA_INVALIDA' });
      expect(estado.accesos).toHaveLength(0);
    });

    it('de hace 71 h todavía vale', async () => {
      const { service, firmar } = armar();
      const hace = SEG - 71 * 3600;
      const ev = { ...evento(firmar({ iat: hace, exp: hace + 60 })), ocurridoEn: en(-71 * 3600 + 10) };
      const { resultados } = await service.sincronizarIngresosOffline(SEDE_A, [ev], recepA);
      expect(resultados[0].estado).toBe('CREADO');
    });

    it('en el futuro se acota a now() y se anota en observacion', async () => {
      const { service, estado, firmar } = armar();
      const ev = evento(firmar(), 30);
      const { resultados } = await service.sincronizarIngresosOffline(SEDE_A, [ev], recepA);
      expect(resultados[0].estado).toBe('CREADO');
      expect(estado.accesos[0].horaIngreso).toEqual(AHORA);
      expect(estado.accesos[0].observacion).toContain('futuro');
      expect(estado.eventos[0].mensaje).toContain('futuro');
    });
  });

  it('5. usuario inexistente: RECHAZADO / USUARIO_INEXISTENTE', async () => {
    const { service, estado, firmar } = armar({ usuarios: {} });
    const { resultados } = await service.sincronizarIngresosOffline(SEDE_A, [evento(firmar())], recepA);
    expect(resultados[0]).toMatchObject({ estado: 'RECHAZADO', codigo: 'USUARIO_INEXISTENTE' });
    expect(estado.eventos[0].usuarioId).toBeNull();
    expect(estado.accesos).toHaveLength(0);
  });

  describe('6. QR_REUSADO', () => {
    it('el mismo jti con otro clientEventId: CREADO y luego CONFLICTO', async () => {
      const { service, estado, firmar } = armar();
      const token = firmar();
      const a = evento(token, 5);
      const b = evento(token, 6);
      const { resultados } = await service.sincronizarIngresosOffline(SEDE_A, [a, b], recepA);
      expect(resultados[0]).toMatchObject({ estado: 'CREADO' });
      expect(resultados[1]).toMatchObject({ estado: 'CONFLICTO', codigo: 'QR_REUSADO' });
      expect(resultados[1].accesoId).toBeUndefined();
      expect(estado.accesos).toHaveLength(1);
      expect(estado.eventos).toHaveLength(2);
      expect(estado.eventos[1]).toMatchObject({ estado: 'CONFLICTO', codigo: 'QR_REUSADO', qrJti: null });
    });

    it('el 23505 del jti se registra en una transacción nueva (sin 500)', async () => {
      const { service, manager, firmar } = armar();
      const token = firmar();
      await service.sincronizarIngresosOffline(SEDE_A, [evento(token, 5)], recepA);
      const antes = manager.transaction.mock.calls.length;
      await service.sincronizarIngresosOffline(SEDE_A, [evento(token, 6)], recepA);
      // 1 tx abortada + 1 tx corta para registrar el conflicto.
      expect(manager.transaction.mock.calls.length - antes).toBe(2);
    });
  });

  describe('7. ingreso', () => {
    it('membresía vencida al sincronizar: se registra igual, OBSERVADO', async () => {
      const { service, estado, firmar } = armar({ membresias: [vencida] });
      const { resultados } = await service.sincronizarIngresosOffline(SEDE_A, [evento(firmar())], recepA);
      expect(resultados[0]).toMatchObject({ estado: 'OBSERVADO', codigo: 'MEMBRESIA_NO_VIGENTE' });
      expect(resultados[0].accesoId).toBeDefined();
      expect(estado.accesos).toHaveLength(1);
      expect(estado.accesos[0].observacion).toContain('Membresía');
      expect(estado.eventos[0]).toMatchObject({ estado: 'OBSERVADO', accesoId: estado.accesos[0].id });
    });

    it('usuario inactivo al sincronizar: OBSERVADO / MEMBRESIA_NO_VIGENTE', async () => {
      const { service, estado, firmar } = armar({
        usuarios: { [U1]: { id: U1, tipoActor: TipoActor.SOCIO, activo: false } },
      });
      const { resultados } = await service.sincronizarIngresosOffline(SEDE_A, [evento(firmar())], recepA);
      expect(resultados[0]).toMatchObject({ estado: 'OBSERVADO', codigo: 'MEMBRESIA_NO_VIGENTE' });
      expect(estado.accesos).toHaveLength(1);
    });

    it('sede llena: se registra igual, OBSERVADO / AFORO_EXCEDIDO', async () => {
      const { service, estado, firmar } = armar({ aforoActual: 10, aforoMaximo: 10 });
      const { resultados } = await service.sincronizarIngresosOffline(SEDE_A, [evento(firmar())], recepA);
      expect(resultados[0]).toMatchObject({ estado: 'OBSERVADO', codigo: 'AFORO_EXCEDIDO' });
      expect(estado.accesos[0].observacion).toContain('aforo');
    });

    it('membresía y aforo a la vez: el código es el de la membresía y ambos quedan anotados', async () => {
      const { service, estado, firmar } = armar({
        membresias: [vencida],
        aforoActual: 10,
        aforoMaximo: 10,
      });
      const { resultados } = await service.sincronizarIngresosOffline(SEDE_A, [evento(firmar())], recepA);
      expect(resultados[0].codigo).toBe('MEMBRESIA_NO_VIGENTE');
      expect(estado.accesos[0].observacion).toMatch(/Membresía.*aforo/);
    });

    it('sesión abierta: CONFLICTO / SESION_ABIERTA, sin fila en control_acceso y con evento registrado', async () => {
      const { service, estado, manager, firmar } = armar({ abiertas: [U1] });
      const { resultados } = await service.sincronizarIngresosOffline(SEDE_A, [evento(firmar())], recepA);
      expect(resultados[0]).toMatchObject({ estado: 'CONFLICTO', codigo: 'SESION_ABIERTA' });
      expect(resultados[0].accesoId).toBeUndefined();
      expect(estado.accesos).toHaveLength(0);
      expect(estado.eventos).toHaveLength(1);
      expect(estado.eventos[0]).toMatchObject({
        estado: 'CONFLICTO',
        codigo: 'SESION_ABIERTA',
        usuarioId: U1,
        accesoId: null,
      });
      // La tx abortada se revirtió; el resultado entró en otra corta.
      expect(manager.transaction).toHaveBeenCalledTimes(2);
      expect(estado.commits).toBe(1);
    });

    it('dos eventos del mismo usuario: el primero CREADO y el segundo SESION_ABIERTA', async () => {
      const { service, estado, firmar } = armar();
      const { resultados } = await service.sincronizarIngresosOffline(
        SEDE_A,
        [evento(firmar(), 5), evento(firmar(), 8)],
        recepA,
      );
      expect(resultados.map((r) => [r.estado, r.codigo])).toEqual([
        ['CREADO', 'OK'],
        ['CONFLICTO', 'SESION_ABIERTA'],
      ]);
      expect(estado.accesos).toHaveLength(1);
      expect(estado.eventos).toHaveLength(2);
    });
  });

  describe('lote', () => {
    it('procesa por ocurridoEn y responde en el orden del request', async () => {
      const { service, estado, firmar } = armar();
      const tarde = evento(firmar({ usuarioId: U1 }), 20);
      const temprano = evento(firmar({ usuarioId: U2 }), 2);
      const { resultados } = await service.sincronizarIngresosOffline(
        SEDE_A,
        [tarde, temprano],
        recepA,
      );
      expect(resultados.map((r) => r.clientEventId)).toEqual([
        tarde.clientEventId,
        temprano.clientEventId,
      ]);
      expect(estado.eventos.map((e) => e.clientEventId)).toEqual([
        temprano.clientEventId,
        tarde.clientEventId,
      ]);
    });

    it('un lote mixto responde 200 con un resultado por evento', async () => {
      const { service, firmar } = armar();
      const { resultados } = await service.sincronizarIngresosOffline(
        SEDE_A,
        [evento('basura'), evento(firmar(), 5)],
        recepA,
      );
      expect(resultados.map((r) => r.estado)).toEqual(['RECHAZADO', 'CREADO']);
    });

    it('sede ajena: 403', async () => {
      const { service } = armar();
      await expect(
        service.sincronizarIngresosOffline(SEDE_B, [evento('x')], recepA),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sede inexistente: 404', async () => {
      const { service } = armar();
      const gg: UsuarioAutenticado = {
        id: 'gg',
        tipoActor: TipoActor.GERENTE_GENERAL,
        email: 'g@x.com',
        sedeId: null,
      };
      await expect(
        service.sincronizarIngresosOffline(
          '550e8400-e29b-41d4-a716-446655440099',
          [evento('x')],
          gg,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

describe('POST /acceso/sincronizar: roles, auditoría y validación del cuerpo', () => {
  const guard = new RolesGuard(new Reflector());
  const prototipo = AccesoController.prototype as unknown as Record<string, () => unknown>;
  const contexto = (tipoActor: TipoActor) =>
    ({
      getHandler: () => prototipo.sincronizar,
      getClass: () => AccesoController,
      switchToHttp: () => ({ getRequest: () => ({ user: { tipoActor } }) }),
    }) as unknown as ExecutionContext;

  it('RECEPCIONISTA pasa', () => {
    expect(guard.canActivate(contexto(TipoActor.RECEPCIONISTA))).toBe(true);
  });
  it.each([
    TipoActor.GERENTE_SEDE,
    TipoActor.GERENTE_GENERAL,
    TipoActor.SOCIO,
    TipoActor.EXTERNO,
  ])('%s recibe 403', (rol) => {
    expect(() => guard.canActivate(contexto(rol))).toThrow(ForbiddenException);
  });

  it('queda auditado como SINCRONIZACION_ACCESO_OFFLINE', () => {
    expect(Reflect.getMetadata(AUDITABLE_KEY, prototipo.sincronizar)).toEqual({
      accion: 'SINCRONIZACION_ACCESO_OFFLINE',
      entidad: 'ControlAcceso',
    });
  });

  it('responde 200 y delega en el servicio', () => {
    expect(Reflect.getMetadata('__httpCode__', prototipo.sincronizar)).toBe(200);
    const servicio = { sincronizarIngresosOffline: jest.fn().mockReturnValue('r') };
    const dto = plainToInstance(SincronizarAccesoDto, {
      sedeId: SEDE_A,
      eventos: [{ clientEventId: randomUUID(), qrToken: 'x', ocurridoEn: en(0) }],
    });
    expect(new AccesoController(servicio as never).sincronizar(dto, recepA)).toBe('r');
    expect(servicio.sincronizarIngresosOffline).toHaveBeenCalledWith(SEDE_A, dto.eventos, recepA);
  });

  describe('DTO', () => {
    const uno = () => ({ clientEventId: randomUUID(), qrToken: 'tok', ocurridoEn: en(0) });
    const errores = async (cuerpo: object) =>
      validate(plainToInstance(SincronizarAccesoDto, cuerpo));

    it('un lote válido no da errores', async () => {
      expect(await errores({ sedeId: SEDE_A, eventos: [uno()] })).toHaveLength(0);
    });
    it('acepta 100 eventos y rechaza 101', async () => {
      const lote = (n: number) => Array.from({ length: n }, uno);
      expect(await errores({ sedeId: SEDE_A, eventos: lote(100) })).toHaveLength(0);
      expect(await errores({ sedeId: SEDE_A, eventos: lote(101) })).not.toHaveLength(0);
    });
    it('rechaza una lista vacía', async () => {
      expect(await errores({ sedeId: SEDE_A, eventos: [] })).not.toHaveLength(0);
    });
    it.each([
      ['sedeId que no es UUID', { sedeId: 'x', eventos: [uno()] }],
      ['clientEventId que no es UUID', { sedeId: SEDE_A, eventos: [{ ...uno(), clientEventId: 'x' }] }],
      ['qrToken demasiado largo', { sedeId: SEDE_A, eventos: [{ ...uno(), qrToken: 'a'.repeat(2049) }] }],
      ['qrToken vacío', { sedeId: SEDE_A, eventos: [{ ...uno(), qrToken: '' }] }],
      ['ocurridoEn que no es fecha ISO', { sedeId: SEDE_A, eventos: [{ ...uno(), ocurridoEn: 'ayer' }] }],
      ['sin eventos', { sedeId: SEDE_A }],
    ])('rechaza %s', async (_n, cuerpo) => {
      expect(await errores(cuerpo)).not.toHaveLength(0);
    });
  });
});
