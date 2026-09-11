import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { clasesApi } from '../clases.api';
import type { Clase, ClaseOcurrencia, ReservaClase } from '../clases.types';
import { usuariosApi } from '../../usuarios/usuarios.api';
import type { Usuario } from '../../usuarios/usuarios.types';
import { sedesApi } from '../../sedes/sedes.api';
import { Badge, Button, Card, Chip, StatCard } from '../../../shared/components/ui';
import { colorPorTipo } from '../../../shared/utils/colorClase';

const DIAS_A_FUTURO = 14;

const DIAS_SEMANA = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

function aYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatearFecha(fechaYMD: string): string {
  const [y, m, d] = fechaYMD.split('-');
  return `${d}/${m}/${y}`;
}

function inicioOcurrencia(o: ClaseOcurrencia): number {
  return new Date(`${o.fecha}T${o.horaInicio}`).getTime();
}

function etiquetaOcurrencia(o: ClaseOcurrencia): string {
  return `${formatearFecha(o.fecha)} · ${o.horaInicio.slice(0, 5)} - ${o.horaFin.slice(0, 5)}`;
}

export function GestionReservasClases() {
  const { user } = useAuth();
  const sedeId = user?.sedeId ?? null;

  const [sedeNombre, setSedeNombre] = useState('');
  const [clases, setClases] = useState<Clase[]>([]);
  const [ocurrenciasPorClase, setOcurrenciasPorClase] = useState<Record<string, ClaseOcurrencia[]>>({});
  const [reservasPorOcurrencia, setReservasPorOcurrencia] = useState<Record<string, ReservaClase[]>>({});
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);

  const [diaSel, setDiaSel] = useState(() => new Date().getDay());
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [paso, setPaso] = useState(1);
  const [occSelId, setOccSelId] = useState('');
  const [usuarioSelId, setUsuarioSelId] = useState('');
  const [busquedaUsuario, setBusquedaUsuario] = useState('');

  const clasesDeSede = useMemo(() => {
    if (!sedeId) return [];
    return clases.filter((c) => c.sede.id === sedeId && c.activa);
  }, [clases, sedeId]);

  const clasePorId = useMemo(() => new Map(clases.map((c) => [c.id, c])), [clases]);

  // Todas las ocurrencias programadas de la sede (para tabs, stats y panel).
  const ocurrenciasDeSede = useMemo(() => {
    const todas = Object.entries(ocurrenciasPorClase)
      .filter(([claseId]) => clasesDeSede.some((c) => c.id === claseId))
      .flatMap(([claseId, occs]) => occs.map((o) => ({ ...o, claseId })));
    return todas
      .filter((o) => o.estado === 'PROGRAMADA')
      .sort((a, b) => inicioOcurrencia(a) - inicioOcurrencia(b));
  }, [ocurrenciasPorClase, clasesDeSede]);

  const conteoPorDia = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const o of ocurrenciasDeSede) {
      const dia = new Date(`${o.fecha}T00:00`).getDay();
      mapa.set(dia, (mapa.get(dia) ?? 0) + 1);
    }
    return mapa;
  }, [ocurrenciasDeSede]);

  const ocurrenciasDelDia = useMemo(
    () =>
      ocurrenciasDeSede.filter(
        (o) => new Date(`${o.fecha}T00:00`).getDay() === diaSel,
      ),
    [ocurrenciasDeSede, diaSel],
  );

  const statsHoy = useMemo(() => {
    const hoy = aYMD(new Date());
    const deHoy = ocurrenciasDeSede.filter((o) => o.fecha === hoy);
    let ocupadas = 0;
    let capacidad = 0;
    let casiLlenas = 0;
    for (const o of deHoy) {
      const clase = clasePorId.get(o.claseId);
      const cap = clase?.capacidad ?? 0;
      const oc = (reservasPorOcurrencia[o.id] ?? []).filter((r) => r.estado === 'RESERVADA').length;
      ocupadas += oc;
      capacidad += cap;
      if (cap > 0 && oc / cap >= 0.8) casiLlenas++;
    }
    return { clasesHoy: deHoy.length, ocupadas, capacidad, casiLlenas };
  }, [ocurrenciasDeSede, reservasPorOcurrencia, clasePorId]);

  const anotables = useMemo(() => {
    const limite = Date.now() + 30 * 60 * 1000;
    return ocurrenciasDeSede.filter((o) => inicioOcurrencia(o) >= limite);
  }, [ocurrenciasDeSede]);

  const usuariosFiltrados = useMemo(() => {
    const q = busquedaUsuario.trim().toLowerCase();
    const base = usuarios.filter((u) => u.tipoActor === 'SOCIO' || u.tipoActor === 'EXTERNO');
    if (!q) return base.slice(0, 50);
    return base.filter((u) =>
      `${u.nombre} ${u.apellido} ${u.email} ${u.dni ?? ''}`.toLowerCase().includes(q),
    ).slice(0, 50);
  }, [usuarios, busquedaUsuario]);

  const occElegida = useMemo(
    () => anotables.find((o) => o.id === occSelId) ?? null,
    [anotables, occSelId],
  );
  const socioElegido = useMemo(
    () => usuarios.find((u) => u.id === usuarioSelId) ?? null,
    [usuarios, usuarioSelId],
  );

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [clasesRes, usuariosRes, sede] = await Promise.all([
        clasesApi.getAll(undefined, 1, 100),
        usuariosApi.getAll(1, 100),
        sedeId ? sedesApi.getOne(sedeId).catch(() => null) : Promise.resolve(null),
      ]);
      const allClases = clasesRes.data;
      // TODO: este buscador solo aplica a la página actual, no al total — filtrar server-side en el futuro.
      const allUsuarios = usuariosRes.data;
      setClases(allClases);
      setUsuarios(allUsuarios);
      if (sede) setSedeNombre(sede.nombre);
      const deSede = sedeId ? allClases.filter((c) => c.sede.id === sedeId && c.activa) : [];
      const hoy = aYMD(new Date());
      const hasta = aYMD(new Date(Date.now() + DIAS_A_FUTURO * 24 * 60 * 60 * 1000));
      const occMap: Record<string, ClaseOcurrencia[]> = {};
      await Promise.all(
        deSede.map(async (c) => {
          try {
            occMap[c.id] = (await clasesApi.getOcurrencias(c.id, hoy, hasta)).data;
          } catch {
            occMap[c.id] = [];
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
      setError('No se pudieron cargar las clases.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId]);

  function abrirPanel() {
    setPaso(1);
    setOccSelId('');
    setUsuarioSelId('');
    setBusquedaUsuario('');
    setMsg(null);
    setPanelAbierto(true);
  }

  function cerrarPanel() {
    setPanelAbierto(false);
  }

  function ocupadasDe(ocurrenciaId: string) {
    return (reservasPorOcurrencia[ocurrenciaId] ?? []).filter((r) => r.estado === 'RESERVADA').length;
  }

  async function handleConfirmar() {
    if (!occSelId || !usuarioSelId) return;
    setAccionId('anotar');
    setMsg(null);
    try {
      const reserva = await clasesApi.reservar(occSelId, usuarioSelId);
      // Actualización local: la lista del día y las estadísticas se refrescan solas.
      setReservasPorOcurrencia((prev) => ({ ...prev, [occSelId]: [...(prev[occSelId] ?? []), reserva] }));
      cerrarPanel();
      setMsg({ type: 'ok', text: `Reserva creada: ${reserva.usuario.nombre} ${reserva.usuario.apellido} — ${reserva.estado}` });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const text = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo reservar.';
      setMsg({ type: 'err', text });
    } finally {
      setAccionId(null);
    }
  }

  async function handleCancelar(reservaId: string) {
    setAccionId(reservaId);
    setMsg(null);
    try {
      await clasesApi.cancelarReserva(reservaId);
      setReservasPorOcurrencia((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) next[k] = next[k].filter((r) => r.id !== reservaId);
        return next;
      });
      setMsg({ type: 'ok', text: 'Reserva cancelada.' });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const text = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo cancelar.';
      setMsg({ type: 'err', text });
    } finally {
      setAccionId(null);
    }
  }

  if (!sedeId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-[#111111]">Reservas de clases</h1>
        <div className="mt-4 p-4 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-sm text-[#92400E]">
          Tu usuario no tiene una sede asignada.
        </div>
      </div>
    );
  }

  if (loading) return <div className="max-w-lg mx-auto px-4 py-6 text-sm text-[#6B7280]">Cargando clases...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-bold text-[#111111]">Reservas de clases</h1>
        <p className="text-sm text-[#6B7280] mt-1">{sedeNombre || 'Tu sede'}</p>
      </div>

      {error && <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}
      {msg && <p className={`rounded-lg border p-3 text-sm ${msg.type==='ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>{msg.text}</p>}

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Clases hoy" value={String(statsHoy.clasesHoy)} />
        <StatCard label="Cupo ocupado hoy" value={`${statsHoy.ocupadas}/${statsHoy.capacidad}`} />
        <StatCard label="Casi llenas (>80%)" value={String(statsHoy.casiLlenas)} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {DIAS_SEMANA.map((d) => (
          <Chip
            key={d.value}
            label={`${d.label} (${conteoPorDia.get(d.value) ?? 0})`}
            active={diaSel === d.value}
            onClick={() => setDiaSel(d.value)}
          />
        ))}
      </div>

      <div className="space-y-2">
        {ocurrenciasDelDia.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-sm text-[#6B7280]">Sin clases este día.</p>
          </Card>
        ) : (
          ocurrenciasDelDia.map((o) => {
            const clase = clasePorId.get(o.claseId);
            if (!clase) return null;
            const color = colorPorTipo(clase.tipoClase);
            const ocupadas = ocupadasDe(o.id);
            const llena = ocupadas >= clase.capacidad;
            const expandida = expandidas[o.id] ?? false;
            const reservas = reservasPorOcurrencia[o.id] ?? [];
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
                      {o.horaInicio.slice(0, 5)} - {o.horaFin.slice(0, 5)} · {clase.instructor.nombre}
                    </p>
                  </div>
                  {llena ? <Badge variant="amber">Llena</Badge> : <Badge variant="green">{ocupadas}/{clase.capacidad}</Badge>}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandidas((prev) => ({ ...prev, [o.id]: !expandida }))}
                  className="mt-2 text-xs font-semibold text-[#8B2EFF] hover:underline"
                  style={{ minHeight: 44 }}
                >
                  {expandida ? 'Ocultar reservas' : `Ver reservas (${reservas.length})`}
                </button>
                {expandida && (
                  <div className="mt-2 space-y-2">
                    {reservas.length === 0 ? (
                      <p className="text-xs text-[#6B7280]">Sin reservas.</p>
                    ) : (
                      reservas.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white p-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#111111] truncate">{r.usuario.nombre} {r.usuario.apellido}</p>
                            <div className="mt-1">
                              <Badge variant={r.estado === 'RESERVADA' ? 'green' : r.estado === 'LISTA_ESPERA' ? 'amber' : r.estado === 'CANCELADA' ? 'gray' : 'violet'}>{r.estado}</Badge>
                            </div>
                          </div>
                          {r.estado !== 'CANCELADA' && (
                            <Button variant="outline" size="sm" onClick={() => handleCancelar(r.id)} disabled={accionId === r.id}>
                              {accionId === r.id ? '...' : 'Cancelar'}
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={abrirPanel}
        aria-label="Anotar socio"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#8B2EFF] text-white shadow-lg hover:bg-[#7A25E6]"
      >
        <Plus size={24} />
      </button>

      {panelAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 md:rounded-2xl md:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#111111]">
                  {paso === 1 ? 'Elegir clase' : paso === 2 ? 'Buscar socio' : 'Confirmar anotación'}
                </h2>
                <p className="mt-0.5 text-xs text-[#6B7280]">Paso {paso} de 3</p>
              </div>
              <button
                type="button"
                onClick={cerrarPanel}
                aria-label="Cerrar"
                className="rounded-lg p-1 text-[#6B7280] hover:text-[#111111]"
                style={{ minHeight: 44, minWidth: 44 }}
              >
                <X size={20} />
              </button>
            </div>

            {paso === 1 && (
              <div className="space-y-2">
                {anotables.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No hay fechas disponibles para anotar.</p>
                ) : (
                  anotables.map((o) => {
                    const clase = clasePorId.get(o.claseId);
                    if (!clase) return null;
                    const ocupadas = ocupadasDe(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => { setOccSelId(o.id); setPaso(2); }}
                        className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-left hover:border-[#8B2EFF]"
                        style={{ minHeight: 44 }}
                      >
                        <p className="text-sm font-semibold text-[#111111]">{clase.tipoClase}</p>
                        <p className="mt-0.5 text-xs text-[#6B7280]">
                          {etiquetaOcurrencia(o)} · Cupo {ocupadas}/{clase.capacidad}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {paso === 2 && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={busquedaUsuario}
                  onChange={(e) => setBusquedaUsuario(e.target.value)}
                  placeholder="Buscar por nombre o DNI"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
                  style={{ minHeight: 44 }}
                />
                <div className="space-y-2">
                  {usuariosFiltrados.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setUsuarioSelId(u.id); setPaso(3); }}
                      className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-left hover:border-[#8B2EFF]"
                      style={{ minHeight: 44 }}
                    >
                      <p className="text-sm font-semibold text-[#111111]">{u.nombre} {u.apellido}</p>
                      <p className="mt-0.5 text-xs text-[#6B7280]">{u.email}{u.dni ? ` · DNI ${u.dni}` : ''}</p>
                    </button>
                  ))}
                </div>
                <Button variant="ghost" fullWidth onClick={() => setPaso(1)}>← Volver</Button>
              </div>
            )}

            {paso === 3 && occElegida && socioElegido && (
              <div className="space-y-4">
                <Card>
                  <p className="text-sm font-bold text-[#111111]">
                    {clasePorId.get(occElegida.claseId)?.tipoClase}
                  </p>
                  <p className="mt-1 text-xs text-[#6B7280]">{etiquetaOcurrencia(occElegida)}</p>
                  <p className="mt-2 text-sm text-[#111111]">
                    {socioElegido.nombre} {socioElegido.apellido}
                    {socioElegido.dni ? ` · DNI ${socioElegido.dni}` : ''}
                  </p>
                </Card>
                <p className="text-xs text-[#6B7280]">
                  Se validará que el socio tenga membresía activa antes de confirmar.
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" fullWidth onClick={() => setPaso(2)}>← Volver</Button>
                  <Button fullWidth onClick={() => void handleConfirmar()} disabled={accionId === 'anotar'}>
                    {accionId === 'anotar' ? 'Anotando...' : 'Confirmar anotación'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
