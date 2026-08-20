import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Check,
  Index,
} from 'typeorm';
import { Cancha } from './cancha.entity';
import { Usuario } from './usuario.entity';
import { Pago } from './pago.entity';
import { EstadoResCancha, TipoEstrategiaPrecio } from './enums';

@Entity('reservas_cancha')
@Check('chk_horario_reserva_cancha', `"hora_fin" > "hora_inicio"`)
@Index('idx_reservas_cancha_disponibilidad', ['cancha', 'fecha', 'horaInicio'])
// RN02: 2 reservas simultáneas misma cancha/horario -> solo 1 exitosa.
// Índice único PARCIAL: solo restringe filas con estado CONFIRMADA.
@Index('uq_cancha_horario_confirmado', ['cancha', 'fecha', 'horaInicio'], {
  unique: true,
  where: `"estado" = 'CONFIRMADA'`,
})
export class ReservaCancha {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Cancha, (cancha) => cancha.reservas, { nullable: false })
  @JoinColumn({ name: 'cancha_id' })
  cancha!: Cancha;

  @ManyToOne(() => Usuario, (usuario) => usuario.reservasCancha, {
    nullable: false,
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ type: 'date' })
  fecha!: string;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio!: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin!: string;

  @Column({
    name: 'estrategia_precio',
    type: 'enum',
    enum: TipoEstrategiaPrecio,
    enumName: 'tipo_estrategia_precio',
  })
  estrategiaPrecio!: TipoEstrategiaPrecio;

  @Column('numeric', { name: 'precio_final', precision: 10, scale: 2 })
  precioFinal!: string;

  @Column({
    type: 'enum',
    enum: EstadoResCancha,
    enumName: 'estado_res_cancha',
    default: EstadoResCancha.CONFIRMADA,
  })
  estado!: EstadoResCancha;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn!: Date;

  @Column({ name: 'cancelada_en', type: 'timestamptz', nullable: true })
  canceladaEn?: Date;

  @OneToMany(() => Pago, (pago) => pago.reservaCancha)
  pagos!: Pago[];
}
