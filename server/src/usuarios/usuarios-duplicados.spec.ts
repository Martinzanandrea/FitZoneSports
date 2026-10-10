import { BadRequestException, ConflictException } from '@nestjs/common';
import { TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { redactarSecretos } from '../auditoria/redactar-secretos.helper';
import { UsuariosService } from './usuarios.service';

// QueryFailedError simulado: lo que TypeORM entrega ante un UNIQUE de Postgres.
const unique = (constraint: string, detail: string) =>
  Object.assign(new Error('duplicate key value violates unique constraint'), {
    driverError: { code: '23505', constraint, detail },
  });

function armar(opts?: {
  existentes?: Array<{ id: string; dni?: string; email?: string }>;
  falla?: unknown;
}) {
  const repo = {
    find: jest.fn().mockResolvedValue(opts?.existentes ?? []),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: object) => ({ ...x })),
    save: jest.fn((x: { id?: string }) =>
      opts?.falla
        ? Promise.reject(opts.falla)
        : Promise.resolve({ id: 'nuevo', ...x }),
    ),
  };
  const storage = { subirArchivo: jest.fn().mockResolvedValue('https://foto') };
  const mail = { enviarVerificacion: jest.fn().mockResolvedValue(undefined) };
  const config = { getOrThrow: jest.fn().mockReturnValue('bucket') };
  const jwt = { sign: jest.fn().mockReturnValue('tok') };
  const service = new UsuariosService(
    repo as never,
    storage as never,
    config as never,
    jwt as never,
    mail as never,
  );
  return { service, repo, storage, mail };
}

const dto = {
  tipoActor: TipoActor.SOCIO,
  dni: '30111222',
  nombre: 'Ana',
  apellido: 'Paz',
  email: 'ana@ejemplo.com',
  password: '12345678',
};
const foto = {
  buffer: Buffer.from('x'),
  originalname: 'f.png',
  mimetype: 'image/png',
};

describe('Alta de usuarios: duplicados', () => {
  it('DNI existente: 409 claro, sin guardar ni subir la foto', async () => {
    const { service, repo, storage } = armar({
      existentes: [{ id: 'otro', dni: '30111222' }],
    });
    const err = await service
      .registrarPublico(dto, foto)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).message).toBe(
      'Ya existe un usuario registrado con ese DNI',
    );
    expect(repo.save).not.toHaveBeenCalled();
    expect(storage.subirArchivo).not.toHaveBeenCalled();
  });

  it('email existente: 409 claro', async () => {
    const { service, repo } = armar({
      existentes: [{ id: 'otro', email: 'ana@ejemplo.com' }],
    });
    await expect(service.registrarPublico(dto)).rejects.toThrow(
      'Ya existe un usuario registrado con ese email',
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each([
    ['usuarios_dni_key', 'Key (dni)=(30111222) already exists.', 'ese DNI'],
    [
      'usuarios_email_key',
      'Key (email)=(ana@ejemplo.com) already exists.',
      'ese email',
    ],
  ])(
    'carrera: el UNIQUE de la base (%s) se traduce a 409 sin filtrar el valor',
    async (c, d, texto) => {
      const { service } = armar({ falla: unique(c, d) });
      const err = await service.registrarPublico(dto).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      const msg = (err as ConflictException).message;
      expect(msg).toContain(texto);
      expect(msg).not.toContain('30111222');
      expect(msg).not.toContain('ana@ejemplo.com');
    },
  );

  it('un error de base que no es de unicidad se relanza tal cual (no se disfraza de 409)', async () => {
    const boom = new Error('conexión caída');
    const { service } = armar({ falla: boom });
    await expect(service.registrarPublico(dto)).rejects.toBe(boom);
  });

  it('alta de personal: mismos 409 (DNI/email y carrera)', async () => {
    const gg: UsuarioAutenticado = {
      id: 'gg',
      tipoActor: TipoActor.GERENTE_GENERAL,
      email: 'g@x.com',
      sedeId: null,
    };
    const staff = { ...dto, tipoActor: TipoActor.RECEPCIONISTA };
    const a = armar({ existentes: [{ id: 'o', email: 'ana@ejemplo.com' }] });
    await expect(a.service.crearStaff(staff, gg)).rejects.toBeInstanceOf(
      ConflictException,
    );
    const b = armar({
      falla: unique('usuarios_email_key', 'Key (email)=(x) already exists.'),
    });
    await expect(b.service.crearStaff(staff, gg)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('cambiar el email a uno ya usado por otro: 409; el propio no cuenta', async () => {
    const { service, repo } = armar({
      existentes: [{ id: 'otro', email: 'nuevo@x.com' }],
    });
    repo.findOne.mockResolvedValue({
      id: 'u1',
      tipoActor: TipoActor.SOCIO,
      email: 'viejo@x.com',
    });
    const yo: UsuarioAutenticado = {
      id: 'u1',
      tipoActor: TipoActor.SOCIO,
      email: 'viejo@x.com',
      sedeId: null,
    };
    await expect(
      service.update('u1', { email: 'nuevo@x.com' }, yo),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('cambiar el DNI: la carrera también da 409', async () => {
    const { service, repo } = armar({
      falla: unique('usuarios_dni_key', 'Key (dni)=(1) already exists.'),
    });
    repo.findOne
      .mockResolvedValueOnce({ id: 'u1', tipoActor: TipoActor.SOCIO })
      .mockResolvedValueOnce(null);
    await expect(service.actualizarDni('u1', '1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('Registro público y alta de personal: roles', () => {
  it('el registro público siempre crea EXTERNO, aunque el body pida otro rol o sede', async () => {
    const { service, repo } = armar();
    await service.registrarPublico({
      ...dto,
      tipoActor: TipoActor.GERENTE_GENERAL,
      sedeId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const creado = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(creado.tipoActor).toBe(TipoActor.EXTERNO);
    expect(creado.sede).toBeUndefined();
  });

  it('el alta de personal no crea Socios ni Externos', async () => {
    const gg: UsuarioAutenticado = {
      id: 'gg',
      tipoActor: TipoActor.GERENTE_GENERAL,
      email: 'g@x.com',
      sedeId: null,
    };
    const { service, repo } = armar();
    await expect(
      service.crearStaff({ ...dto, tipoActor: TipoActor.SOCIO }, gg),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('Logs sin datos personales', () => {
  it('si falla el mail de verificación se registra el id, no el email', async () => {
    const { service, mail } = armar();
    mail.enviarVerificacion.mockRejectedValue(
      new Error('rechazó ana@ejemplo.com'),
    );
    const warn = jest
      .spyOn(
        (service as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    await service.registrarPublico(dto);
    const texto = JSON.stringify(warn.mock.calls);
    expect(texto).toContain('nuevo');
    expect(texto).not.toContain('ana@ejemplo.com');
  });
});

describe('redactarSecretos (auditoría)', () => {
  it('oculta contraseñas y tokens, anidados incluidos, sin tocar el original', () => {
    const body = {
      email: 'a@x.com',
      password: 'secreta',
      passwordActual: 'otra',
      anidado: { token: 'abc', ok: 1 },
      lista: [{ passwordHash: 'h' }],
    };
    const r = redactarSecretos(body);
    expect(r.password).toBe('[REDACTADO]');
    expect(r.passwordActual).toBe('[REDACTADO]');
    expect(r.anidado).toEqual({ token: '[REDACTADO]', ok: 1 });
    expect(r.lista[0].passwordHash).toBe('[REDACTADO]');
    expect(r.email).toBe('a@x.com');
    expect(body.password).toBe('secreta');
  });
});
