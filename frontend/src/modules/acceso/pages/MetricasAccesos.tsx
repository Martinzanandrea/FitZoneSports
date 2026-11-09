import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Building2, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { accesoApi } from '../acceso.api';
import type { ResumenAccesos } from '../acceso.types';
import { ProgressBar } from '../../../shared/components/atoms';
import { MetricCard } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

export function MetricasAccesos() {
  useTitulo('Accesos');
  const { user } = useAuth();
  // El backend ya acota el resumen a la sede del GS; solo el GG ve todas.
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  const [resumen, setResumen] = useState<ResumenAccesos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(false);
    accesoApi
      .getResumenAccesos()
      .then(setResumen)
      .catch(() => {
        setResumen(null);
        setError(true);
      })
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totales = useMemo(() => {
    const porSede = resumen?.porSede ?? [];
    return {
      aforoActual: porSede.reduce((acc, s) => acc + s.aforoActual, 0),
      aforoMaximo: porSede.reduce((acc, s) => acc + s.aforoMaximo, 0),
    };
  }, [resumen]);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Métricas de accesos</h2>
          <p>{esGG ? 'Ingresos, egresos y aforo de todas las sedes activas.' : 'Ingresos, egresos y aforo de tu sede.'} Solo lectura.</p>
        </div>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard label="Ingresos hoy" value={resumen ? String(resumen.totalIngresosHoy) : '—'} change="entradas validadas" icon={LogIn} />
        <MetricCard label="Egresos hoy" value={resumen ? String(resumen.totalEgresosHoy) : '—'} change="salidas registradas" icon={LogOut} />
        <MetricCard label="Aforo actual" value={resumen ? `${totales.aforoActual}/${totales.aforoMaximo}` : '—'} change="personas adentro" icon={Activity} />
      </div>

      <section className="glass panel" aria-label="Accesos por sede">
        <SectionHeader title="Por sede" />
        {cargando ? (
          <LoadingState rows={3} label="Cargando métricas" />
        ) : error ? (
          <ErrorState title="No pudimos cargar las métricas de accesos" onRetry={cargar} />
        ) : !resumen || resumen.porSede.length === 0 ? (
          <EmptyState icon={Building2} title="No hay sedes para mostrar" description="Cuando haya sedes activas, vemos acá sus accesos." />
        ) : (
          <div className="stack-list">
            {resumen.porSede.map((s) => {
              const pct = s.aforoMaximo > 0 ? Math.min(100, Math.round((s.aforoActual / s.aforoMaximo) * 100)) : 0;
              const color = pct >= 90 ? '#ff826c' : pct >= 70 ? '#ffd071' : '#caff3d';
              return (
                <div className="list-row" key={s.sedeId} style={{ flexWrap: 'wrap' }}>
                  <div className="row-main" style={{ minWidth: 140 }}>
                    <strong>{s.sede}</strong>
                    <span>
                      Ingresos {s.ingresosHoy} · Egresos {s.egresosHoy}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 180 }}>
                    <strong style={{ whiteSpace: 'nowrap', color: 'var(--text)' }}>
                      {s.aforoActual}/{s.aforoMaximo}
                    </strong>
                    <div style={{ flex: 1, minWidth: 80 }}>
                      <ProgressBar value={pct} color={color} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
