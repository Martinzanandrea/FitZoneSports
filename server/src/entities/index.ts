export * from './enums';
export * from './sede.entity';
export * from './usuario.entity';
export * from './membresia.entity';
export * from './control-acceso.entity';
export * from './instructor.entity';
export * from './clase.entity';
export * from './clase-horario-semanal.entity';
export * from './clase-ocurrencia.entity';
export * from './franja-horaria.entity';
export * from './reserva-clase.entity';
export * from './cancha.entity';
export * from './bloqueo-cancha.entity';
export * from './reserva-cancha.entity';
export * from './pago.entity';
export * from './comprobante.entity';
export * from './precio-plan-entity';
export * from './auditoria.entity';

import { Sede } from './sede.entity';
import { Usuario } from './usuario.entity';
import { Membresia } from './membresia.entity';
import { ControlAcceso } from './control-acceso.entity';
import { Instructor } from './instructor.entity';
import { Clase } from './clase.entity';
import { ClaseHorarioSemanal } from './clase-horario-semanal.entity';
import { ClaseOcurrencia } from './clase-ocurrencia.entity';
import { FranjaHoraria } from './franja-horaria.entity';
import { ReservaClase } from './reserva-clase.entity';
import { Cancha } from './cancha.entity';
import { BloqueoCancha } from './bloqueo-cancha.entity';
import { ReservaCancha } from './reserva-cancha.entity';
import { Pago } from './pago.entity';
import { Comprobante } from './comprobante.entity';
import { PrecioPlan } from './precio-plan-entity';
import { Auditoria } from './auditoria.entity';
export const ALL_ENTITIES = [
  Sede,
  Usuario,
  Membresia,
  ControlAcceso,
  Instructor,
  Clase,
  ClaseHorarioSemanal,
  ClaseOcurrencia,
  FranjaHoraria,
  ReservaClase,
  Cancha,
  BloqueoCancha,
  ReservaCancha,
  Pago,
  Comprobante,
  PrecioPlan,
  Auditoria,
];
