import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FranjaHoraria, Sede } from '../entities';
import { CreateFranjaDto } from './dto/create-franja.dto';

@Injectable()
export class FranjasHorariasService {
  constructor(
    @InjectRepository(FranjaHoraria)
    private readonly franjasRepo: Repository<FranjaHoraria>,
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
  ) {}

  async listarPorSede(sedeId: string): Promise<FranjaHoraria[]> {
    await this.exigirSede(sedeId);
    return this.franjasRepo.find({
      where: { sede: { id: sedeId } },
      order: { apertura: 'ASC' },
    });
  }

  async crear(sedeId: string, dto: CreateFranjaDto): Promise<FranjaHoraria> {
    const sede = await this.exigirSede(sedeId);
    if (dto.apertura >= dto.cierre) {
      throw new BadRequestException(
        'La apertura debe ser anterior al cierre',
      );
    }
    const franja = this.franjasRepo.create({
      sede,
      apertura: dto.apertura,
      cierre: dto.cierre,
    });
    return this.franjasRepo.save(franja);
  }

  async eliminar(sedeId: string, franjaId: string): Promise<void> {
    await this.exigirSede(sedeId);
    const franja = await this.franjasRepo.findOne({
      where: { id: franjaId, sede: { id: sedeId } },
    });
    if (!franja) {
      throw new NotFoundException(
        `Franja ${franjaId} no encontrada en la sede ${sedeId}`,
      );
    }
    await this.franjasRepo.remove(franja);
  }

  private async exigirSede(sedeId: string): Promise<Sede> {
    const sede = await this.sedesRepo.findOne({ where: { id: sedeId } });
    if (!sede) {
      throw new NotFoundException(`Sede ${sedeId} no encontrada`);
    }
    return sede;
  }
}
