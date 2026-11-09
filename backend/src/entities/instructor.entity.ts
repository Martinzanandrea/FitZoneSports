import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Clase } from './clase.entity';

//@entity('instructores') indica que esta clase representa una entidad de la base de datos llamada "instructores"
//primaryGeneratedColumn('uuid') indica que la columna "id" es una clave primaria generada automáticamente como un UUID
@Entity('instructores')
export class Instructor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  nombre!: string;

  @Column({ length: 120, nullable: true })
  especialidad?: string;

  @Column({ length: 30, nullable: true })
  telefono?: string;

  @Column({ default: true })
  activo!: boolean;

  @OneToMany(() => Clase, (clase) => clase.instructor)
  clases!: Clase[];
}
