import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoActor } from '../entities/enums';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/resumen')
  @Roles(TipoActor.GERENTE)
  obtenerDashboardResumen() {
    return this.adminService.obtenerDashboardResumen();
  }

  @Get('reservas')
  @Roles(TipoActor.GERENTE)
  obtenerReservas() {
    return this.adminService.obtenerReservas();
  }
}
