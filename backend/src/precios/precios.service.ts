import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrecioPlan } from '../entities';
import { TipoPlan } from '../entities/enums';

@Injectable()
export class PreciosService {
  constructor(
    @InjectRepository(PrecioPlan)
    private readonly preciosRepo: Repository<PrecioPlan>,
  ) {}

  findAll(): Promise<PrecioPlan[]> {
    return this.preciosRepo.find({ order: { plan: 'ASC' } });
  }

  async obtenerPrecio(plan: TipoPlan): Promise<number> {
    const registro = await this.preciosRepo.findOne({ where: { plan } });
    if (!registro) {
      throw new NotFoundException(
        `No hay precio configurado para el plan ${plan}`,
      );
    }
    return Number(registro.precio);
  }

  async actualizarPrecio(plan: TipoPlan, precio: number): Promise<PrecioPlan> {
    let registro = await this.preciosRepo.findOne({ where: { plan } });
    if (!registro) {
      registro = this.preciosRepo.create({ plan, precio: String(precio) });
    } else {
      registro.precio = String(precio);
    }
    return this.preciosRepo.save(registro);
  }
}
