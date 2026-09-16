import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Plus,
  Settings,
  Users,
  XCircle,
} from 'lucide-react';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede, FranjaHoraria } from '../../sedes/sedes.types';
import { clasesApi } from '../../clases/clases.api';
import type { Clase, ClaseOcurrencia, ReservaClase } from '../../clases/clases.types';
import { Badge, Button, Card, Chip, PageHeader, StatCard } from '../../../shared/components/ui';
import { colorPorTipo } from '../../../shared/utils/colorClase';
import { NuevaClasePanel, nombreDia } from './NuevaClasePanel';

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
  const { sedeId } = useParams<{ sedeId: string }>();
  const navigate = useNavigate();
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
            occMap[cl.id] = (await clasesApi.getOcurrencias(cl.id, hoy, hasta)).data;
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

  if (loading) return <p className="text-sm text-[#6B7280]">Cargando calendario...</p>;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={sede?.nombre ?? 'Calendario'}
        onBack={() => navigate('/admin/clases')}
        action={
          <div className="flex gap-2">
            {vista === 'resumen' ? (
              <Button size="sm" variant="outline" onClick={() => setVista('calendario')}>
                <CalendarDays size={16} /> Ver Calendario
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setVista('resumen')}>
                Ver resumen
              </Button>
            )}
            <Button size="sm" onClick={() => abrirPanel()}>
              <Plus size={16} /> Nueva clase
            </Button>
          </div>
        }
      />
      {sede && (
        <p className="-mt-4 mb-4 text-sm text-[#6B7280]">
          {sede.direccion} · {clases.length} clase(s) activa(s)
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      )}

      {vista === 'resumen' ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Clases hoy" value={String(stats.clasesHoy)} icon={CalendarDays} iconColor="#8B2EFF" />
            <StatCard label="Reservas activas" value={String(stats.reservasActivas)} icon={Users} iconColor="#16A34A" />
            <StatCard label="Esta semana" value={String(stats.estaSemana)} icon={CalendarRange} iconColor="#D97706" />
            <StatCard label="Canceladas" value={String(stats.canceladas)} icon={XCircle} iconColor="#DC2626" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#111111]">Próximas Clases</h2>
                <button
                  type="button"
                  onClick={() => setVista('calendario')}
                  className="text-sm font-semibold text-[#8B2EFF] hover:underline"
                  style={{ minHeight: 44 }}
                >
                  Ver todas
                </button>
              </div>
              {proximas.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-sm text-[#6B7280]">Sin próximas clases programadas.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {proximas.map((o) => {
                    const clase = clasePorId.get(o.claseId);
                    if (!clase) return null;
                    const color = colorPorTipo(clase.tipoClase);
                    const ocupadas = ocupadasDe(o.id);
                    return (
                      <Card
                        key={o.id}
                        className="border-l-4"
                        style={{ backgroundColor: color.fondo, borderLeftColor: color.borde }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#111111]">{clase.tipoClase}</p>
                            <p className="mt-0.5 text-xs text-[#6B7280]">
                              {clase.instructor.nombre} · {formatearFecha(o.fecha)} · {o.horaInicio.slice(0, 5)} - {o.horaFin.slice(0, 5)}
                            </p>
                          </div>
                          <Badge variant={ocupadas >= clase.capacidad ? 'amber' : 'green'}>
                            {ocupadas}/{clase.capacidad}
                          </Badge>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-base font-bold text-[#111111]">Acciones Rápidas</h2>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                  <Button fullWidth onClick={() => abrirPanel()}>
                    <Plus size={16} /> Programar Clase
                  </Button>
                  <Button variant="outline" fullWidth onClick={() => setVista('calendario')}>
                    <CalendarDays size={16} /> Ver Calendario
                  </Button>
                  <Button variant="outline" fullWidth onClick={() => navigate('/admin/reservas-clases')}>
                    <ClipboardList size={16} /> Gestionar Reservas
                  </Button>
                  <Button variant="outline" fullWidth onClick={() => navigate('/admin/clases/configuracion')}>
                    <Settings size={16} /> Configuración
                  </Button>
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-base font-bold text-[#111111]">Actividades Populares</h2>
                {populares.length === 0 ? (
                  <Card className="text-center py-6">
                    <p className="text-xs text-[#6B7280]">Todavía sin reservas.</p>
                  </Card>
                ) : (
                  <Card className="space-y-2">
                    {populares.map(([tipo, cantidad]) => (
                      <div key={tipo} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-[#111111]">{tipo}</span>
                        <Badge variant="violet">{cantidad} reserva(s)</Badge>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {clases.length > 0 && (
            <Card className="mb-4 space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                  Por tipo de clase
                </p>
                <div className="flex flex-wrap gap-2">
                  {tiposUnicos.map((tipo) => (
                    <Chip
                      key={tipo}
                      label={tipo}
                      active={tiposSel.includes(tipo)}
                      onClick={() => setTiposSel((prev) => toggleEn(prev, tipo))}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                  Por instructor
                </p>
                <div className="flex flex-wrap gap-2">
                  {instructoresUnicos.map(([id, nombre]) => (
                    <Chip
                      key={id}
                      label={nombre}
                      active={instructoresSel.includes(id)}
                      onClick={() => setInstructoresSel((prev) => toggleEn(prev, id))}
                    />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {franjas.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-sm text-[#6B7280]">
                Esta sede no tiene franjas horarias cargadas. Cargá al menos una franja para poder
                programar clases.
              </p>
            </Card>
          ) : (
            <>
              {/* Desktop: grilla semanal */}
              <div className="hidden overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white md:block">
                <div
                  className="grid min-w-[760px]"
                  style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}
                >
                  <div className="border-b border-[#E5E7EB] bg-[#FAFAFA] p-2" />
                  {DIAS_COLUMNAS.map((d) => (
                    <div
                      key={d}
                      className="border-b border-l border-[#E5E7EB] bg-[#FAFAFA] p-2 text-center text-xs font-bold text-[#111111]"
                    >
                      {nombreDia(d)}
                    </div>
                  ))}

                  {filas.map((slot) => (
                    <Fragment key={`fila-${slot}`}>
                      <div
                        key={`h-${slot}`}
                        className="border-b border-[#E5E7EB] p-2 text-right text-[11px] font-medium text-[#6B7280]"
                      >
                        {aHora(slot)}
                      </div>
                      {DIAS_COLUMNAS.map((dia) => {
                        const fin = slot + 60;
                        const abierto = dentroDeFranja(slot, fin);
                        const bloques = abierto ? bloquesEn(dia, slot, fin) : [];
                        const libre = abierto && bloques.length === 0;
                        return (
                          <div
                            key={`${dia}-${slot}`}
                            onClick={() => {
                              if (libre) abrirPanel(dia, aHora(slot));
                            }}
                            className={`min-h-[52px] border-b border-l border-[#E5E7EB] p-1 ${
                              !abierto
                                ? 'bg-[#F3F4F6]'
                                : libre
                                  ? 'cursor-pointer hover:bg-[#F3E8FF]/50'
                                  : 'bg-white'
                            }`}
                            title={libre ? 'Clic para crear una clase acá' : undefined}
                          >
                            {bloques.map(({ clase, horaInicio, horaFin }, i) => {
                              const color = colorPorTipo(clase.tipoClase);
                              return (
                              <div
                                key={`${clase.id}-${i}`}
                                className="mb-1 rounded-lg border-l-4 p-1.5"
                                style={{ backgroundColor: color.fondo, borderLeftColor: color.borde }}
                              >
                                <p className="text-[11px] font-bold leading-tight text-[#111111]">
                                  {clase.tipoClase}
                                </p>
                                <p className="text-[10px] leading-tight text-[#6B7280]">
                                  {horaInicio}–{horaFin}
                                </p>
                                <p className="truncate text-[10px] leading-tight text-[#6B7280]">
                                  {clase.instructor.nombre} · cupo {clase.capacidad}
                                </p>
                              </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>

              {/* Mobile: selector de día + lista vertical */}
              <div className="md:hidden">
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  {DIAS_COLUMNAS.map((d) => (
                    <Chip
                      key={d}
                      label={nombreDia(d)}
                      active={diaMovil === d}
                      onClick={() => setDiaMovil(d)}
                    />
                  ))}
                </div>
                {bloquesDiaMovil.length === 0 ? (
                  <Card className="text-center py-8">
                    <p className="text-sm text-[#6B7280]">Sin clases el {nombreDia(diaMovil)}.</p>
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        onClick={() => abrirPanel(diaMovil, filas.length ? aHora(filas[0]) : '08:00')}
                      >
                        <Plus size={16} /> Crear acá
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {bloquesDiaMovil.map(({ clase, horaInicio, horaFin }, i) => {
                      const color = colorPorTipo(clase.tipoClase);
                      return (
                      <Card
                        key={`${clase.id}-${i}`}
                        className="border-l-4"
                        style={{ backgroundColor: color.fondo, borderLeftColor: color.borde }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-[#111111]">{clase.tipoClase}</p>
                            <p className="mt-0.5 text-xs text-[#6B7280]">
                              {horaInicio}–{horaFin} · {clase.instructor.nombre}
                            </p>
                            <p className="text-xs text-[#6B7280]">Cupo {clase.capacidad}</p>
                          </div>
                          <Badge variant="violet">Activa</Badge>
                        </div>
                      </Card>
                      );
                    })}
                  </div>
                )}
                <div className="mt-4">
                  <Button fullWidth onClick={() => abrirPanel()}>
                    <Plus size={16} /> Nueva clase
                  </Button>
                </div>
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
    </div>
  );
}
