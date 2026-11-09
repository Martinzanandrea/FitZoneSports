import { EstadoMembresia as EstadoMembresiaEnum } from '../entities/enums';
import type { Membresia } from '../entities';

// Patrón State: el estado deja de ser un dato que todos consultan
// (membresia.estado === 'ACTIVO' disperso por los servicios) y pasa a
// ser un objeto que decide qué puede hacer cada estado. La columna
// `estado` en Postgres NO se toca: esto es solo una capa de decisión
// en TypeScript sobre ese dato.
export interface EstadoMembresia {
  puedeReservarClases(): boolean;
  tarifaAplicable(): 'SOCIO' | 'EXTERNO';
  puedeGenerarQr(): boolean;
  // Expone el enum persistido, para comparar o guardar sin romper
  // la correspondencia con la columna de la base de datos.
  nombre(): EstadoMembresiaEnum;
}

class EstadoActivo implements EstadoMembresia {
  puedeReservarClases(): boolean {
    return true;
  }
  tarifaAplicable(): 'SOCIO' | 'EXTERNO' {
    return 'SOCIO';
  }
  puedeGenerarQr(): boolean {
    return true;
  }
  nombre(): EstadoMembresiaEnum {
    return EstadoMembresiaEnum.ACTIVO;
  }
}

class EstadoVencido implements EstadoMembresia {
  puedeReservarClases(): boolean {
    return false;
  }
  tarifaAplicable(): 'SOCIO' | 'EXTERNO' {
    return 'EXTERNO';
  }
  puedeGenerarQr(): boolean {
    return false;
  }
  nombre(): EstadoMembresiaEnum {
    return EstadoMembresiaEnum.VENCIDO;
  }
}

class EstadoSuspendido implements EstadoMembresia {
  puedeReservarClases(): boolean {
    return false;
  }
  tarifaAplicable(): 'SOCIO' | 'EXTERNO' {
    return 'EXTERNO';
  }
  puedeGenerarQr(): boolean {
    return false;
  }
  nombre(): EstadoMembresiaEnum {
    return EstadoMembresiaEnum.SUSPENDIDO;
  }
}

export function estadoDesde(membresia: Membresia): EstadoMembresia {
  switch (membresia.estado) {
    case EstadoMembresiaEnum.ACTIVO:
      return new EstadoActivo();
    case EstadoMembresiaEnum.VENCIDO:
      return new EstadoVencido();
    case EstadoMembresiaEnum.SUSPENDIDO:
      return new EstadoSuspendido();
  }
}
