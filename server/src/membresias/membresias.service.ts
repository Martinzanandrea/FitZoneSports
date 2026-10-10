import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Membresia, Usuario, Sede } from '../entities';
import { TipoActor, TipoPlan, EstadoMembresia } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { CreateMembresiaDto } from './dto/create-membresia.dto';
import { UpdateMembresiaDto } from './dto/update-membresia.dto';
import { Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

const DURACION_MESES: Record<TipoPlan, number> = {
  [TipoPlan.MENSUAL]: 1,
  [TipoPlan.TRIMESTRAL]: 3,
  [TipoPlan.ANUAL]: 12,
};

// Una membresía huérfana (sin titular o sede válidos) rompe reservas, precios
// y reportes: se valida acá, además de las FK de la base.
function validarTitularYSede(usuario: Usuario, sede: Sede): void {
  if (
    usuario.tipoActor !== TipoActor.SOCIO &&
    usuario.tipoActor !== TipoActor.EXTERNO
  ) {
    throw new BadRequestException(
      'Solo un socio o un cliente externo puede tener una membresía',
    );
  }
  if (!usuario.activo) {
    throw new BadRequestException(
      'No se puede crear una membresía para un usuario dado de baja',
    );
  }
  if (!sede.activa) {
    throw new BadRequestException(
      'No se puede dar de alta una membresía en una sede inactiva',
    );
  }
}

@Injectable()
export class MembresiasService {
  private readonly logger = new Logger(MembresiasService.name);
  constructor(
    @InjectRepository(Membresia)
    private readonly membresiasRepo: Repository<Membresia>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async marcarVencidasSiCorresponde(): Promise<number> {
    const hoy = new Date().toISOString().split('T')[0];
    const result = await this.membresiasRepo
      .createQueryBuilder()
      .update(Membresia)
      .set({ estado: EstadoMembresia.VENCIDO })
      .where('fecha_fin < :hoy', { hoy })
      .andWhere('estado = :estado', { estado: EstadoMembresia.ACTIVO })
      .execute();

    const cantidad = result.affected ?? 0;
    if (cantidad > 0) {
      this.logger.log(
        `${cantidad} membresía(s) marcadas como vencidas automáticamente`,
      );
    }
    return cantidad;
  }

  // `manager` es obligatorio: una membresía ACTIVO solo se crea dentro de la
  // transacción del pago aprobado (PagosService); no hay camino sin pago.
  async create(dto: CreateMembresiaDto, manager: EntityManager): Promise<Membresia> {
    const usuariosRepo = manager.getRepository(Usuario);
    const sedesRepo = manager.getRepository(Sede);
    const membresiasRepo = manager.getRepository(Membresia);
    const usuario = await usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);
    }

    const existente = await membresiasRepo.findOne({
      where: { usuario: { id: dto.usuarioId }, estado: EstadoMembresia.ACTIVO },
    });
    if (existente) {
      throw new BadRequestException('El usuario ya tiene una membresía activa');
    }

    const sedeAlta = await sedesRepo.findOne({
      where: { id: dto.sedeAltaId },
    });
    if (!sedeAlta) {
      throw new NotFoundException(`Sede ${dto.sedeAltaId} no encontrada`);
    }
    validarTitularYSede(usuario, sedeAlta);

    const fechaInicio = new Date();
    const fechaFin = new Date(fechaInicio);
    fechaFin.setMonth(fechaFin.getMonth() + DURACION_MESES[dto.plan]);

    const membresia = membresiasRepo.create({
      usuario,
      sedeAlta,
      plan: dto.plan,
      renovacionAuto: dto.renovacionAuto ?? false,
      estado: EstadoMembresia.ACTIVO,
      fechaInicio: fechaInicio.toISOString().split('T')[0],
      fechaFin: fechaFin.toISOString().split('T')[0],
    });

    return membresiasRepo.save(membresia);
  }

  async findAll(
    currentUser: UsuarioAutenticado,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Membresia>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser.tipoActor === TipoActor.GERENTE_GENERAL) {
      const [data, total] = await this.membresiasRepo.findAndCount({
        relations: { usuario: true, sedeAlta: true },
        order: { fechaFin: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
    }
    // Cualquiera que no sea GG ve solo su sede (fail-closed).
    if (!currentUser.sedeId) {
      throw new ForbiddenException('Tu usuario no tiene una sede asignada');
    }
    const [data, total] = await this.membresiasRepo.findAndCount({
      where: { sedeAlta: { id: currentUser.sedeId } },
      relations: { usuario: true, sedeAlta: true },
      order: { fechaFin: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async findOne(id: string): Promise<Membresia> {
    const membresia = await this.membresiasRepo.findOne({
      where: { id },
      relations: { usuario: true, sedeAlta: true },
    });
    if (!membresia) {
      throw new NotFoundException(`Membresía ${id} no encontrada`);
    }
    return membresia;
  }

  // Usado por otros módulos (canchas, clases) para RN03, y por el
  // endpoint GET /membresias/vigente/:usuarioId. Incluye sedeAlta para
  // que el frontend pueda mostrar dónde se dio de alta sin otra llamada.
  // Prefiere una fila ACTIVO (ordenada por fechaFin DESC) antes que
  // cualquier otro estado: un plan viejo SUSPENDIDO no debe tapar al
  // MENSUAL ACTIVO que define la tarifa real.
  async obtenerMembresiaVigente(usuarioId: string): Promise<Membresia | null> {
    const activa = await this.membresiasRepo.findOne({
      where: { usuario: { id: usuarioId }, estado: EstadoMembresia.ACTIVO },
      relations: { sedeAlta: true },
      order: { fechaFin: 'DESC' },
    });
    if (activa) return activa;
    return this.membresiasRepo.findOne({
      where: { usuario: { id: usuarioId } },
      relations: { sedeAlta: true },
      order: { fechaFin: 'DESC' },
    });
  }

  // Vista recortada para consulta en mostrador (recepción/gerencia):
  // solo plan, estado y fechas, sin datos de pago. La sede de alta se
  // incluye porque el frontend la muestra ("Sede alta: ...").
  async obtenerEstadoSocio(usuarioId: string): Promise<{
    plan: TipoPlan;
    estado: EstadoMembresia;
    fechaInicio: string;
    fechaFin: string;
    sedeAlta: { id: string; nombre: string };
  } | null> {
    const membresia = await this.obtenerMembresiaVigente(usuarioId);
    if (!membresia) return null;
    return {
      plan: membresia.plan,
      estado: membresia.estado,
      fechaInicio: membresia.fechaInicio,
      fechaFin: membresia.fechaFin,
      sedeAlta: { id: membresia.sedeAlta.id, nombre: membresia.sedeAlta.nombre },
    };
  }

  async update(
    id: string,
    dto: UpdateMembresiaDto,
    currentUser: UsuarioAutenticado,
  ): Promise<Membresia> {
    const membresia = await this.findOne(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      if (!currentUser.sedeId) {
        throw new ForbiddenException('Tu usuario no tiene una sede asignada');
      }
      assertSedeScope(currentUser, membresia.sedeAlta.id);
    }
    Object.assign(membresia, dto);
    return this.membresiasRepo.save(membresia);
  }

  async cancelar(id: string, actor?: UsuarioAutenticado): Promise<Membresia> {
    const membresia = await this.findOne(id);
    // Sin @Roles: el dueño puede cancelar la suya. Si no es el dueño,
    // solo GG, o GS acotado a la sedeAlta. RECEPCIONISTA no puede.
    if (!actor || actor.id !== membresia.usuario.id) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if (!actor || actor.tipoActor === TipoActor.GERENTE_GENERAL) {
        // GG (o llamada interna sin actor): pasa.
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
        if (actor.tipoActor !== TipoActor.GERENTE_SEDE) {
          throw new ForbiddenException(
            'No tenés permisos para cancelar esta membresía',
          );
        }
        if (!actor.sedeId) {
          throw new ForbiddenException('No tenés sede asignada');
        }
        assertSedeScope(actor, membresia.sedeAlta.id);
      }
    }
    membresia.estado = EstadoMembresia.SUSPENDIDO;
    return this.membresiasRepo.save(membresia);
  }

  // Igual que create: solo dentro de la transacción de un pago aprobado.
  async renovar(dto: CreateMembresiaDto, manager: EntityManager): Promise<Membresia> {
    const usuariosRepo = manager.getRepository(Usuario);
    const sedesRepo = manager.getRepository(Sede);
    const membresiasRepo = manager.getRepository(Membresia);
    const usuario = await usuariosRepo.findOne({ where: { id: dto.usuarioId } });
    if (!usuario) throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    const actual = await membresiasRepo.findOne({
      where: { usuario: { id: dto.usuarioId }, estado: EstadoMembresia.ACTIVO },
    });
    if (!actual) throw new BadRequestException('No tenés una membresía activa para renovar');

    const sedeAlta = await sedesRepo.findOne({ where: { id: dto.sedeAltaId } });
    if (!sedeAlta) throw new NotFoundException(`Sede ${dto.sedeAltaId} no encontrada`);
    validarTitularYSede(usuario, sedeAlta);

    const fechaInicio = new Date(actual.fechaFin);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setMonth(fechaFin.getMonth() + DURACION_MESES[dto.plan]);

    const nueva = membresiasRepo.create({
      usuario,
      sedeAlta,
      plan: dto.plan,
      renovacionAuto: dto.renovacionAuto ?? false,
      estado: EstadoMembresia.ACTIVO,
      fechaInicio: fechaInicio.toISOString().split('T')[0],
      fechaFin: fechaFin.toISOString().split('T')[0],
    });

    return membresiasRepo.save(nueva);
  }
}
