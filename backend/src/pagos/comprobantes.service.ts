import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Comprobante, Pago } from '../entities';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { PdfGeneratorService } from './comprobantes/pdf-generator.service';

@Injectable()
export class ComprobantesService {
  constructor(
    @InjectRepository(Comprobante)
    private readonly comprobantesRepo: Repository<Comprobante>,
    @InjectRepository(Pago)
    private readonly pagosRepo: Repository<Pago>,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly storageService: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  private get bucket(): string {
    return this.config.get<string>('SUPABASE_BUCKET_COMPROBANTES')!;
  }

  // El PDF necesita cliente, sede, cobrador y reserva/membresía completos: se
  // vuelve a leer el pago (dentro de la misma transacción si hay manager) en vez
  // de confiar en qué relaciones trae quien llama.
  private async pagoCompleto(
    pago: Pago,
    manager?: EntityManager,
  ): Promise<Pago> {
    const repo = manager?.getRepository(Pago) ?? this.pagosRepo;
    const completo = await repo.findOne({
      where: { id: pago.id },
      relations: {
        usuario: true,
        registradoPor: true,
        membresia: { sedeAlta: true },
        reservaCancha: { cancha: { sede: true } },
      },
    });
    return completo ?? pago;
  }

  private async renderizarYSubir(
    pago: Pago,
    manager?: EntityManager,
  ): Promise<string> {
    const completo = await this.pagoCompleto(pago, manager);
    const bufferPdf = await this.pdfGenerator.generarComprobantePago(completo);
    return this.storageService.subirArchivo(
      this.bucket,
      bufferPdf,
      'pdf',
      'application/pdf',
    );
  }

  async generar(pago: Pago, manager?: EntityManager): Promise<Comprobante> {
    const pdfPath = await this.renderizarYSubir(pago, manager);
    const comprobantesRepo =
      manager?.getRepository(Comprobante) ?? this.comprobantesRepo;
    const comprobante = comprobantesRepo.create({ pago, pdfPath });
    return comprobantesRepo.save(comprobante);
  }

  // Rehace el PDF con el diseño actual y actualiza el MISMO registro (no crea
  // otro). Devuelve el path anterior para borrarlo cuando la transacción termine.
  async regenerar(
    existente: Comprobante,
    pago: Pago,
    manager?: EntityManager,
  ): Promise<{ comprobante: Comprobante; pdfPathAnterior: string }> {
    const pdfPathAnterior = existente.pdfPath;
    existente.pdfPath = await this.renderizarYSubir(pago, manager);
    existente.generadoEn = new Date();
    const repo = manager?.getRepository(Comprobante) ?? this.comprobantesRepo;
    const comprobante = await repo.save(existente);
    return { comprobante, pdfPathAnterior };
  }

  // Best-effort: si no se puede borrar, queda un archivo huérfano pero el
  // comprobante ya apunta al nuevo.
  async eliminarArchivo(pdfPath: string): Promise<void> {
    try {
      await this.storageService.eliminarArchivo(this.bucket, pdfPath);
    } catch {
      /* archivo huérfano: no es crítico */
    }
  }
}
