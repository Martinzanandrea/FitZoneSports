import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Sede } from './sede.entity';
import { Instructor } from './instructor.entity';
import { ClaseHorarioSemanal } from './clase-horario-semanal.entity';
import { ClaseOcurrencia } from './clase-ocurrencia.entity';

// Plantilla recurrente de clase (ya no un evento único): define QUÉ se
// dicta, DÓNDE y con QUÉ carga horaria. El CUÁNDO vive en la grilla
// semanal (ClaseHorarioSemanal) y en las ocurrencias generadas.
@Entity('clases')
export class Clase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Sede, (sede) => sede.clases, { nullable: false })
  @JoinColumn({ name: 'sede_id' })
  sede!: Sede;

  @Column({ name: 'tipo_clase', length: 80 })
  tipoClase!: string;

  @ManyToOne(() => Instructor, (instructor) => instructor.clases, {
    nullable: false,
  })
  @JoinColumn({ name: 'instructor_id' })
  instructor!: Instructor;

  @Column('int')
  capacidad!: number;

  @Column('numeric', {
    name: 'horas_semanales_totales',
    precision: 4,
    scale: 1,
  })
  horasSemanalesTotales!: string;

  @Column({ default: true })
  activa!: boolean;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn!: Date;

  @OneToMany(() => ClaseHorarioSemanal, (horario) => horario.clase)
  horariosSemanales!: ClaseHorarioSemanal[];

  @OneToMany(() => ClaseOcurrencia, (ocurrencia) => ocurrencia.clase)
  ocurrencias!: ClaseOcurrencia[];
}
