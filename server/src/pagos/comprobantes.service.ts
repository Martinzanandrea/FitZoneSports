import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Comprobante, Pago } from '../entities';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { PdfGeneratorService } from './comprobantes/pdf-generator.service';

@Injectable()
export class ComprobantesService {
  constructor(
    @InjectRepository(Comprobante)
    private readonly comprobantesRepo: Repository<Comprobante>,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly storageService: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  async generar(pago: Pago): Promise<Comprobante> {
    const bufferPdf = await this.pdfGenerator.generarComprobantePago(pago);

    const pdfPath = await this.storageService.subirArchivo(
      this.config.get<string>('SUPABASE_BUCKET_COMPROBANTES')!,
      bufferPdf,
      'pdf',
      'application/pdf',
    );

    const comprobante = this.comprobantesRepo.create({ pago, pdfPath });
    return this.comprobantesRepo.save(comprobante);
  }
}
