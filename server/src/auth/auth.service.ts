import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuariosService } from '../usuarios/usuarios.service';
import { Usuario } from '../entities';

export interface JwtPayload {
  sub: string;
  tipoActor: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  async validarCredenciales(email: string, password: string): Promise<Usuario> {
    const usuario = await this.usuariosService.findByEmailConPassword(email);

    if (!usuario || !usuario.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const coincide = await bcrypt.compare(password, usuario.passwordHash);
    if (!coincide) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!usuario.activo) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    return usuario;
  }

  generarToken(usuario: Usuario): string {
    const payload: JwtPayload = {
      sub: usuario.id,
      tipoActor: usuario.tipoActor,
      email: usuario.email ?? '',
    };
    return this.jwtService.sign(payload);
  }
}
