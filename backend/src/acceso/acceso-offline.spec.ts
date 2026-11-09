import type { ExecutionContext } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  createPublicKey,
  createVerify,
  generateKeyPairSync,
  type KeyObject,
} from 'crypto';
import { AUDITABLE_KEY } from '../auditoria/decorators/auditable.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { EstadoMembresia, TipoActor } from '../entities/enums';
import { AccesoController } from './acceso.controller';
import { AccesoService } from './acceso.service';
import { ClavesQrService } from './claves-qr.service';

// Sin base real: repositorios en memoria y JwtService real. "Hoy" queda
// congelado: 2026-10-09 15:00 en Argentina.
const AHORA = new Date('2026-10-09T18:00:00Z');
const SECRETO = 'secreto-solo-para-pruebas';

const config = (valores: Record<string, string> = {}) =>
  ({ get: (clave: string) => valores[clave] }) as unknown as ConfigService;

const parEc = () => generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pemDe = (clave: KeyObject) =>
  clave.export({ type: 'pkcs8', format: 'pem' }) as string;

const base64url = (o: object) =>
  Buffer.from(JSON.stringify(o)).toString('base64url');

const recep = (sedeId: string): UsuarioAutenticado => ({
  id: `rec-${sedeId}`,
  tipoActor: TipoActor.RECEPCIONISTA,
  email: 'r@x.com',
  sedeId,
});
const recepA = recep('sA');
const gg: UsuarioAutenticado = {
  id: 'gg',
  tipoActor: TipoActor.GERENTE_GENERAL,
  email: 'g@x.com',
  sedeId: null,
};

