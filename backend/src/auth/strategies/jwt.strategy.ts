import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../auth.service';
import { UsuariosService } from '../../usuarios/usuarios.service';

const extraerDeCookie = (req: Request): string | null => {
  return req?.cookies?.['token'] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usuariosService: UsuariosService,
  ) {
    super({
      jwtFromRequest: extraerDeCookie,
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }
  async validate(payload: JwtPayload) {
    const usuario = await this.usuariosService.findOne(payload.sub);
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario inválido o inactivo');
    }
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      tipoActor: usuario.tipoActor,
      email: usuario.email,
      sedeId: usuario.sede?.id ?? null,
    };
  }
}
