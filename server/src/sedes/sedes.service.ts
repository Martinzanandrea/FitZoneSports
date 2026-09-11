import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sede } from '../entities';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';

@Injectable()
export class SedesService {
  constructor(
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
  ) {}

  create(dto: CreateSedeDto): Promise<Sede> {
    const sede = this.sedesRepo.create(dto);
    return this.sedesRepo.save(sede);
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResponse<Sede>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await this.sedesRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async findOne(id: string): Promise<Sede> {
    const sede = await this.sedesRepo.findOne({ where: { id } });
    if (!sede) {
      throw new NotFoundException(`Sede ${id} no encontrada`);
    }
    return sede;
  }

  async update(id: string, dto: UpdateSedeDto): Promise<Sede> {
    const sede = await this.findOne(id); // valida existencia y tira 404 si no está
    Object.assign(sede, dto);
    return this.sedesRepo.save(sede);
  }

  async remove(id: string): Promise<void> {
    const sede = await this.findOne(id);
    // Baja lógica en vez de DELETE físico: una sede con usuarios/reservas
    // asociadas no se puede borrar sin romper integridad referencial.
    sede.activa = false;
    await this.sedesRepo.save(sede);
  }
}