beforeEach(() => {
  jest.useFakeTimers({ now: AHORA });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('ClavesQrService', () => {
  it('con QR_PRIVATE_KEY expone la pública como JWK P-256, sin el componente privado', () => {
    const pem = pemDe(parEc().privateKey);
    const claves = new ClavesQrService(config({ QR_PRIVATE_KEY: pem }));
    expect(claves.disponible).toBe(true);
    expect(claves.publica).toMatchObject({
      alg: 'ES256',
      jwk: { kty: 'EC', crv: 'P-256' },
    });
    expect(claves.publica?.jwk).not.toHaveProperty('d');
  });

  it('acepta el PEM con "\\n" literales además de saltos reales', () => {
    const pem = pemDe(parEc().privateKey);
    const real = new ClavesQrService(config({ QR_PRIVATE_KEY: pem }));
    const literal = new ClavesQrService(
      config({ QR_PRIVATE_KEY: pem.trim().replace(/\n/g, '\\n') }),
    );
    expect(literal.disponible).toBe(true);
    expect(literal.publica).toEqual(real.publica);
  });

  it('el kid por defecto son 8 hex y es estable para la misma clave', () => {
    const pem = pemDe(parEc().privateKey);
    const a = new ClavesQrService(config({ QR_PRIVATE_KEY: pem }));
    const b = new ClavesQrService(config({ QR_PRIVATE_KEY: pem }));
    expect(a.publica?.kid).toMatch(/^[0-9a-f]{8}$/);
    expect(b.publica?.kid).toBe(a.publica?.kid);
    const otra = new ClavesQrService(
      config({ QR_PRIVATE_KEY: pemDe(parEc().privateKey) }),
    );
    expect(otra.publica?.kid).not.toBe(a.publica?.kid);
  });

  it('QR_KEY_ID reemplaza al kid derivado', () => {
    const claves = new ClavesQrService(
      config({
        QR_PRIVATE_KEY: pemDe(parEc().privateKey),
        QR_KEY_ID: 'terminal-2026',
      }),
    );
    expect(claves.publica?.kid).toBe('terminal-2026');
  });

  it('sin clave pero con QR_CLAVE_EFIMERA=true genera un par al arrancar', () => {
    const a = new ClavesQrService(config({ QR_CLAVE_EFIMERA: 'true' }));
    const b = new ClavesQrService(config({ QR_CLAVE_EFIMERA: 'true' }));
    expect(a.disponible).toBe(true);
    expect(a.publica?.alg).toBe('ES256');
    expect(a.publica?.kid).not.toBe(b.publica?.kid);
  });

  it('avisa por log de la clave efímera sin imprimirla', () => {
    const avisos = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const claves = new ClavesQrService(config({ QR_CLAVE_EFIMERA: 'true' }));
    expect(avisos).toHaveBeenCalledTimes(1);
    const texto = String(avisos.mock.calls[0][0]);
    expect(texto).not.toContain('PRIVATE KEY');
    expect(texto).not.toContain(claves.clavePrivada ?? 'x');
    avisos.mockRestore();
  });

  it('sin clave ni bandera queda no disponible', () => {
    const claves = new ClavesQrService(config());
    expect(claves.disponible).toBe(false);
    expect(claves.publica).toBeNull();
    expect(claves.clavePrivada).toBeNull();
  });

  it('QR_CLAVE_EFIMERA distinto de "true" no genera clave', () => {
    expect(
      new ClavesQrService(config({ QR_CLAVE_EFIMERA: 'false' })).disponible,
    ).toBe(false);
  });
});

const membresia = (
  usuario: Record<string, unknown>,
  estado: EstadoMembresia,
  inicio: string,
  fin: string,
) => ({ id: `m-${usuario.id}-${inicio}`, estado, fechaInicio: inicio, fechaFin: fin, usuario });

const ana = {
  id: 'u1',
  nombre: 'Ana',
  apellido: 'Paz',
  tipoActor: TipoActor.SOCIO,
  activo: true,
  dni: '30123456',
  email: 'ana@x.com',
  telefono: '1155550000',
  fotoUrl: 'https://fotos.test/ana.jpg',
};
const beto = { ...ana, id: 'u2', nombre: 'Beto', apellido: 'Gil' };

interface Opciones {
  claves?: ClavesQrService;
  usuarios?: Record<string, unknown>;
  membresias?: unknown[];
  abiertas?: Array<{ usuarioId: string }>;
  jwt?: JwtService;
}

function armar(opts: Opciones = {}) {
  const usuarios = opts.usuarios ?? { u1: ana };
  const vigente = membresia(ana, EstadoMembresia.ACTIVO, '2026-10-01', '2026-11-01');
  const membresias = opts.membresias ?? [vigente];
  const sesiones: Array<{ usuario: { id: string }; sede: { id: string } }> = [];

  const accesoRepo = {
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, unknown> = {};
      qb.select = () => qb;
      qb.where = () => qb;
      qb.andWhere = () => qb;
      qb.getCount = () => Promise.resolve((opts.abiertas ?? []).length + sesiones.length);
      qb.getRawMany = () => Promise.resolve(opts.abiertas ?? []);
      qb.getOne = () => Promise.resolve(null);
      return qb;
    }),
    create: jest.fn((d: { usuario: { id: string }; sede: { id: string } }) => ({
      id: 'ses-1',
      ...d,
    })),
    save: jest.fn((s: never) => Promise.resolve(s)),
  };
  const usuariosRepo = {
    findOne: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(usuarios[where.id] ?? null),
    ),
  };
  const sedesRepo = {
    findOne: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        ['sA', 'sB'].includes(where.id)
          ? { id: where.id, aforoMaximo: 10 }
          : null,
      ),
    ),
  };
  const membresiasRepo = {
    find: jest.fn((_opciones: unknown) => Promise.resolve(membresias)),
  };
  const jwt = opts.jwt ?? new JwtService({ secret: SECRETO });
  const claves = opts.claves ?? new ClavesQrService(config());
  const service = new AccesoService(
    accesoRepo as never,
    usuariosRepo as never,
    sedesRepo as never,
    membresiasRepo as never,
    jwt,
    claves,
  );
  return { service, jwt, claves, accesoRepo, membresiasRepo };
}

const conClave = () =>
  new ClavesQrService(config({ QR_PRIVATE_KEY: pemDe(parEc().privateKey) }));

