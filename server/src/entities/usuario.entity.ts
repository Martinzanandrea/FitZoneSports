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
import { Sede } from './sede.entity';
import { Membresia } from './membresia.entity';
import { ControlAcceso } from './control-acceso.entity';
import { ReservaClase } from './reserva-clase.entity';
import { ReservaCancha } from './reserva-cancha.entity';
import { Pago } from './pago.entity';
import { Exclude } from 'class-transformer';
import { TipoActor } from './enums';

@Entity('usuarios')
@Check(
  'chk_dni_requerido',
  `"tipo_actor" NOT IN ('SOCIO','EXTERNO') OR "dni" IS NOT NULL`,
)
@Check(
  'chk_password_staff',
  `"tipo_actor" NOT IN ('RECEPCIONISTA','GERENTE') OR "password_hash" IS NOT NULL`,
)
@Check(
  'chk_password_hash_formato',
  `"password_hash" IS NULL OR length("password_hash") >= 50`,
)
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: TipoActor,
    enumName: 'tipo_actor',
    name: 'tipo_actor',
  })
  tipoActor: TipoActor = TipoActor.SOCIO;

  @Column({ length: 20, unique: true, nullable: true })
  dni?: string;

  @Column({ length: 120 })
  nombre!: string;

  @Column({ length: 120 })
  apellido!: string;

  @Column({ length: 160, unique: true, nullable: true })
  email?: string;

  @Column({ length: 30, nullable: true })
  telefono?: string;

  @Column({ name: 'foto_url', type: 'text', nullable: true })
  fotoUrl?: string;

  // Nunca devolver este campo en una respuesta HTTP.
  // Excluirlo con class-transformer (@Exclude()) en el DTO de salida,
  // o directamente con .select(false) / QueryBuilder que no lo traiga.
  @Exclude()
  @Column({
    name: 'password_hash',
    type: 'text',
    nullable: true,
    select: false,
  })
  passwordHash?: string;

  // Sede de trabajo (A3 Recepcionista) o de alta (A2 Externo).
  // NULL para A4 Gerente Central (rol no atado a una sede).
  @ManyToOne(() => Sede, (sede) => sede.usuarios, { nullable: true })
  @JoinColumn({ name: 'sede_id' })
  sede?: Sede;

  @Column({ default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  // --- Relaciones 1:N (lado "1") ---
  @OneToMany(() => Membresia, (membresia) => membresia.usuario)
  membresias!: Membresia[];

  @OneToMany(() => ControlAcceso, (acceso) => acceso.usuario)
  controlesAcceso!: ControlAcceso[];

  @OneToMany(() => ReservaClase, (reserva) => reserva.usuario)
  reservasClase!: ReservaClase[];

  @OneToMany(() => ReservaCancha, (reserva) => reserva.usuario)
  reservasCancha!: ReservaCancha[];

  @OneToMany(() => Pago, (pago) => pago.usuario)
  pagos!: Pago[];
}
