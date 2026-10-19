import { CalendarClock } from 'lucide-react';
import type { MembresiaResumen } from '../membresias.types';
import { formatearDDMMAAAA } from '../../../shared/utils/fechasMembresia';

// Tarjeta secundaria que avisa que ya hay una membresía programada que empieza
// cuando termina la vigente.
export function TarjetaProxima({ proxima }: { proxima: MembresiaResumen }) {
  return (
    <article className="glass panel" aria-label="Próxima membresía">
      <div className="stack-list">
        <div className="list-row">
          <span className="row-icon" aria-hidden>
            <CalendarClock size={20} />
          </span>
          <div className="row-main">
            <strong>Próxima: plan {proxima.plan}</strong>
            <span>Comienza el {formatearDDMMAAAA(proxima.fechaInicio)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
