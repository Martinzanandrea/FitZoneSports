import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock3,
  Plus,
  Settings,
  Users,
  XCircle,
} from 'lucide-react';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede, FranjaHoraria } from '../../sedes/sedes.types';
import { clasesApi } from '../../clases/clases.api';
import type { Clase, ClaseOcurrencia, ReservaClase } from '../../clases/clases.types';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Chip } from '../../../shared/components/atoms';
import { MetricCard } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { TipoActor } from '../../../shared/types/enums';
import { colorPorTipo } from '../../../shared/utils/colorClase';
import { NuevaClasePanel, nombreDia } from './NuevaClasePanel';
import { useTitulo } from '../../../shared/hooks/useTitulo';

// Columnas Lun-Dom (diaSemana JS: 0 = domingo).
const DIAS_COLUMNAS = [1, 2, 3, 4, 5, 6, 0];
const DIAS_RESUMEN = 14;

function aYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatearFecha(fechaYMD: string): string {
  const [y, m, d] = fechaYMD.split('-');
  return `${d}/${m}/${y}`;
}

function aMinutos(hora: string) {
  const [h = '0', m = '0'] = hora.slice(0, 5).split(':');
  return Number(h) * 60 + Number(m);
}

function aHora(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function CalendarioSede() {
  useTitulo('Calendario de sede');
  const { sedeId } = useParams<{ sedeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  const [sede, setSede] = useState<Sede | null>(null);
  const [franjas, setFranjas] = useState<FranjaHoraria[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [ocurrenciasPorClase, setOcurrenciasPorClase] = useState<Record<string, ClaseOcurrencia[]>>({});
  const [reservasPorOcurrencia, setReservasPorOcurrencia] = useState<Record<string, ReservaClase[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diaMovil, setDiaMovil] = useState(1);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [vista, setVista] = useState<'resumen' | 'calendario'>('resumen');
  const [tiposSel, setTiposSel] = useState<string[]>([]);
  const [instructoresSel, setInstructoresSel] = useState<string[]>([]);
  const [inicial, setInicial] = useState<{ diaSemana: number; horaInicio: string } | undefined>(
    undefined,
  );

  const cargar = useCallback(async () => {
    if (!sedeId) return;
    setLoading(true);
    setError('');
    try {
      const [s, f, c] = await Promise.all([
        sedesApi.getOne(sedeId),
        sedesApi.getFranjas(sedeId).catch(() => [] as FranjaHoraria[]),
        clasesApi.getAll(sedeId, 1, 100).catch(() => ({ data: [] as Clase[] })),
      ]);
      setSede(s);
      setFranjas(f);
      const activas = c.data.filter((cl) => cl.activa !== false);
      setClases(activas);
      const hoy = aYMD(new Date());
      const hasta = aYMD(new Date(Date.now() + DIAS_RESUMEN * 24 * 60 * 60 * 1000));
      const occMap: Record<string, ClaseOcurrencia[]> = {};
      await Promise.all(
        activas.map(async (cl) => {
          try {
            occMap[cl.id] = (await clasesApi.getOcurrencias(cl.id, hoy, hasta, 1, 100)).data;
          } catch {
            occMap[cl.id] = [];
          }
        }),
      );
      setOcurrenciasPorClase(occMap);
      const resMap: Record<string, ReservaClase[]> = {};
      await Promise.all(
        Object.values(occMap)
          .flat()
          .map(async (o) => {
            try {
              resMap[o.id] = (await clasesApi.getReservasPorOcurrencia(o.id)).data;
            } catch {
              resMap[o.id] = [];
            }
          }),
      );
      setReservasPorOcurrencia(resMap);
    } catch {
      setError('No se pudo cargar el calendario de la sede.');
    } finally {
      setLoading(false);
    }
  }, [sedeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const clasePorId = useMemo(() => new Map(clases.map((c) => [c.id, c])), [clases]);

  const todasOcurrencias = useMemo(
    () =>
      Object.entries(ocurrenciasPorClase).flatMap(([claseId, occs]) =>
        occs.map((o) => ({ ...o, claseId })),
      ),
    [ocurrenciasPorClase],
  );

  const ocupadasDe = useCallback(
    (ocurrenciaId: string) =>
      (reservasPorOcurrencia[ocurrenciaId] ?? []).filter((r) => r.estado === 'RESERVADA').length,
    [reservasPorOcurrencia],
  );

  // Estadísticas del resumen (ventana cargada de 14 días).
  const stats = useMemo(() => {
    const hoy = aYMD(new Date());
    const limiteSemana = aYMD(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    let clasesHoy = 0;
    let reservasActivas = 0;
    let estaSemana = 0;
    let canceladas = 0;
    for (const o of todasOcurrencias) {
      if (o.estado === 'CANCELADA') {
        canceladas++;
        continue;
      }
      if (o.estado !== 'PROGRAMADA') continue;
      if (o.fecha === hoy) clasesHoy++;
      if (o.fecha <= limiteSemana) estaSemana++;
      reservasActivas += ocupadasDe(o.id);
    }
    return { clasesHoy, reservasActivas, estaSemana, canceladas };
  }, [todasOcurrencias, ocupadasDe]);

  const proximas = useMemo(() => {
    const ahora = Date.now();
    return todasOcurrencias
      .filter((o) => o.estado === 'PROGRAMADA' && new Date(`${o.fecha}T${o.horaInicio}`).getTime() >= ahora)
      .sort((a, b) => (a.fecha === b.fecha ? a.horaInicio.localeCompare(b.horaInicio) : a.fecha.localeCompare(b.fecha)))
      .slice(0, 5);
  }, [todasOcurrencias]);

  const populares = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const o of todasOcurrencias) {
      const clase = clasePorId.get(o.claseId);
      if (!clase) continue;
      mapa.set(clase.tipoClase, (mapa.get(clase.tipoClase) ?? 0) + ocupadasDe(o.id));
    }
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
  }, [todasOcurrencias, clasePorId, ocupadasDe]);

  // Valores únicos para los filtros (se recalculan con las clases de la sede).
  const tiposUnicos = useMemo(
    () => Array.from(new Set(clases.map((c) => c.tipoClase))).sort(),
    [clases],
  );
  const instructoresUnicos = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of clases) mapa.set(c.instructor.id, c.instructor.nombre);
    return Array.from(mapa.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [clases]);

  // Filtrado AND: tipo (multi-selección) + instructor (multi-selección).
  // Listas vacías = sin filtro en ese criterio.
  const clasesFiltradas = useMemo(
    () =>
      clases.filter(
        (c) =>
          (tiposSel.length === 0 || tiposSel.includes(c.tipoClase)) &&
          (instructoresSel.length === 0 || instructoresSel.includes(c.instructor.id)),
      ),
    [clases, tiposSel, instructoresSel],
  );

  function toggleEn(lista: string[], valor: string) {
    return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
  }

  // Filas horarias: de la apertura mínima al cierre máximo, en bloques de 1 h.
  const filas = useMemo(() => {
    if (franjas.length === 0) return [];
    const min = Math.min(...franjas.map((f) => aMinutos(f.apertura)));
    const max = Math.max(...franjas.map((f) => aMinutos(f.cierre)));
    const inicio = Math.floor(min / 60) * 60;
    const fin = Math.ceil(max / 60) * 60;
    const out: number[] = [];
    for (let t = inicio; t < fin; t += 60) out.push(t);
    return out;
  }, [franjas]);

  const dentroDeFranja = useCallback(
    (slotInicio: number, slotFin: number) =>
      franjas.some((f) => aMinutos(f.apertura) <= slotInicio && aMinutos(f.cierre) >= slotFin),
    [franjas],
  );

  const bloquesEn = useCallback(
    (dia: number, slotInicio: number, slotFin: number) => {
      const out: Array<{ clase: Clase; horaInicio: string; horaFin: string }> = [];
      for (const clase of clasesFiltradas) {
        for (const h of clase.horarios ?? []) {
          if (
            h.diaSemana === dia &&
            aMinutos(h.horaInicio) < slotFin &&
            aMinutos(h.horaFin) > slotInicio
          ) {
            out.push({ clase, horaInicio: h.horaInicio.slice(0, 5), horaFin: h.horaFin.slice(0, 5) });
          }
        }
      }
      return out;
    },
    [clasesFiltradas],
  );

  function abrirPanel(diaSemana?: number, horaInicio?: string) {
    setInicial(
      diaSemana !== undefined && horaInicio ? { diaSemana, horaInicio } : undefined,
    );
    setPanelAbierto(true);
  }

  const bloquesDiaMovil = useMemo(() => {
    const out: Array<{ clase: Clase; horaInicio: string; horaFin: string }> = [];
    for (const clase of clasesFiltradas) {
      for (const h of clase.horarios ?? []) {
        if (h.diaSemana === diaMovil) {
          out.push({ clase, horaInicio: h.horaInicio.slice(0, 5), horaFin: h.horaFin.slice(0, 5) });
        }
      }
    }
    return out.sort((a, b) => (a.horaInicio < b.horaInicio ? -1 : 1));
  }, [clasesFiltradas, diaMovil]);

  // El Gerente de Sede solo ve el calendario de SU sede (el backend responde 403 si no).
  if (!esGG && user?.sedeId && sedeId !== user.sedeId) {
    return <Navigate to={`/admin/clases/${user.sedeId}`} replace />;
  }

  if (loading) return <LoadingState rows={4} label="Cargando calendario" />;
  if (error && !sede) return <ErrorState title="No pudimos cargar el calendario" description={error} onRetry={() => void cargar()} />;

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>{sede?.nombre ?? 'Calendario'}</h2>
          {sede && (
            <p>
              {sede.direccion} · {clases.length} clase(s) activa(s)
            </p>
          )}
        </div>
        <div className="inline-actions">
          {esGG && (
            <button className="btn btn-secondary" onClick={() => navigate('/admin/clases')}>
              Todas las sedes
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setVista(vista === 'resumen' ? 'calendario' : 'resumen')}>
            {vista === 'resumen' ? (
              <>
                <CalendarDays size={15} aria-hidden /> Ver calendario
              </>
            ) : (
              'Ver resumen'
            )}
          </button>
          <button className="btn btn-primary" onClick={() => abrirPanel()}>
            <Plus size={16} aria-hidden /> Nueva clase
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="notice notice-err" style={{ marginBottom: 14 }}>
          {error}
        </p>
      )}

      {vista === 'resumen' ? (
        <>
          <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <MetricCard label="Clases hoy" value={String(stats.clasesHoy)} change="programadas" icon={CalendarDays} />
            <MetricCard label="Reservas activas" value={String(stats.reservasActivas)} change="próximos 14 días" icon={Users} />
            <MetricCard label="Esta semana" value={String(stats.estaSemana)} change="clases programadas" icon={CalendarRange} />
            <MetricCard label="Canceladas" value={String(stats.canceladas)} change="próximos 14 días" icon={XCircle} />
          </div>

          <div className="content-grid">
            <section className="glass panel" aria-label="Próximas clases">
              <SectionHeader
                title="Próximas clases"
                action={
                  <button className="btn btn-ghost" onClick={() => setVista('calendario')}>
                    Ver todas
                  </button>
                }
              />
              {proximas.length === 0 ? (
                <EmptyState icon={CalendarDays} title="Sin próximas clases" description="No hay clases programadas en los próximos días." />
              ) : (
                <div className="stack-list">
                  {proximas.map((o) => {
                    const clase = clasePorId.get(o.claseId);
                    if (!clase) return null;
                    const color = colorPorTipo(clase.tipoClase);
                    const ocupadas = ocupadasDe(o.id);
                    return (
                      <div className="list-row" key={o.id} style={{ borderLeft: `3px solid ${color.borde}`, paddingLeft: 12, background: color.fondo }}>
                        <div className="row-main">
                          <strong>{clase.tipoClase}</strong>
                          <span>
                            {clase.instructor.nombre} · {formatearFecha(o.fecha)} · {o.horaInicio.slice(0, 5)} - {o.horaFin.slice(0, 5)}
                          </span>
                        </div>
                        <Badge variant={ocupadas >= clase.capacidad ? 'warning' : 'success'}>
                          {ocupadas}/{clase.capacidad}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="stack-gap">
              <section className="glass panel quick-panel" aria-label="Accesos rápidos">
                <SectionHeader title="Accesos rápidos" />
                <button className="btn btn-secondary" onClick={() => setVista('calendario')}>
                  <CalendarDays size={15} aria-hidden /> Ver calendario
                </button>
                <button className="btn btn-secondary" onClick={() => navigate(esGG ? `/admin/reservas-clases?sedeId=${sedeId}` : '/admin/reservas-clases')}>
                  <ClipboardList size={15} aria-hidden /> Gestionar reservas
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/admin/clases/configuracion')}>
                  <Settings size={15} aria-hidden /> Configuración
                </button>
              </section>

              <section className="glass panel" aria-label="Actividades populares">
                <SectionHeader title="Actividades populares" />
                {populares.length === 0 ? (
                  <EmptyState icon={Users} title="Todavía sin reservas" />
                ) : (
                  <div className="stack-list">
                    {populares.map(([tipo, cantidad]) => (
                      <div className="list-row" key={tipo}>
                        <div className="row-main">
                          <strong>{tipo}</strong>
                        </div>
                        <Badge variant="info">{cantidad} reserva(s)</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      ) : (
        <>
          {clases.length > 0 && (
            <section className="glass panel" aria-label="Filtros" style={{ marginBottom: 14 }}>
              <span className="field-label">POR TIPO DE CLASE</span>
              <div className="inline-actions" style={{ marginBottom: 14 }}>
                {tiposUnicos.map((tipo) => (
                  <Chip key={tipo} label={tipo} active={tiposSel.includes(tipo)} onClick={() => setTiposSel((prev) => toggleEn(prev, tipo))} />
                ))}
              </div>
              <span className="field-label">POR INSTRUCTOR</span>
              <div className="inline-actions">
                {instructoresUnicos.map(([id, nombre]) => (
                  <Chip key={id} label={nombre} active={instructoresSel.includes(id)} onClick={() => setInstructoresSel((prev) => toggleEn(prev, id))} />
                ))}
              </div>
            </section>
          )}

          {franjas.length === 0 ? (
            <EmptyState
              icon={Clock3}
              title="Esta sede no tiene franjas horarias"
              description="Cargá al menos una franja de apertura para poder programar clases."
            />
          ) : (
            <>
              {/* Desktop: grilla semanal */}
              <div className="glass cal-desktop" style={{ overflowX: 'auto', borderRadius: 18 }}>
                <div style={{ display: 'grid', minWidth: 760, gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
                  <div style={{ borderBottom: '1px solid var(--line)', padding: 8 }} />
                  {DIAS_COLUMNAS.map((d) => (
                    <div
                      key={d}
                      style={{ borderBottom: '1px solid var(--line)', borderLeft: '1px solid var(--line)', padding: 8, textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text)' }}
                    >
                      {nombreDia(d)}
                    </div>
                  ))}

                  {filas.map((slot) => (
                    <Fragment key={`fila-${slot}`}>
                      <div style={{ borderBottom: '1px solid var(--line)', padding: 8, textAlign: 'right', fontSize: 10 }}>{aHora(slot)}</div>
                      {DIAS_COLUMNAS.map((dia) => {
                        const fin = slot + 60;
                        const abierto = dentroDeFranja(slot, fin);
                        const bloques = abierto ? bloquesEn(dia, slot, fin) : [];
                        const libre = abierto && bloques.length === 0;
                        const celda = (
                          <>
                            {bloques.map(({ clase, horaInicio, horaFin }, i) => {
                              const color = colorPorTipo(clase.tipoClase);
                              return (
                                <div
                                  key={`${clase.id}-${i}`}
                                  style={{ marginBottom: 4, borderRadius: 8, borderLeft: `3px solid ${color.borde}`, background: color.fondo, padding: 6 }}
                                >
                                  <p style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, color: 'var(--text)' }}>{clase.tipoClase}</p>
                                  <p style={{ fontSize: 10, lineHeight: 1.2 }}>
                                    {horaInicio}–{horaFin}
                                  </p>
                                  <p style={{ fontSize: 10, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {clase.instructor.nombre} · cupo {clase.capacidad}
                                  </p>
                                </div>
                              );
                            })}
                          </>
                        );
                        const base = { minHeight: 52, borderBottom: '1px solid var(--line)', borderLeft: '1px solid var(--line)', padding: 4 } as const;
                        // Una celda libre es un botón real (teclado y lector de pantalla).
                        return libre ? (
                          <button
                            key={`${dia}-${slot}`}
                            type="button"
                            onClick={() => abrirPanel(dia, aHora(slot))}
                            aria-label={`Crear clase el ${nombreDia(dia)} a las ${aHora(slot)}`}
                            title="Crear una clase acá"
                            style={{ ...base, background: 'transparent', cursor: 'pointer' }}
                          />
                        ) : (
                          <div key={`${dia}-${slot}`} style={{ ...base, background: abierto ? 'transparent' : 'rgba(255,255,255,0.04)' }}>
                            {celda}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>

              {/* Mobile: selector de día + lista vertical */}
              <div className="cal-mobile">
                <div className="inline-actions" style={{ marginBottom: 14, flexWrap: 'nowrap', overflowX: 'auto' }}>
                  {DIAS_COLUMNAS.map((d) => (
                    <Chip key={d} label={nombreDia(d)} active={diaMovil === d} onClick={() => setDiaMovil(d)} />
                  ))}
                </div>
                {bloquesDiaMovil.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title={`Sin clases el ${nombreDia(diaMovil)}`}
                    action={
                      <button className="btn btn-secondary" onClick={() => abrirPanel(diaMovil, filas.length ? aHora(filas[0]) : '08:00')}>
                        <Plus size={15} aria-hidden /> Crear acá
                      </button>
                    }
                  />
                ) : (
                  <div className="stack-list">
                    {bloquesDiaMovil.map(({ clase, horaInicio, horaFin }, i) => {
                      const color = colorPorTipo(clase.tipoClase);
                      return (
                        <div className="list-row" key={`${clase.id}-${i}`} style={{ borderLeft: `3px solid ${color.borde}`, paddingLeft: 12, background: color.fondo }}>
                          <div className="row-main">
                            <strong>{clase.tipoClase}</strong>
                            <span>
                              {horaInicio}–{horaFin} · {clase.instructor.nombre} · cupo {clase.capacidad}
                            </span>
                          </div>
                          <Badge variant="success">Activa</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {panelAbierto && sedeId && (
        <NuevaClasePanel
          sedeId={sedeId}
          inicial={inicial}
          onClose={() => setPanelAbierto(false)}
          onCreada={() => {
            setPanelAbierto(false);
            void cargar();
          }}
        />
      )}
    </>
  );
}
