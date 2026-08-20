import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  Check,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Membresia } from './membresia.entity';
import { ReservaClase } from './reserva-clase.entity';
import { ReservaCancha } from './reserva-cancha.entity';
import { Comprobante } from './comprobante.entity';
import { EstadoPago, MetodoPago } from './enums';

@Entity('pagos')
// Exclusive arc: exactamente UNA de las 3 referencias debe estar presente.
// Preferido sobre una FK polimórfica (tipo + id) porque acá Postgres SÍ
// valida la existencia real de la fila referenciada en cada caso.
@Check(
  'chk_pago_referencia_unica',
  `(CASE WHEN "membresia_id" IS NOT NULL THEN 1 ELSE 0 END) +
   (CASE WHEN "reserva_clase_id" IS NOT NULL THEN 1 ELSE 0 END) +
   (CASE WHEN "reserva_cancha_id" IS NOT NULL THEN 1 ELSE 0 END) = 1`,
)
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Usuario, (usuario) => usuario.pagos, { nullable: false })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @ManyToOne(() => Membresia, (membresia) => membresia.pagos, {
    nullable: true,
  })
  @JoinColumn({ name: 'membresia_id' })
  membresia?: Membresia;

  @ManyToOne(() => ReservaClase, (reserva) => reserva.pagos, {
    nullable: true,
  })
  @JoinColumn({ name: 'reserva_clase_id' })
  reservaClase?: ReservaClase;

  @ManyToOne(() => ReservaCancha, (reserva) => reserva.pagos, {
    nullable: true,
  })
  @JoinColumn({ name: 'reserva_cancha_id' })
  reservaCancha?: ReservaCancha;

  @Column({ type: 'enum', enum: MetodoPago, enumName: 'metodo_pago' })
  metodo!: MetodoPago;

  @Column('numeric', { precision: 10, scale: 2 })
  monto!: string;

  // RNF02: solo se guarda el token de la pasarela, nunca datos de tarjeta.
  @Column({ name: 'token_pasarela', length: 255 })
  tokenPasarela!: string;

  @Column({
    type: 'enum',
    enum: EstadoPago,
    enumName: 'estado_pago',
    default: EstadoPago.PENDIENTE,
  })
  estado!: EstadoPago;

  @Column({ name: 'pagado_en', type: 'timestamptz', nullable: true })
  pagadoEn?: Date;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @OneToOne(() => Comprobante, (comprobante) => comprobante.pago)
  comprobante?: Comprobante;

  // Getter de conveniencia: infiere el tipo sin duplicar el dato en BD.
  get tipoReferencia(): 'MEMBRESIA' | 'CLASE' | 'CANCHA' {
    if (this.membresia) return 'MEMBRESIA';
    if (this.reservaClase) return 'CLASE';
    return 'CANCHA';
  }
}
