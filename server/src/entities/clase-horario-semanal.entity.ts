import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Clase } from './clase.entity';

// Un renglón de la grilla semanal de una clase (ej. Spinning los
// martes de 19:00 a 20:00). diaSemana: 0 (domingo) a 6 (sábado).
@Entity('clase_horario_semanal')
export class ClaseHorarioSemanal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Clase, (clase) => clase.horariosSemanales, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clase_id' })
  clase!: Clase;

  @Column('smallint', { name: 'dia_semana' })
  diaSemana!: number;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio!: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin!: string;
}