describe('QR firmado ES256 y HS256', () => {
  it('con clave firma ES256 con el kid en la cabecera, mismo payload y 60 s', async () => {
    const claves = conClave();
    const { service, jwt } = armar({ claves });
    const { qrToken, expiraEn } = await service.generarQr('u1');
    expect(expiraEn).toBe(60);
    const dec = jwt.decode<{
      header: { alg: string; kid: string };
      payload: { usuarioId: string; tipo: string; jti: string; iat: number; exp: number };
    }>(qrToken, { complete: true });
    expect(dec.header).toMatchObject({ alg: 'ES256', kid: claves.publica?.kid });
    expect(dec.payload).toMatchObject({ usuarioId: 'u1', tipo: 'qr-acceso' });
    expect(dec.payload.jti).toBeDefined();
    expect(dec.payload.exp - dec.payload.iat).toBe(60);
  });

  it('el QR ES256 verifica con la pública JWK, sin el servidor', async () => {
    const claves = conClave();
    const { service } = armar({ claves });
    const { qrToken } = await service.generarQr('u1');
    // Lo que haría el terminal: importar el JWK y verificar la firma.
    const [h, p, firma] = qrToken.split('.');
    const ok = createVerify('SHA256')
      .update(`${h}.${p}`)
      .verify(
        { key: createPublicKey({ key: claves.publica!.jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
        Buffer.from(firma, 'base64url'),
      );
    expect(ok).toBe(true);
  });

  it('sin clave el QR sigue firmándose HS256', async () => {
    const { service, jwt } = armar();
    const { qrToken } = await service.generarQr('u1');
    const dec = jwt.decode<{ header: { alg: string; kid?: string } }>(qrToken, {
      complete: true,
    });
    expect(dec.header.alg).toBe('HS256');
    expect(dec.header.kid).toBeUndefined();
  });

  it('valida un ingreso con QR ES256 y lo registra con método QR', async () => {
    const { service, accesoRepo } = armar({ claves: conClave() });
    const { qrToken } = await service.generarQr('u1');
    const r = await service.validarIngreso(qrToken, 'sA', recepA);
    expect(r.sede.id).toBe('sA');
    expect(accesoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ metodoIngreso: 'QR' }),
    );
  });

  it('valida un ingreso con QR HS256 (sin clave)', async () => {
    const { service } = armar();
    const { qrToken } = await service.generarQr('u1');
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).resolves.toBeDefined();
  });

  it('un QR HS256 emitido antes de configurar la clave sigue valiendo con clave', async () => {
    const jwt = new JwtService({ secret: SECRETO });
    const viejo = jwt.sign(
      { usuarioId: 'u1', tipo: 'qr-acceso', jti: 'j-1' },
      { expiresIn: '60s' },
    );
    const { service } = armar({ claves: conClave(), jwt });
    await expect(
      service.validarIngreso(viejo, 'sA', recepA),
    ).resolves.toBeDefined();
  });

  it("rechaza un token con alg 'none'", async () => {
    const { service } = armar({ claves: conClave() });
    const token = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      usuarioId: 'u1',
      tipo: 'qr-acceso',
      jti: 'j-none',
      exp: Math.floor(AHORA.getTime() / 1000) + 60,
    })}.`;
    await expect(
      service.validarIngreso(token, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza otros algoritmos (HS384)', async () => {
    const jwt = new JwtService({ secret: SECRETO });
    const token = jwt.sign(
      { usuarioId: 'u1', tipo: 'qr-acceso', jti: 'j-384' },
      { expiresIn: '60s', algorithm: 'HS384' },
    );
    const { service } = armar({ claves: conClave(), jwt });
    await expect(
      service.validarIngreso(token, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un QR ES256 firmado con otra clave', async () => {
    const claves = conClave();
    const { service, jwt } = armar({ claves });
    const token = jwt.sign(
      { usuarioId: 'u1', tipo: 'qr-acceso', jti: 'j-otra' },
      {
        expiresIn: '60s',
        secret: pemDe(parEc().privateKey),
        algorithm: 'ES256',
        keyid: claves.publica?.kid,
      },
    );
    await expect(
      service.validarIngreso(token, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un QR ES256 si el servidor no tiene clave', async () => {
    const emisor = armar({ claves: conClave() });
    const { qrToken } = await emisor.service.generarQr('u1');
    const { service } = armar();
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza un token HS256 sin tipo 'qr-acceso' (token de sesión)", async () => {
    const jwt = new JwtService({ secret: SECRETO });
    const token = jwt.sign({ sub: 'u1' }, { expiresIn: '60s' });
    const { service } = armar({ jwt });
    await expect(
      service.validarIngreso(token, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza basura y QR vencidos', async () => {
    const { service } = armar({ claves: conClave() });
    await expect(
      service.validarIngreso('no-es-un-jwt', 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
    const { qrToken } = await service.generarQr('u1');
    jest.setSystemTime(new Date(AHORA.getTime() + 61_000));
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mantiene el jti de un solo uso con ES256', async () => {
    const { service } = armar({ claves: conClave() });
    const { qrToken } = await service.generarQr('u1');
    await service.validarIngreso(qrToken, 'sA', recepA);
    await expect(
      service.validarIngreso(qrToken, 'sA', recepA),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('AccesoService.obtenerSnapshot', () => {
  const vigenteAna = membresia(ana, EstadoMembresia.ACTIVO, '2026-10-01', '2026-11-01');
  const proximaAna = membresia(ana, EstadoMembresia.ACTIVO, '2026-11-01', '2026-12-01');
  const proximaBeto = membresia(beto, EstadoMembresia.ACTIVO, '2026-10-20', '2026-11-20');

  it('devuelve el contrato con clave, aforo, dentro y socios', async () => {
    const claves = conClave();
    const { service } = armar({
      claves,
      membresias: [vigenteAna, proximaBeto],
      abiertas: [{ usuarioId: 'u9' }],
    });
    const s = await service.obtenerSnapshot('sA', recepA);
    expect(Object.keys(s).sort()).toEqual(
      ['aforo', 'clave', 'dentro', 'generadoEn', 'socios', 'sedeId', 'venceEn'].sort(),
    );
    expect(s.sedeId).toBe('sA');
    expect(s.clave).toEqual(claves.publica);
    expect(s.aforo).toEqual({ actual: 1, maximo: 10 });
    expect(s.dentro).toEqual(['u9']);
    expect(s.socios).toEqual([
      { id: 'u1', nombre: 'Ana', apellido: 'Paz', desde: '2026-10-01', hasta: '2026-11-01' },
      { id: 'u2', nombre: 'Beto', apellido: 'Gil', desde: '2026-10-20', hasta: '2026-11-20' },
    ]);
  });

  it('venceEn es generadoEn + 24 h', async () => {
    const { service } = armar({ claves: conClave() });
    const s = await service.obtenerSnapshot('sA', recepA);
    expect(s.generadoEn).toBe(AHORA.toISOString());
    expect(new Date(s.venceEn).getTime() - new Date(s.generadoEn).getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
  });

  it('no incluye DNI, email, teléfono, foto ni plan', async () => {
    const { service } = armar({
      claves: conClave(),
      membresias: [{ ...vigenteAna, plan: 'PREMIUM', tipoPlan: 'ANUAL' }],
    });
    const s = await service.obtenerSnapshot('sA', recepA);
    expect(Object.keys(s.socios[0]).sort()).toEqual(
      ['apellido', 'desde', 'hasta', 'id', 'nombre'].sort(),
    );
    const texto = JSON.stringify(s);
    for (const prohibido of ['30123456', 'ana@x.com', '1155550000', 'fotos.test', 'PREMIUM', 'dni', 'email']) {
      expect(texto).not.toContain(prohibido);
    }
  });

  it('un socio con vigente y próxima aparece una sola vez, con la vigente', async () => {
    const { service } = armar({
      claves: conClave(),
      membresias: [vigenteAna, proximaAna],
    });
    const s = await service.obtenerSnapshot('sA', recepA);
    expect(s.socios).toHaveLength(1);
    expect(s.socios[0]).toMatchObject({ desde: '2026-10-01', hasta: '2026-11-01' });
  });

  it('descarta las filas que ya vencieron o no están activas', async () => {
    const vencida = membresia(beto, EstadoMembresia.ACTIVO, '2026-08-01', '2026-09-01');
    const suspendida = membresia(beto, EstadoMembresia.SUSPENDIDO, '2026-10-01', '2026-11-01');
    const { service } = armar({
      claves: conClave(),
      membresias: [vencida, suspendida],
    });
    expect((await service.obtenerSnapshot('sA', recepA)).socios).toEqual([]);
  });

  it('consulta las membresías en una sola query filtrada por la base', async () => {
    const { service, membresiasRepo } = armar({ claves: conClave() });
    await service.obtenerSnapshot('sA', recepA);
    expect(membresiasRepo.find).toHaveBeenCalledTimes(1);
    const where = (
      membresiasRepo.find.mock.calls[0][0] as { where: Record<string, unknown> }
    ).where;
    expect(where).toMatchObject({
      estado: EstadoMembresia.ACTIVO,
      usuario: { activo: true, tipoActor: TipoActor.SOCIO },
    });
    expect(where.fechaFin).toBeDefined();
  });

  it('sede ajena: 403', async () => {
    const { service } = armar({ claves: conClave() });
    await expect(service.obtenerSnapshot('sB', recepA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('sede inexistente: 404', async () => {
    const { service } = armar({ claves: conClave() });
    await expect(service.obtenerSnapshot('sX', gg)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sin clave ES256: 404', async () => {
    const { service } = armar();
    await expect(service.obtenerSnapshot('sA', recepA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('AccesoService.obtenerClavePublica', () => {
  it('devuelve kid, alg y jwk', () => {
    const claves = conClave();
    const { service } = armar({ claves });
    expect(service.obtenerClavePublica()).toEqual({
      kid: claves.publica?.kid,
      alg: 'ES256',
      jwk: claves.publica?.jwk,
    });
  });

  it('sin clave: 404', () => {
    const { service } = armar();
    expect(() => service.obtenerClavePublica()).toThrow(NotFoundException);
  });
});

describe('Endpoints de lectura offline: roles, auditoría y UUID', () => {
  const guard = new RolesGuard(new Reflector());
  const prototipo = AccesoController.prototype as unknown as Record<
    string,
    () => unknown
  >;
  const contexto = (handler: string, tipoActor: TipoActor) =>
    ({
      getHandler: () => prototipo[handler],
      getClass: () => AccesoController,
      switchToHttp: () => ({ getRequest: () => ({ user: { tipoActor } }) }),
    }) as unknown as ExecutionContext;

  describe.each(['obtenerClavePublica', 'obtenerSnapshot'])('%s', (handler) => {
    it.each([TipoActor.RECEPCIONISTA, TipoActor.GERENTE_SEDE])(
      '%s pasa',
      (rol) => {
        expect(guard.canActivate(contexto(handler, rol))).toBe(true);
      },
    );

    it.each([TipoActor.GERENTE_GENERAL, TipoActor.SOCIO, TipoActor.EXTERNO])(
      '%s recibe 403',
      (rol) => {
        expect(() => guard.canActivate(contexto(handler, rol))).toThrow(
          ForbiddenException,
        );
      },
    );
  });

  it('la descarga del snapshot queda auditada', () => {
    expect(
      Reflect.getMetadata(AUDITABLE_KEY, prototipo.obtenerSnapshot),
    ).toEqual({ accion: 'DESCARGA_SNAPSHOT_ACCESO', entidad: 'Sede' });
  });

  it('el controlador delega en el servicio con el usuario autenticado', () => {
    const servicio = {
      obtenerSnapshot: jest.fn().mockReturnValue('snap'),
      obtenerClavePublica: jest.fn().mockReturnValue('clave'),
    };
    const controlador = new AccesoController(servicio as never);
    expect(controlador.obtenerSnapshot('sA', recepA)).toBe('snap');
    expect(servicio.obtenerSnapshot).toHaveBeenCalledWith('sA', recepA);
    expect(controlador.obtenerClavePublica()).toBe('clave');
  });

  it('un sedeId que no es UUID da 400', async () => {
    await expect(
      new ParseUUIDPipe().transform('no-es-uuid', { type: 'param' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
