import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}
 
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto por IP
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión y establecer cookie de autenticación' })
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
      sedeId: usuario.sede?.id ?? null,
    };
  }

  @Post('logout')
  @ApiCookieAuth('token')
  @ApiOperation({ summary: 'Cerrar sesión' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token');
    return { message: 'Sesión cerrada' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiCookieAuth('token')
  @ApiOperation({ summary: 'Obtener el usuario autenticado' })
  me(@CurrentUser() user: { id: string; tipoActor: string; email: string }) {
    return user;
  }
}
