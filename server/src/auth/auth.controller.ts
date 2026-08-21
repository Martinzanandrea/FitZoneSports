import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto por IP
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const usuario = await this.authService.validarCredenciales(
      dto.email,
      dto.password,
    );
    const token = this.authService.generarToken(usuario);

    res.cookie('token', token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      tipoActor: usuario.tipoActor,
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token');
    return { message: 'Sesión cerrada' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string; tipoActor: string; email: string }) {
    return user;
  }
}
