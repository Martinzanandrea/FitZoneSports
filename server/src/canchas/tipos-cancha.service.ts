import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cancha, TipoCancha } from '../entities';
import { ConfigService } from '@nestjs/config';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { CreateTipoCanchaDto } from './dto/create-tipo-cancha.dto';
import { UpdateTipoCanchaDto } from './dto/update-tipo-cancha.dto';

@Injectable()
export class TiposCanchaService {
  constructor(
    @InjectRepository(TipoCancha)
    private readonly tiposRepo: Repository<TipoCancha>,
    @InjectRepository(Cancha)
    private readonly canchasRepo: Repository<Cancha>,
    private readonly storageService: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  // Catálogo público para la landing y selectores: solo tipos activos.
  findPublicos(): Promise<TipoCancha[]> {
    return this.tiposRepo.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  // Gestión del Gerente: todos, incluidos inactivos.
  findTodos(): Promise<TipoCancha[]> {
    return this.tiposRepo.find({ order: { nombre: 'ASC' } });
  }

  async create(
    dto: CreateTipoCanchaDto,
    foto?: Express.Multer.File,
  ): Promise<TipoCancha> {
    const nombre = dto.nombre.trim();
    const existente = await this.tiposRepo.findOne({
      where: { nombre },
    });
    if (existente) {
      throw new ConflictException(
        `Ya existe un tipo de cancha con nombre '${nombre}'`,
      );
    }
    const imagenUrl = foto ? await this.subirImagen(foto) : null;
    const tipo = this.tiposRepo.create({
      nombre,
      imagenUrl,
    });
    return this.tiposRepo.save(tipo);
  }

  async update(
    id: string,
    dto: UpdateTipoCanchaDto,
    foto?: Express.Multer.File,
  ): Promise<TipoCancha> {
    const tipo = await this.tiposRepo.findOne({ where: { id } });
    if (!tipo) throw new NotFoundException(`Tipo de cancha ${id} no encontrado`);
    if (dto.nombre !== undefined && dto.nombre.trim() !== tipo.nombre) {
      const nombre = dto.nombre.trim();
      const existente = await this.tiposRepo.findOne({
        where: { nombre },
      });
      if (existente) {
        throw new ConflictException(
          `Ya existe un tipo de cancha con nombre '${nombre}'`,
        );
      }
      tipo.nombre = nombre;
    }
    if (foto) tipo.imagenUrl = await this.subirImagen(foto);
    return this.tiposRepo.save(tipo);
  }

  // "Borrado" seguro: desactivar, nunca DELETE real (las canchas
  // existentes referencian al tipo por FK).
  async cambiarEstado(id: string, activo: boolean): Promise<TipoCancha> {
    const tipo = await this.tiposRepo.findOne({ where: { id } });
    if (!tipo) throw new NotFoundException(`Tipo de cancha ${id} no encontrado`);
    tipo.activo = activo;
    return this.tiposRepo.save(tipo);
  }

  // Borrado real solo si ninguna cancha usa el tipo. Con canchas
  // asociadas se rechaza (la FK lo impediría de todos modos) y se
  // sugiere desactivar en su lugar.
  async eliminar(id: string): Promise<void> {
    const tipo = await this.tiposRepo.findOne({ where: { id } });
    if (!tipo) throw new NotFoundException(`Tipo de cancha ${id} no encontrado`);
    const enUso = await this.canchasRepo.count({
      where: { tipo: { id } },
    });
    if (enUso > 0) {
      throw new BadRequestException(
        `No se puede eliminar: hay ${enUso} cancha(s) usando este tipo. Desactivalo en su lugar.`,
      );
    }
    await this.tiposRepo.remove(tipo);
  }

  private subirImagen(foto: Express.Multer.File): Promise<string> {
    return this.storageService.subirArchivo(
      this.config.getOrThrow<string>('SUPABASE_BUCKET_FOTOS'),
      foto.buffer,
      foto.originalname.split('.').pop() ?? 'jpg',
      foto.mimetype,
    );
  }
}
