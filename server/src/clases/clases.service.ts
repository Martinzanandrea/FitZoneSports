import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clase, Sede, Instructor } from '../entities';
import { CreateClaseDto } from './dto/create-clase.dto';
import { UpdateClaseDto } from './dto/update-clase.dto';

@Injectable()
export class ClasesService {
  constructor(
    @InjectRepository(Clase)
    private readonly clasesRepo: Repository<Clase>,
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
    @InjectRepository(Instructor)
    private readonly instructoresRepo: Repository<Instructor>,
  ) {}

  async create(dto: CreateClaseDto): Promise<Clase> {
    const sede = await this.sedesRepo.findOne({ where: { id: dto.sedeId } });
    if (!sede) throw new NotFoundException(`Sede ${dto.sedeId} no encontrada`);

    const instructor = await this.instructoresRepo.findOne({
      where: { id: dto.instructorId },
    });
    if (!instructor)
      throw new NotFoundException(
        `Instructor ${dto.instructorId} no encontrado`,
      );

    const clase = this.clasesRepo.create({
      sede,
      instructor,
      tipoClase: dto.tipoClase,
      horarioInicio: new Date(dto.horarioInicio),
      horarioFin: new Date(dto.horarioFin),
      capacidad: dto.capacidad,
    });

    return this.clasesRepo.save(clase);
  }

  findAll(): Promise<Clase[]> {
    return this.clasesRepo.find({
      relations: { sede: true, instructor: true },
    });
  }

  async findOne(id: string): Promise<Clase> {
    const clase = await this.clasesRepo.findOne({
      where: { id },
      relations: { sede: true, instructor: true },
    });
    if (!clase) throw new NotFoundException(`Clase ${id} no encontrada`);
    return clase;
  }

  async update(id: string, dto: UpdateClaseDto): Promise<Clase> {
    const clase = await this.findOne(id);
    Object.assign(clase, dto);
    return this.clasesRepo.save(clase);
  }
}
