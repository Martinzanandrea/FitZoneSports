import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Building2, ClipboardList, DollarSign, ScanLine, TrendingUp, Users } from 'lucide-react';
import { adminApi, type AuditoriaRegistro, type MembresiaPorSedeItem, type ReporteFinanciero } from '../admin.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { canchasApi } from '../../canchas/canchas.api';
import { clasesApi } from '../../clases/clases.api';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Chip } from '../../../shared/components/atoms';
import { Pagination } from '../../../shared/components/molecules';
import { formatMoney } from '../../../shared/utils/formatMoney';
import { Select } from '../../../shared/components/atoms';;
import { MetricCard } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { Donut } from '../../../shared/components/atoms';;
import { Ranking } from '../../../shared/components/molecules';;
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

const TAB = { AUDITORIA: 'AUDITORIA', POR_SEDE: 'POR_SEDE' } as const;
type Tab = (typeof TAB)[keyof typeof TAB];

const ENTIDADES = ['Sede', 'Usuario', 'Cancha', 'Clase', 'Pago', 'Membresia', 'PrecioPlan', 'Instructor'];

function accionVariant(accion: string) {
  const a = accion.toLowerCase();
  if (a.includes('crear')) return 'success' as const;
  if (a.includes('actualizar') || a.includes('asignar')) return 'info' as const;
  if (a.includes('cancelar') || a.includes('desactivar') || a.includes('bloquear')) return 'danger' as const;
  return 'neutral' as const;
}

interface DetalleSede {
  financiero: { total: number; sede: string } | null;
  membresias: MembresiaPorSedeItem | null;
  counts: { canchas: number; clases: number } | null;
  parcial: boolean;
}

