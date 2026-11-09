import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sede } from '../entities';
import { TipoActor } from '../entities/enums';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
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

  // Catálogo público para la landing: sedes con sus franjas de apertura
  // (horario de apertura es información pública normal de un gimnasio).
  async findAllPublico(): Promise<Sede[]> {
    return this.sedesRepo.find({
      relations: { franjas: true },
      order: { nombre: 'ASC' },
    });
  }

  // El filtro por sede se aplica SOLO cuando quien llama es GERENTE_SEDE.
  // Socios, externos, recepcionistas y GG ven lo mismo que antes. Un GS
  // sin sedeId es fail-closed: ve vacío.
  async findAll(
    query: PaginationQueryDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<PaginatedResponse<Sede>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser?.tipoActor === TipoActor.GERENTE_SEDE) {
      if (!currentUser.sedeId) {
        return { data: [], total: 0, page, limit, totalPages: 1 };
      }
      const [data, total] = await this.sedesRepo.findAndCount({
        where: { id: currentUser.sedeId },
        skip: (page - 1) * limit,
        take: limit,
      });
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }
    const [data, total] = await this.sedesRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string): Promise<Sede> {
    const sede = await this.sedesRepo.findOne({ where: { id } });
    if (!sede) {
      throw new NotFoundException(`Sede ${id} no encontrada`);
    }
    return sede;
  }

  // Scope por exclusión: si NO es GG, solo su sede. Un GS no puede tocar
  // `activa` (desactivar una sede es solo GG) -> 403.
  async update(
    id: string,
    dto: UpdateSedeDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<Sede> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser && currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      assertSedeScope(currentUser, id);
      if (dto.activa !== undefined) {
        throw new ForbiddenException(
          'Solo GERENTE_GENERAL puede activar o desactivar una sede',
        );
      }
    }
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
