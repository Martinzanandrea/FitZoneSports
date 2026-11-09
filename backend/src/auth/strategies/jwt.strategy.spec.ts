import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsuariosService } from '../../usuarios/usuarios.service';

describe('JwtStrategy.validate', () => {
  const usuario = {
    id: 'u1',
    nombre: 'Ana',
    apellido: 'Paz',
    tipoActor: 'SOCIO',
    email: 'ana@fitzone.test',
    activo: true,
    sede: { id: 's1' },
  };
  let findOne: jest.Mock;
  let strategy: JwtStrategy;

  beforeEach(() => {
    findOne = jest.fn().mockResolvedValue(usuario);
    const config = { get: () => 'secreto-de-test' } as unknown as ConfigService;
    strategy = new JwtStrategy(config, {
      findOne,
    } as unknown as UsuariosService);
  });

  it('rechaza un token de QR de acceso sin consultar al usuario', async () => {
    await expect(
      strategy.validate({
        sub: 'u1',
        tipo: 'qr-acceso',
      } as unknown as Parameters<JwtStrategy['validate']>[0]),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('acepta un token de sesión normal', async () => {
    const r = await strategy.validate({
      sub: 'u1',
      tipoActor: 'SOCIO',
      email: 'ana@fitzone.test',
      sedeId: 's1',
    });
    expect(r).toMatchObject({ id: 'u1', sedeId: 's1' });
  });
});