export function Reportes() {
  useTitulo('Reportes');
  const { user } = useAuth();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  // El GS tiene la sede fija: nunca se le pide al backend otra (evita el 403).
  const sedeFija = esGG ? null : user?.sedeId ?? null;

  const [tab, setTab] = useState<Tab>(TAB.AUDITORIA);

  // Auditoría
  const [regs, setRegs] = useState<AuditoriaRegistro[]>([]);
  const [entidad, setEntidad] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [loadingA, setLoadingA] = useState(true);
  const [errA, setErrA] = useState(false);
  const [pageA, setPageA] = useState(1);
  const [totalPagesA, setTotalPagesA] = useState(1);

  // Resumen general y por sede
  const [finGeneral, setFinGeneral] = useState<ReporteFinanciero | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedeElegida, setSedeElegida] = useState('');
  const sedeId = sedeFija ?? sedeElegida;
  const [detalle, setDetalle] = useState<DetalleSede | null>(null);
  const [loadingS, setLoadingS] = useState(false);
  const [errS, setErrS] = useState(false);
  const [recargaS, setRecargaS] = useState(0);

  const cargarAuditoria = useCallback(
    (pagina: number) => {
      setLoadingA(true);
      setErrA(false);
      adminApi
        .getAuditoria({ entidad: entidad || undefined, desde: desde || undefined, hasta: hasta || undefined }, pagina)
        .then((res) => {
          setRegs(res.data);
          setTotalPagesA(res.totalPages);
        })
        .catch(() => setErrA(true))
        .finally(() => setLoadingA(false));
    },
    [entidad, desde, hasta],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarAuditoria(1);
    adminApi.getReporteFinanciero().then(setFinGeneral).catch(() => setFinGeneral(null));
    // Solo al montar; los filtros se aplican con el botón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Solo el GG elige sede; el GS no necesita el catálogo.
    if (!esGG) return;
    sedesApi
      .getAll(1, 100)
      .then((res) => {
        setSedes(res.data);
        setSedeElegida((actual) => actual || res.data[0]?.id || '');
      })
      .catch(() => setSedes([]));
  }, [esGG]);

  useEffect(() => {
    if (!sedeId || tab !== TAB.POR_SEDE) return;
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingS(true);
    setErrS(false);
    Promise.allSettled([
      adminApi.getReporteFinanciero(),
      adminApi.getMembresiasPorSede(sedeId),
      canchasApi.getAll(1, 100),
      clasesApi.getAll(sedeId, 1, 100),
    ]).then(([fin, memb, canchas, clases]) => {
      if (!viva) return;
      if (fin.status === 'rejected' && memb.status === 'rejected') {
        setErrS(true);
        setLoadingS(false);
        return;
      }
      const financiero =
        fin.status === 'fulfilled'
          ? (() => {
              const porSede = fin.value.porSede.find((x) => x.sedeId === sedeId);
              return { total: porSede?.total ?? 0, sede: porSede?.sede ?? sedes.find((s) => s.id === sedeId)?.nombre ?? '' };
            })()
          : null;
      const membresias = memb.status === 'fulfilled' ? memb.value[0] ?? null : null;
      const counts =
        canchas.status === 'fulfilled' && clases.status === 'fulfilled'
          ? {
              canchas: (canchas.value.data as unknown as { sede: { id: string } }[]).filter((c) => c.sede.id === sedeId).length,
              clases: clases.value.data.length,
            }
          : null;
      setDetalle({ financiero, membresias, counts, parcial: !financiero || !membresias || !counts });
      setLoadingS(false);
    });
    return () => {
      viva = false;
    };
    // sedes solo aporta el nombre de respaldo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId, tab, recargaS]);

  // Los conteos aplican a la página cargada.
  const accionesHoy = useMemo(() => {
    const hoy = new Date().toDateString();
    return regs.filter((r) => new Date(r.creadoEn).toDateString() === hoy).length;
  }, [regs]);

  const sedeTop = useMemo(() => {
    const porSede = finGeneral?.porSede ?? [];
    return porSede.length ? porSede.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  }, [finGeneral]);

  const rankingIngresos = useMemo(() => {
    const porSede = finGeneral?.porSede ?? [];
    const max = Math.max(...porSede.map((s) => s.total), 0);
    if (max <= 0) return [];
    return [...porSede].sort((a, b) => b.total - a.total).map((s) => ({ name: s.sede, value: Math.round((s.total / max) * 100) }));
  }, [finGeneral]);

  const m = detalle?.membresias;
  const totalMemb = m ? m.activas + m.vencidas + m.suspendidas : 0;
  const pctActivas = totalMemb > 0 && m ? Math.round((m.activas / totalMemb) * 100) : 0;

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Reportes</h2>
          <p>{esGG ? 'Auditoría y métricas de toda la red.' : 'Auditoría y métricas de tu sede.'}</p>
        </div>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard label="Acciones auditadas hoy" value={loadingA ? '—' : String(accionesHoy)} change="en esta página" icon={Activity} />
        {esGG ? (
          <MetricCard
            label="Sede con más ingresos"
            value={sedeTop ? sedeTop.sede : '—'}
            change={sedeTop ? formatMoney(sedeTop.total) : 'sin datos'}
            icon={TrendingUp}
          />
        ) : (
          <MetricCard label="Ingresos de hoy" value={finGeneral ? formatMoney(finGeneral.ingresosHoy) : '—'} change="pagos aprobados" icon={TrendingUp} />
        )}
        <MetricCard label="Ingresos del mes" value={finGeneral ? formatMoney(finGeneral.ingresosMes) : '—'} change={finGeneral ? `mes anterior ${formatMoney(finGeneral.ingresosMesAnterior)}` : 'no disponible'} icon={DollarSign} />
      </div>

      <div className="inline-actions" style={{ marginBottom: 14 }}>
        <Chip label="Auditoría" active={tab === TAB.AUDITORIA} onClick={() => setTab(TAB.AUDITORIA)} />
        <Chip label={esGG ? 'Por sede' : 'Mi sede'} active={tab === TAB.POR_SEDE} onClick={() => setTab(TAB.POR_SEDE)} />
      </div>

      {tab === TAB.AUDITORIA && (
        <section className="glass panel" aria-label="Auditoría">
          <div className="filters" style={{ boxShadow: 'none', marginBottom: 14 }}>
            <div className="select-field">
              <span className="field-label">ENTIDAD</span>
              <Select value={entidad} onChange={setEntidad} placeholder="Todas" ariaLabel="Entidad" opciones={ENTIDADES.map((e) => ({ value: e, label: e }))} />
            </div>
            <label className="select-field">
              <span className="field-label">DESDE</span>
              <input className="field-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="select-field">
              <span className="field-label">HASTA</span>
              <input className="field-input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setPageA(1);
                cargarAuditoria(1);
              }}
            >
              Filtrar
            </button>
          </div>

          {loadingA ? (
            <LoadingState rows={4} label="Cargando auditoría" />
          ) : errA ? (
            <ErrorState title="No pudimos cargar la auditoría" onRetry={() => cargarAuditoria(pageA)} />
          ) : regs.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Sin registros" description="No hay acciones auditadas para este filtro." />
          ) : (
            <div className="ops-table" style={{ ['--cols' as string]: '1.4fr 1.4fr 1.4fr 1.2fr' }}>
              <div className="ops-row ops-head">
                <span>ACCIÓN</span>
                <span>ENTIDAD</span>
                <span>ACTOR</span>
                <span>FECHA</span>
              </div>
              {regs.map((r) => (
                <div className="ops-row" key={r.id}>
                  <span>
                    <Badge variant={accionVariant(r.accion)}>{r.accion}</Badge>
                  </span>
                  <span data-label="ENTIDAD" className="ops-strong">
                    {r.entidad}
                    {r.entidadId ? ` · ${r.entidadId.slice(0, 8)}` : ''}
                  </span>
                  <span data-label="ACTOR">{r.actor ? `${r.actor.nombre} ${r.actor.apellido}` : '—'}</span>
                  <span data-label="FECHA">{new Date(r.creadoEn).toLocaleString('es-AR')}</span>
                </div>
              ))}
            </div>
          )}
          <Pagination
            page={pageA}
            totalPages={totalPagesA}
            onChange={(p) => {
              setPageA(p);
              cargarAuditoria(p);
            }}
          />
        </section>
      )}

      {tab === TAB.POR_SEDE && (
        <>
          {esGG && (
            <section className="glass panel" style={{ marginBottom: 14 }}>
              <span className="field-label">SEDE</span>
              <Select value={sedeElegida} onChange={setSedeElegida} ariaLabel="Sede" placeholder="Seleccionar sede..." opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))} />
            </section>
          )}

          {!sedeId ? (
            <EmptyState
              icon={Building2}
              title={esGG ? 'Elegí una sede' : 'Sin sede asignada'}
              description={esGG ? 'Seleccioná una sede para ver sus métricas.' : 'Tu usuario no tiene una sede asignada.'}
            />
          ) : loadingS ? (
            <LoadingState rows={3} label="Cargando métricas" />
          ) : errS ? (
            <ErrorState title="No pudimos cargar las métricas" onRetry={() => setRecargaS((n) => n + 1)} />
          ) : (
            detalle && (
              <>
                {detalle.parcial && (
                  <p role="status" className="notice notice-err" style={{ marginBottom: 14 }}>
                    Algunas métricas no están disponibles en este momento.
                  </p>
                )}
                <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
                  <MetricCard label="Ingresos del mes" value={detalle.financiero ? formatMoney(detalle.financiero.total) : '—'} change={detalle.financiero?.sede || 'sede'} icon={DollarSign} />
                  <MetricCard label="Socios con membresía" value={m ? String(m.socios.length) : '—'} change={m ? `${m.activas} activas` : 'sin datos'} icon={Users} />
                  <MetricCard label="Canchas" value={detalle.counts ? String(detalle.counts.canchas) : '—'} change="en la sede" icon={ScanLine} />
                  <MetricCard label="Clases" value={detalle.counts ? String(detalle.counts.clases) : '—'} change="en la sede" icon={ClipboardList} />
                </div>

                <div className="ops-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
                  <section className="glass panel">
                    <SectionHeader title="Membresías" description="Estado de los socios de la sede." />
                    {m && totalMemb > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                        <Donut value={pctActivas} label="activas" />
                        <div className="stack-gap" style={{ gap: 8, fontSize: 12 }}>
                          <Badge variant="success">Activas · {m.activas}</Badge>
                          <Badge variant="danger">Vencidas · {m.vencidas}</Badge>
                          <Badge variant="neutral">Suspendidas · {m.suspendidas}</Badge>
                        </div>
                      </div>
                    ) : (
                      <EmptyState icon={Users} title="Sin membresías" description="Esta sede todavía no tiene socios con membresía." />
                    )}
                  </section>

                  <section className="glass panel">
                    <SectionHeader title="Accesos relacionados" />
                    <div className="stack-gap" style={{ gap: 8 }}>
                      <Link className="btn btn-secondary" to="/admin/reservas">Ver reservas</Link>
                      <Link className="btn btn-secondary" to="/admin/accesos">Métricas de accesos</Link>
                      <Link className="btn btn-secondary" to="/admin/membresias">Ver membresías</Link>
                      <Link className="btn btn-secondary" to={`/admin/clases/${sedeId}`}>Calendario de la sede</Link>
                      {esGG && <Link className="btn btn-secondary" to={`/admin/sedes/${sedeId}`}>Detalle de la sede</Link>}
                    </div>
                  </section>
                </div>
              </>
            )
          )}

          {esGG && rankingIngresos.length > 0 && (
            <section className="glass panel" style={{ marginTop: 14 }}>
              <SectionHeader title="Ingresos por sede" description="Del mes, relativo a la sede con más ingresos." />
              <Ranking items={rankingIngresos} />
            </section>
          )}
        </>
      )}
    </>
  );
}
