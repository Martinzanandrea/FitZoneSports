import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { clasesApi } from '../../clases/clases.api';
import type { Clase } from '../../clases/clases.types';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { Badge } from '../../../shared/components/ui';
import { Select } from '../../../shared/components/Select';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { colorPorTipo } from '../../../shared/utils/colorClase';
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

type Tab = 'ACTIVIDADES' | 'INSTRUCTORES' | 'RECURRENCIA';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'ACTIVIDADES', label: 'Actividades' },
  { id: 'INSTRUCTORES', label: 'Instructores' },
  { id: 'RECURRENCIA', label: 'Recurrencia' },
];

export function ConfiguracionClases() {
  useTitulo('Configurar clases');
  const { user } = useAuth();
  const navigate = useNavigate();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  const [tab, setTab] = useState<Tab>('ACTIVIDADES');
  const [clases, setClases] = useState<Clase[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  // Solo el GG elige sede; el backend ya acota las clases del GS a la suya.
  const [sedeFiltro, setSedeFiltro] = useState('TODAS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!esGG) return;
    sedesApi.getAll(1, 100).then((r) => setSedes(r.data)).catch(() => setSedes([]));
  }, [esGG]);

  useEffect(() => {
    let viva = true;
    setLoading(true);
    setError(false);
    clasesApi
      .getAll(esGG && sedeFiltro !== 'TODAS' ? sedeFiltro : undefined, 1, 100)
      .then((res) => viva && setClases(res.data.filter((c) => c.activa !== false)))
      .catch(() => viva && setError(true))
      .finally(() => viva && setLoading(false));
    return () => {
      viva = false;
    };
  }, [esGG, sedeFiltro, recarga]);

  const porTipo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of clases) mapa.set(c.tipoClase, (mapa.get(c.tipoClase) ?? 0) + 1);
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
  }, [clases]);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Configuración de clases</h2>
          <p>Actividades, instructores y cómo se generan las fechas.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          Volver
        </button>
      </div>

      <div className="segmented" role="tablist" aria-label="Secciones">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ACTIVIDADES' && (
        <section className="glass panel" aria-label="Actividades">
          {esGG && (
            <div className="filters" style={{ boxShadow: 'none', marginBottom: 14 }}>
              <div className="select-field">
                <span className="field-label">SEDE</span>
                <Select
                  value={sedeFiltro}
                  onChange={setSedeFiltro}
                  ariaLabel="Sede"
                  opciones={[{ value: 'TODAS', label: 'Todas las sedes' }, ...sedes.map((s) => ({ value: s.id, label: s.nombre }))]}
                />
              </div>
            </div>
          )}
          <SectionHeader title="Clases activas por tipo" />
          {loading ? (
            <LoadingState rows={3} label="Cargando actividades" />
          ) : error ? (
            <ErrorState title="No pudimos cargar las clases" onRetry={() => setRecarga((n) => n + 1)} />
          ) : porTipo.length === 0 ? (
            <EmptyState icon={BookOpen} title="Todavía no hay tipos de clase" description="Cuando crees una clase, su tipo aparece acá." />
          ) : (
            <div className="stack-list">
              {porTipo.map(([tipo, cantidad]) => {
                const color = colorPorTipo(tipo);
                return (
                  <div className="list-row" key={tipo}>
                    <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: color.borde, flex: 'none' }} />
                    <div className="row-main">
                      <strong>{tipo}</strong>
                    </div>
                    <Badge variant="info">{cantidad} activa(s)</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'INSTRUCTORES' && (
        <EmptyState
          icon={GraduationCap}
          title="Los instructores se gestionan en su propia pantalla"
          description="Altas, datos y clases asignadas por instructor."
          action={
            <Link to="/admin/instructores" className="btn btn-primary">
              Ir a Instructores
            </Link>
          }
        />
      )}

      {tab === 'RECURRENCIA' && (
        <section className="glass panel" aria-label="Recurrencia">
          <SectionHeader title="Cómo se generan las clases" />
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            Las clases son plantillas semanales: al crear una se generan automáticamente sus fechas concretas (ocurrencias) para las próximas 4 semanas, y un proceso automático semanal
            mantiene siempre esa ventana hacia adelante sin que tengas que hacer nada.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6, marginTop: 10 }}>
            Si desactivás una clase, deja de generar fechas nuevas pero lo ya generado y reservado queda intacto. Cada sede tiene una única sala, así que dos clases nunca se superponen en la
            misma sede: el sistema no te deja guardar horarios solapados.
          </p>
        </section>
      )}
    </>
  );
}
