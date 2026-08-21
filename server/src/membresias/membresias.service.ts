import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membresia, Usuario, Sede } from '../entities';
import { TipoPlan, EstadoMembresia } from '../entities/enums';
import { CreateMembresiaDto } from './dto/create-membresia.dto';
import { UpdateMembresiaDto } from './dto/update-membresia.dto';
import { Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

// Duración de cada plan en meses. Vive acá porque es lógica de negocio
// de este módulo, no una regla de la base de datos.
const DURACION_MESES: Record<TipoPlan, number> = {
  [TipoPlan.MENSUAL]: 1,
  [TipoPlan.TRIMESTRAL]: 3,
  [TipoPlan.ANUAL]: 12,
};

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
  async create(dto: CreateMembresiaDto): Promise<Membresia> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);
    }

    const sedeAlta = await this.sedesRepo.findOne({
      where: { id: dto.sedeAltaId },
    });
    if (!sedeAlta) {
      throw new NotFoundException(`Sede ${dto.sedeAltaId} no encontrada`);
    }

    const fechaInicio = new Date();
    const fechaFin = new Date(fechaInicio);
    fechaFin.setMonth(fechaFin.getMonth() + DURACION_MESES[dto.plan]);

    const membresia = this.membresiasRepo.create({
      usuario,
      sedeAlta,
      plan: dto.plan,
      renovacionAuto: dto.renovacionAuto ?? false,
      estado: EstadoMembresia.ACTIVO,
      fechaInicio: fechaInicio.toISOString().split('T')[0], // formato DATE (YYYY-MM-DD)
      fechaFin: fechaFin.toISOString().split('T')[0],
    });

    return this.membresiasRepo.save(membresia);
  }

  findAll(): Promise<Membresia[]> {
    return this.membresiasRepo.find({
      relations: { usuario: true, sedeAlta: true },
    });
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

  // Usado por otros módulos (canchas, clases) para aplicar RN03:
  // "cuota vencida => sin descuento, pero puede pagar tarifa externo".
  async obtenerMembresiaVigente(usuarioId: string): Promise<Membresia | null> {
    return this.membresiasRepo.findOne({
      where: { usuario: { id: usuarioId } },
      order: { fechaFin: 'DESC' }, // la más reciente
    });
  }

  async update(id: string, dto: UpdateMembresiaDto): Promise<Membresia> {
    const membresia = await this.findOne(id);
    Object.assign(membresia, dto);
    return this.membresiasRepo.save(membresia);
  }
}
