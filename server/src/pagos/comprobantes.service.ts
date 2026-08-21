import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comprobante, Pago } from '../entities';

@Injectable()
export class ComprobantesService {
  constructor(
    @InjectRepository(Comprobante)
    private readonly comprobantesRepo: Repository<Comprobante>,
  ) {}

  async generar(pago: Pago): Promise<Comprobante> {
    const pdfPath = `/comprobantes/pago-${pago.id}.pdf`;
    const comprobante = this.comprobantesRepo.create({ pago, pdfPath });
    return this.comprobantesRepo.save(comprobante);
  }
}
