import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membresia, Usuario, Sede } from '../entities';
import { TipoPlan, EstadoMembresia } from '../entities/enums';
import { CreateMembresiaDto } from './dto/create-membresia.dto';
import { UpdateMembresiaDto } from './dto/update-membresia.dto';
import { Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

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

    const existente = await this.membresiasRepo.findOne({
      where: { usuario: { id: dto.usuarioId }, estado: EstadoMembresia.ACTIVO },
    });
    if (existente) {
      throw new BadRequestException('El usuario ya tiene una membresía activa');
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
      fechaInicio: fechaInicio.toISOString().split('T')[0],
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

  // Usado por otros módulos (canchas, clases) para RN03, y por el
  // endpoint GET /membresias/vigente/:usuarioId. Incluye sedeAlta para
  // que el frontend pueda mostrar dónde se dio de alta sin otra llamada.
  async obtenerMembresiaVigente(usuarioId: string): Promise<Membresia | null> {
    return this.membresiasRepo.findOne({
      where: { usuario: { id: usuarioId } },
      relations: { sedeAlta: true },
      order: { fechaFin: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateMembresiaDto): Promise<Membresia> {
    const membresia = await this.findOne(id);
    Object.assign(membresia, dto);
    return this.membresiasRepo.save(membresia);
  }

  async cancelar(id: string): Promise<Membresia> {
    const membresia = await this.findOne(id);
    membresia.estado = EstadoMembresia.SUSPENDIDO;
    return this.membresiasRepo.save(membresia);
  }

  async renovar(dto: CreateMembresiaDto): Promise<Membresia> {
    const usuario = await this.usuariosRepo.findOne({ where: { id: dto.usuarioId } });
    if (!usuario) throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    const actual = await this.membresiasRepo.findOne({
      where: { usuario: { id: dto.usuarioId }, estado: EstadoMembresia.ACTIVO },
    });
    if (!actual) throw new BadRequestException('No tenés una membresía activa para renovar');

    const sedeAlta = await this.sedesRepo.findOne({ where: { id: dto.sedeAltaId } });
    if (!sedeAlta) throw new NotFoundException(`Sede ${dto.sedeAltaId} no encontrada`);

    const fechaInicio = new Date(actual.fechaFin);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setMonth(fechaFin.getMonth() + DURACION_MESES[dto.plan]);

    const nueva = this.membresiasRepo.create({
      usuario,
      sedeAlta,
      plan: dto.plan,
      renovacionAuto: dto.renovacionAuto ?? false,
      estado: EstadoMembresia.ACTIVO,
      fechaInicio: fechaInicio.toISOString().split('T')[0],
      fechaFin: fechaFin.toISOString().split('T')[0],
    });

    return this.membresiasRepo.save(nueva);
  }
}
