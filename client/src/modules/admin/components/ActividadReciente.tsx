import { Activity } from 'lucide-react';
import type { AuditoriaRegistro } from '../admin.api';
import { Badge } from '../../../shared/components/ui';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';

function accionVariant(accion: string) {
  const a = accion.toLowerCase();
  if (a.includes('crear')) return 'success' as const;
  if (a.includes('actualizar') || a.includes('asignar') || a.includes('reasignar')) return 'info' as const;
  if (a.includes('cancelar') || a.includes('desactivar') || a.includes('bloquear') || a.includes('eliminar')) return 'danger' as const;
  if (a.includes('cobrar')) return 'warning' as const;
  return 'neutral' as const;
}

interface Props {
  registros: AuditoriaRegistro[] | null;
  cargando: boolean;
  error: boolean;
  onRetry: () => void;
  description?: string;
}

// Últimos movimientos del registro de auditoría (el backend ya filtra por sede para el GS).
export function ActividadReciente({ registros, cargando, error, onRetry, description }: Props) {
  return (
    <section className="glass panel" aria-label="Actividad reciente">
      <SectionHeader title="Actividad reciente" description={description} />
      {cargando ? (
        <LoadingState rows={3} label="Cargando actividad" />
      ) : error ? (
        <ErrorState title="No pudimos cargar la actividad" onRetry={onRetry} />
      ) : !registros || registros.length === 0 ? (
        <EmptyState icon={Activity} title="Sin actividad reciente" description="Cuando el equipo registre movimientos, aparecen acá." />
      ) : (
        <div className="stack-list">
          {registros.map((r) => (
            <div className="list-row" key={r.id}>
              <div className="row-main">
                <strong>
                  <Badge variant={accionVariant(r.accion)}>{r.accion}</Badge> <span style={{ marginLeft: 6 }}>{r.entidad}</span>
                </strong>
                <span>
                  {r.actor ? `${r.actor.nombre} ${r.actor.apellido}` : 'Sistema'} · {new Date(r.creadoEn).toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
