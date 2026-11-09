import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TODOS_LOS_ROLES } from '../auth/roles.constants';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { HistorialPagosService } from './historial-pagos.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Comprobantes')
@ApiCookieAuth('token')
@Controller('comprobantes')
export class ComprobantesController {
  constructor(private readonly historial: HistorialPagosService) {}

  // Entrega el PDF solo a su dueño, al personal de la sede del pago o al GG;
  // 404 en cualquier otro caso. Ver la limitación de la URL pública en
  // HistorialPagosService.obtenerArchivo.
  @Roles(...TODOS_LOS_ROLES)
  @Get(':id/archivo')
  @Header('Content-Type', 'application/pdf')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Descargar el PDF de un comprobante (con control de acceso)',
  })
  @ApiParam({ name: 'id', description: 'UUID del comprobante' })
  async archivo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<StreamableFile> {
    const { buffer } = await this.historial.obtenerArchivo(id, user);
    return new StreamableFile(buffer);
  }
}
