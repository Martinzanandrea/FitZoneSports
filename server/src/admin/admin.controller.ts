import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/resumen')
  @Roles(TipoActor.GERENTE, TipoActor.RECEPCIONISTA)
  obtenerDashboardResumen(@CurrentUser() user: UsuarioAutenticado) {
    return this.adminService.obtenerDashboardResumen(user);
  }

  @Get('reservas')
  @Roles(TipoActor.GERENTE, TipoActor.RECEPCIONISTA)
  obtenerReservas(@CurrentUser() user: UsuarioAutenticado) {
    return this.adminService.obtenerReservas(user);
  }

  @Get('reportes/financiero')
  @Roles(TipoActor.GERENTE)
  obtenerReporteFinanciero() {
    return this.adminService.obtenerReporteFinanciero();
  }

  @Get('reportes/membresias')
  @Roles(TipoActor.GERENTE)
  obtenerMembresiasPorSede(@Query('sedeId') sedeId?: string) {
    return this.adminService.obtenerMembresiasPorSede(sedeId);
  }

  @Get('reportes/precios-popularidad')
  @Roles(TipoActor.GERENTE)
  obtenerPopularidadPlanes() {
    return this.adminService.obtenerPopularidadPlanes();
  }
}
