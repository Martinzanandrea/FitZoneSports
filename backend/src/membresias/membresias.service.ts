import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Membresia, Usuario, Sede } from '../entities';
import { TipoActor, TipoPlan, EstadoMembresia } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { esViolacionExclusion } from '../common/helpers/db-errors.helper';
import { CreateMembresiaDto } from './dto/create-membresia.dto';
import { UpdateMembresiaDto } from './dto/update-membresia.dto';
import {
  estadoEfectivo,
  esProxima,
  hoyArgentina,
  obtenerCadena,
  obtenerProxima,
  obtenerVigente,
  sumarMeses,
} from './vigencia';
import { Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

const DURACION_MESES: Record<TipoPlan, number> = {
  [TipoPlan.MENSUAL]: 1,
  [TipoPlan.TRIMESTRAL]: 3,
  [TipoPlan.ANUAL]: 12,
};

export const MENSAJE_YA_PROGRAMADA =
  'Ya tenés una membresía programada. Podrás comprar otra cuando comience';
export const MENSAJE_SUPERPUESTA =
  'Esa membresía se superpone con otra que ya tenés. Revisá tus fechas e intentá de nuevo';

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

  // Marca VENCIDO las membresías ACTIVO cuyo período terminó (fecha_fin <= hoy;
  // fecha_fin es exclusiva). Es solo higiene del dato: la corrección del
  // sistema NO depende de que este cron se ejecute (en el hosting gratuito
  // puede no correr). Toda decisión de vigencia se toma por fechas en
  // vigencia.ts, así que una fila ACTIVO ya terminada nunca cuenta como vigente.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async marcarVencidasSiCorresponde(): Promise<number> {
    const hoy = hoyArgentina();
    const result = await this.membresiasRepo
      .createQueryBuilder()
      .update(Membresia)
      .set({ estado: EstadoMembresia.VENCIDO })
      .where('fecha_fin <= :hoy', { hoy })
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

  // Única vía de alta (compra y renovación): solo dentro de la transacción de
  // un pago aprobado (PagosService); no hay camino sin pago. Nunca pisa una
  // membresía existente: la nueva empieza en el MAYOR fecha_fin entre las
  // ACTIVO que no terminaron, o hoy (hora argentina) si no hay ninguna.
  // Máximo una vigente y una próxima.
  async alta(
    dto: CreateMembresiaDto,
    manager: EntityManager,
    hoy: string = hoyArgentina(),
  ): Promise<Membresia> {
    const usuariosRepo = manager.getRepository(Usuario);
    const sedesRepo = manager.getRepository(Sede);
    const membresiasRepo = manager.getRepository(Membresia);
    // Bloqueo de la fila del usuario: serializa compras simultáneas del mismo
    // usuario antes de calcular el inicio (la segunda ve lo que dejó la primera).
    const usuario = await usuariosRepo.findOne({
      where: { id: dto.usuarioId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);
    }

    const sedeAlta = await sedesRepo.findOne({
      where: { id: dto.sedeAltaId },
    });
    if (!sedeAlta) {
      throw new NotFoundException(`Sede ${dto.sedeAltaId} no encontrada`);
    }
    validarTitularYSede(usuario, sedeAlta);

    const { proxima, mayorFin } = await obtenerCadena(
      membresiasRepo,
      usuario.id,
      hoy,
    );
    if (proxima) throw new ConflictException(MENSAJE_YA_PROGRAMADA);

    const fechaInicio = mayorFin ?? hoy;
    const fechaFin = sumarMeses(fechaInicio, DURACION_MESES[dto.plan]);

    const membresia = membresiasRepo.create({
      usuario,
      sedeAlta,
      plan: dto.plan,
      renovacionAuto: dto.renovacionAuto ?? false,
      estado: EstadoMembresia.ACTIVO,
      fechaInicio,
      fechaFin,
    });
    return this.guardarTraduciendoSuperposicion(membresiasRepo, membresia);
  }

  // Chequeo previo (sin bloqueo) para rechazar ANTES de cobrar en la pasarela.
  // El chequeo autoritativo, con bloqueo, es el de alta().
  async asegurarSinProxima(usuarioId: string): Promise<void> {
    const proxima = await obtenerProxima(this.membresiasRepo, usuarioId);
    if (proxima) throw new ConflictException(MENSAJE_YA_PROGRAMADA);
  }

  // 23P01 (restricción de exclusión) -> 409 claro, nunca 500.
  private async guardarTraduciendoSuperposicion(
    repo: Repository<Membresia>,
    membresia: Membresia,
  ): Promise<Membresia> {
    try {
      return await repo.save(membresia);
    } catch (err) {
      if (esViolacionExclusion(err)) {
        throw new ConflictException(MENSAJE_SUPERPUESTA);
      }
      throw err;
    }
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

  // Membresía vigente HOY (fecha_inicio <= hoy < fecha_fin, estado ACTIVO), o
  // null. La usan otros módulos (canchas) para RN03 y el descuento de socio.
  async obtenerMembresiaVigente(
    usuarioId: string,
    hoy: string = hoyArgentina(),
  ): Promise<Membresia | null> {
    return obtenerVigente(this.membresiasRepo, usuarioId, hoy, {
      sedeAlta: true,
    });
  }

  // La más reciente que no es "próxima" (para recordar la sede de alta o
  // mostrar una membresía ya terminada o suspendida).
  async obtenerUltimaMembresia(
    usuarioId: string,
    hoy: string = hoyArgentina(),
  ): Promise<Membresia | null> {
    const filas = await this.membresiasRepo.find({
      where: { usuario: { id: usuarioId } },
      relations: { sedeAlta: true },
      order: { fechaFin: 'DESC' },
    });
    return filas.find((m) => !esProxima(m, hoy)) ?? null;
  }

  // Vista recortada para consulta en mostrador y "mi membresía": plan, estado y
  // fechas, sin datos de pago. Los campos de siempre salen de la vigente (si no
  // hay, de la última terminada o suspendida); `proxima` se agrega.
  async obtenerEstadoSocio(
    usuarioId: string,
    hoy: string = hoyArgentina(),
  ): Promise<EstadoSocio | null> {
    const vigente = await obtenerVigente(this.membresiasRepo, usuarioId, hoy, {
      sedeAlta: true,
    });
    const principal =
      vigente ?? (await this.obtenerUltimaMembresia(usuarioId, hoy));
    if (!principal) return null;
    const proxima = await obtenerProxima(this.membresiasRepo, usuarioId, hoy, {
      sedeAlta: true,
    });
    const resumen = (m: Membresia): ResumenMembresia => ({
      plan: m.plan,
      estado: estadoEfectivo(m, hoy),
      fechaInicio: m.fechaInicio,
      fechaFin: m.fechaFin,
      sedeAlta: { id: m.sedeAlta.id, nombre: m.sedeAlta.nombre },
    });
    return { ...resumen(principal), proxima: proxima ? resumen(proxima) : null };
  }

  // PATCH: solo renovacionAuto y un cambio de estado acotado (ACTIVO <->
  // SUSPENDIDO). VENCIDO lo pone el sistema. Reactivar no puede generar
  // superposición ni más de una vigente + una próxima.
  async update(
    id: string,
    dto: UpdateMembresiaDto,
    currentUser: UsuarioAutenticado,
    hoy: string = hoyArgentina(),
  ): Promise<Membresia> {
    const membresia = await this.findOne(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      if (!currentUser.sedeId) {
        throw new ForbiddenException('Tu usuario no tiene una sede asignada');
      }
      assertSedeScope(currentUser, membresia.sedeAlta.id);
    }
    return this.membresiasRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Membresia);
      // Mismo bloqueo por usuario que el alta.
      await manager.getRepository(Usuario).findOne({
        where: { id: membresia.usuario.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (dto.renovacionAuto !== undefined) {
        membresia.renovacionAuto = dto.renovacionAuto;
      }
      if (dto.estado !== undefined && dto.estado !== membresia.estado) {
        await this.aplicarCambioDeEstado(repo, membresia, dto.estado, hoy);
      }
      return this.guardarTraduciendoSuperposicion(repo, membresia);
    });
  }

  private async aplicarCambioDeEstado(
    repo: Repository<Membresia>,
    membresia: Membresia,
    nuevo: EstadoMembresia,
    hoy: string,
  ): Promise<void> {
    if (nuevo === EstadoMembresia.SUSPENDIDO) {
      if (membresia.estado !== EstadoMembresia.ACTIVO) {
        throw new BadRequestException(
          'Solo se puede suspender una membresía activa',
        );
      }
      membresia.estado = EstadoMembresia.SUSPENDIDO;
      return;
    }
    if (nuevo !== EstadoMembresia.ACTIVO) {
      throw new BadRequestException(
        'Estado no permitido: lo vencido lo marca el sistema',
      );
    }
    if (membresia.estado !== EstadoMembresia.SUSPENDIDO) {
      throw new BadRequestException(
        'Solo se puede reactivar una membresía suspendida',
      );
    }
    if (membresia.fechaFin <= hoy) {
      throw new ConflictException(
        'El período de esa membresía ya terminó: no se puede reactivar',
      );
    }
    const delUsuario = await repo.find({
      where: { usuario: { id: membresia.usuario.id } },
    });
    const vivas = delUsuario.filter(
      (o) => o.id !== membresia.id && o.estado !== EstadoMembresia.SUSPENDIDO,
    );
    const seSuperpone = vivas.some(
      (o) =>
        o.fechaInicio < membresia.fechaFin && membresia.fechaInicio < o.fechaFin,
    );
    if (seSuperpone) throw new ConflictException(MENSAJE_SUPERPUESTA);
    const sinTerminar = vivas.filter(
      (o) => o.estado === EstadoMembresia.ACTIVO && o.fechaFin > hoy,
    );
    if (sinTerminar.length >= 2) {
      throw new ConflictException(MENSAJE_YA_PROGRAMADA);
    }
    membresia.estado = EstadoMembresia.ACTIVO;
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
}

export interface ResumenMembresia {
  plan: TipoPlan;
  estado: EstadoMembresia;
  fechaInicio: string;
  fechaFin: string;
  sedeAlta: { id: string; nombre: string };
}

export type EstadoSocio = ResumenMembresia & {
  proxima: ResumenMembresia | null;
};
