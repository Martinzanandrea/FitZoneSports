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
// Exclusive arc #1: exactamente UNA de las 3 referencias (membresía/clase/cancha).
@Check(
  'chk_pago_referencia_unica',
  `(CASE WHEN "membresia_id" IS NOT NULL THEN 1 ELSE 0 END) +
   (CASE WHEN "reserva_clase_id" IS NOT NULL THEN 1 ELSE 0 END) +
   (CASE WHEN "reserva_cancha_id" IS NOT NULL THEN 1 ELSE 0 END) = 1`,
)
// Exclusive arc #2: EFECTIVO va con registrado_por (sin token);
// MERCADOPAGO/MODO van con token (sin registrado_por).
@Check(
  'chk_pago_metodo_datos',
  `("metodo" = 'EFECTIVO' AND "registrado_por_id" IS NOT NULL AND "token_pasarela" IS NULL)
   OR
   ("metodo" != 'EFECTIVO' AND "token_pasarela" IS NOT NULL AND "registrado_por_id" IS NULL)`,
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

  @ManyToOne(() => ReservaClase, (reserva) => reserva.pagos, { nullable: true })
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

  // Obligatorio solo si metodo != EFECTIVO (ver @Check chk_pago_metodo_datos).
  @Column({ name: 'token_pasarela', length: 255, nullable: true })
  tokenPasarela?: string;

  // Quién (recepcionista/gerente) registró el cobro manual.
  // Obligatorio solo si metodo = EFECTIVO.
  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'registrado_por_id' })
  registradoPor?: Usuario;

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

  get tipoReferencia(): 'MEMBRESIA' | 'CLASE' | 'CANCHA' {
    if (this.membresia) return 'MEMBRESIA';
    if (this.reservaClase) return 'CLASE';
    return 'CANCHA';
  }

  get esPagoManual(): boolean {
    return this.metodo === MetodoPago.EFECTIVO;
  }
}
