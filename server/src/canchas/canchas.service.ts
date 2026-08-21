import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cancha, Sede, BloqueoCancha } from '../entities';
import { CreateCanchaDto } from './dto/create-cancha.dto';
import { UpdateCanchaDto } from './dto/update-cancha.dto';
import { CreateBloqueoDto } from './dto/create-bloqueo.dto';

@Injectable()
export class CanchasService {
  constructor(
    @InjectRepository(Cancha)
    private readonly canchasRepo: Repository<Cancha>,
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
    @InjectRepository(BloqueoCancha)
    private readonly bloqueosRepo: Repository<BloqueoCancha>,
  ) {}

  async create(dto: CreateCanchaDto): Promise<Cancha> {
    const sede = await this.sedesRepo.findOne({ where: { id: dto.sedeId } });
    if (!sede) throw new NotFoundException(`Sede ${dto.sedeId} no encontrada`);

    const cancha = this.canchasRepo.create({
      sede,
      nombre: dto.nombre,
      tipo: dto.tipo,
      costoHoraBase: String(dto.costoHoraBase),
    });
    return this.canchasRepo.save(cancha);
  }

  findAll(): Promise<Cancha[]> {
    return this.canchasRepo.find({ relations: { sede: true } });
  }

  async findOne(id: string): Promise<Cancha> {
    const cancha = await this.canchasRepo.findOne({
      where: { id },
      relations: { sede: true },
    });
    if (!cancha) throw new NotFoundException(`Cancha ${id} no encontrada`);
    return cancha;
  }

  async update(id: string, dto: UpdateCanchaDto): Promise<Cancha> {
    const cancha = await this.findOne(id);
    const { costoHoraBase, ...resto } = dto;
    Object.assign(cancha, resto);
    if (costoHoraBase !== undefined)
      cancha.costoHoraBase = String(costoHoraBase);
    return this.canchasRepo.save(cancha);
  }

  async crearBloqueo(
    canchaId: string,
    dto: CreateBloqueoDto,
  ): Promise<BloqueoCancha> {
    const cancha = await this.findOne(canchaId);
    const bloqueo = this.bloqueosRepo.create({
      cancha,
      desde: new Date(dto.desde),
      hasta: new Date(dto.hasta),
      motivo: dto.motivo,
    });
    return this.bloqueosRepo.save(bloqueo);
  }
}
