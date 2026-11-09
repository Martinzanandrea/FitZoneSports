import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Check,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Sede } from './sede.entity';
import { Pago } from './pago.entity';
import { TipoPlan, EstadoMembresia } from './enums';

@Entity('membresias')
@Check('chk_fechas_membresia', `"fecha_fin" > "fecha_inicio"`)
export class Membresia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Usuario, (usuario) => usuario.membresias, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ type: 'enum', enum: TipoPlan, enumName: 'tipo_plan' })
  plan!: TipoPlan;

  @Column({
    type: 'enum',
    enum: EstadoMembresia,
    enumName: 'estado_membresia',
    default: EstadoMembresia.ACTIVO,
  })
  estado!: EstadoMembresia;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio!: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin!: string;

  @Column({ name: 'renovacion_auto', default: false })
  renovacionAuto!: boolean;

  @ManyToOne(() => Sede, (sede) => sede.membresias, { nullable: false })
  @JoinColumn({ name: 'sede_alta_id' })
  sedeAlta!: Sede;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn!: Date;

  @OneToMany(() => Pago, (pago) => pago.membresia)
  pagos!: Pago[];
}
