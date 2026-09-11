import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { canchasApi } from '../canchas.api';
import type { Cancha, ReservaCancha } from '../canchas.types';
import { usuariosApi } from '../../usuarios/usuarios.api';
import type { Usuario } from '../../usuarios/usuarios.types';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede, FranjaHoraria } from '../../sedes/sedes.types';
import { Badge, Button, Card, Chip, StatCard, ProgressBar } from '../../../shared/components/ui';

function formatFecha(d: Date) {
  return d.toISOString().split('T')[0];
}
function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function aMinutos(hora: string) {
  const [h = '0', m = '0'] = hora.slice(0, 5).split(':');
  return Number(h) * 60 + Number(m);
}
// Misma regla que el backend (pricing-calculator: 19:00 a 20:59 es pico).
// Solo se usa como indicador visual; el precio siempre lo calcula el backend.
function esHoraPico(hora: number) {
  return hora >= 19 && hora < 21;
}

const ETIQUETA_ESTRATEGIA: Record<string, string> = {
  ESTANDAR: 'Tarifa estándar',
  SOCIO_DESCUENTO: 'Descuento de socio aplicado',
  HORA_PICO: 'Recargo de hora pico aplicado',
  SOCIO_HORA_PICO: 'Descuento de socio + recargo de hora pico',
};

// Slots de 1h cubiertos por las franjas reales de la sede (no el rango fijo 8-22).
function slotsDeFranjas(franjas: FranjaHoraria[]): number[] {
  const set = new Set<number>();
  for (const f of franjas) {
    const ini = Math.floor(aMinutos(f.apertura) / 60);
    const fin = Math.ceil(aMinutos(f.cierre) / 60);
    for (let h = ini; h < fin; h++) {
      // Solo slots contenidos por completo dentro de alguna franja.
      if (franjas.some((g) => aMinutos(g.apertura) <= h * 60 && aMinutos(g.cierre) >= (h + 1) * 60)) {
        set.add(h);
      }
    }
  }
  return [...set].sort((a, b) => a - b);
}

function duracionHoras(r: ReservaCancha) {
  return Math.max(0, (aMinutos(r.horaFin) - aMinutos(r.horaInicio)) / 60);
}

export function GestionReservasCanchas() {
  const { user } = useAuth();
  const sedeId = user?.sedeId ?? null;

  const [sede, setSede] = useState<Sede | null>(null);
  const [franjas, setFranjas] = useState<FranjaHoraria[]>([]);
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [canchaId, setCanchaId] = useState('');
  const [fecha, setFecha] = useState<string>(formatFecha(new Date()));
  const [reservas, setReservas] = useState<ReservaCancha[]>([]);
  const [reservasHoy, setReservasHoy] = useState<ReservaCancha[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Panel de reserva (slot libre tocado).
  const [slotSel, setSlotSel] = useState<number | null>(null);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [busqueda, setBusqueda] = useState('');
  const [usuarioIdSel, setUsuarioIdSel] = useState('');
  const [cotizacion, setCotizacion] = useState<{ precioFinal: number; estrategia: string } | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [errorPanel, setErrorPanel] = useState('');

  const fechas = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);
  const hoy = fechas[0] ? formatFecha(fechas[0]) : fecha;

  const canchasDeSede = useMemo(() => {
    if (!sedeId) return [];
    return canchas.filter((c) => c.sede.id === sedeId && c.estado === 'ACTIVA');
  }, [canchas, sedeId]);

  const canchaSel = canchasDeSede.find((c) => c.id === canchaId) ?? null;
  const slots = useMemo(() => slotsDeFranjas(franjas), [franjas]);

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = usuarios.filter((u) => u.tipoActor === 'SOCIO' || u.tipoActor === 'EXTERNO');
    if (!q) return base.slice(0, 50);
    return base.filter((u) =>
      `${u.nombre} ${u.apellido} ${u.email} ${u.dni ?? ''}`.toLowerCase().includes(q),
    ).slice(0, 50);
  }, [usuarios, busqueda]);

  const usuarioSel = usuarios.find((u) => u.id === usuarioIdSel) ?? null;

  useEffect(() => {
    if (!sedeId) { setLoading(false); return; }
    async function init() {
      try {
        const [canchasRes, usuariosRes, sedeData, franjasData] = await Promise.all([
          canchasApi.getAll(1, 100),
          usuariosApi.getAll(1, 100),
          sedesApi.getOne(sedeId as string),
          sedesApi.getFranjas(sedeId as string).catch(() => [] as FranjaHoraria[]),
        ]);
        const allCanchas = canchasRes.data;
        // TODO: este buscador solo aplica a la página actual, no al total — filtrar server-side en el futuro.
        setCanchas(allCanchas);
        setUsuarios(usuariosRes.data);
        setSede(sedeData);
        setFranjas(franjasData);
        const filtradas = allCanchas.filter((c) => c.sede.id === sedeId && c.estado === 'ACTIVA');
        if (filtradas.length) setCanchaId(filtradas[0].id);
      } catch {
        setCanchas([]);
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [sedeId]);

  // Reservas de la cancha+fecha seleccionada (grilla).
  useEffect(() => {
    if (!canchaId) return;
    canchasApi.getReservasPorCancha(canchaId, fecha).then((res) => setReservas(res.data)).catch(() => setReservas([]));
  }, [canchaId, fecha, refreshKey]);

  // Estadísticas del día: reservas CONFIRMADA de hoy en todas las canchas activas de la sede.
  useEffect(() => {
    if (!sedeId || canchasDeSede.length === 0) { setReservasHoy([]); return; }
    Promise.all(
      canchasDeSede.map((c) => canchasApi.getReservasPorCancha(c.id, hoy).then((r) => r.data).catch(() => [] as ReservaCancha[])),
    ).then((listas) => setReservasHoy(listas.flat().filter((r) => r.estado === 'CONFIRMADA')));
  }, [sedeId, canchasDeSede, refreshKey, hoy]);

  const stats = useMemo(() => {
    const horasOcupadas = reservasHoy.reduce((acc, r) => acc + duracionHoras(r), 0);
    const horasFranjas = franjas.reduce((acc, f) => acc + Math.max(0, (aMinutos(f.cierre) - aMinutos(f.apertura)) / 60), 0);
    const horasDisponibles = horasFranjas * canchasDeSede.length;
    const ingreso = reservasHoy.reduce((acc, r) => acc + Number(r.precioFinal), 0);
    return { count: reservasHoy.length, horasOcupadas, horasDisponibles, ingreso };
  }, [reservasHoy, franjas, canchasDeSede]);

  const pctOcupacion = stats.horasDisponibles > 0 ? Math.min(100, Math.round((stats.horasOcupadas / stats.horasDisponibles) * 100)) : 0;

  function reservaEnSlot(hora: number): ReservaCancha | null {
    const ini = hora * 60;
    const fin = (hora + 1) * 60;
    return reservas.find((r) =>
      r.estado === 'CONFIRMADA' && aMinutos(r.horaInicio) < fin && aMinutos(r.horaFin) > ini,
    ) ?? null;
  }

  const esHoy = fecha === hoy;
  const ahoraMin = useMemo(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }, [fecha]);
  function slotPasado(hora: number) {
    return esHoy && (hora + 1) * 60 <= ahoraMin;
  }

  function abrirSlot(hora: number) {
    setSlotSel(hora);
    setPaso(1);
    setBusqueda('');
    setUsuarioIdSel('');
    setCotizacion(null);
    setErrorPanel('');
  }
  function cerrarPanel() {
    setSlotSel(null);
    setPaso(1);
    setCotizacion(null);
    setErrorPanel('');
  }

  async function irAPaso2() {
    if (slotSel === null || !canchaId || !usuarioIdSel) return;
    setCotizando(true);
    setErrorPanel('');
    setCotizacion(null);
    try {
      const cot = await canchasApi.cotizar({
        canchaId,
        usuarioId: usuarioIdSel,
        fecha,
        horaInicio: `${String(slotSel).padStart(2, '0')}:00`,
        horaFin: `${String(slotSel + 1).padStart(2, '0')}:00`,
      });
      setCotizacion(cot);
      setPaso(2);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      setErrorPanel(Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo cotizar el turno.');
    } finally {
      setCotizando(false);
    }
  }

  async function handleConfirmar() {
    if (slotSel === null || !canchaId || !usuarioIdSel) return;
    setConfirmando(true);
    setErrorPanel('');
    try {
      await canchasApi.reservar({
        canchaId,
        usuarioId: usuarioIdSel,
        fecha,
        horaInicio: `${String(slotSel).padStart(2, '0')}:00`,
        horaFin: `${String(slotSel + 1).padStart(2, '0')}:00`,
      });
      setMsg({ type: 'ok', text: 'Reserva confirmada.' });
      cerrarPanel();
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      setErrorPanel(Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo confirmar la reserva.');
    } finally {
      setConfirmando(false);
    }
  }

  async function handleCancelar(id: string) {
    setAccionId(id);
    try {
      await canchasApi.cancelar(id);
      setReservas((prev) => prev.filter((r) => r.id !== id));
      setMsg({ type: 'ok', text: 'Reserva cancelada.' });
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      setMsg({ type: 'err', text: Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo cancelar.' });
    } finally {
      setAccionId(null);
    }
  }

  if (!sedeId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-[#111111]">Reservas de canchas</h1>
        <div className="mt-4 p-4 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-sm text-[#92400E]">Tu usuario no tiene sede asignada.</div>
      </div>
    );
  }

  if (loading) return <div className="max-w-lg mx-auto px-4 py-6 text-sm text-[#6B7280]">Cargando canchas...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#111111]">{sede?.nombre ?? 'Reservas de canchas'}</h1>
        <p className="text-sm text-[#6B7280] mt-1">Reservá en nombre de un socio/externo. Solo canchas de tu sede.</p>
      </div>

      {msg && <p className={`rounded-lg border p-3 text-sm ${msg.type === 'ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>{msg.text}</p>}

      {/* Estadísticas reales del día */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Reservas hoy" value={String(stats.count)} />
        <StatCard label="Ocupación hoy" value={`${stats.horasOcupadas}/${stats.horasDisponibles}h`} sub={`${pctOcupacion}%`} />
        <StatCard label="Ingreso est. hoy" value={`$${stats.ingreso.toLocaleString('es-AR')}`} />
      </div>
      <ProgressBar value={pctOcupacion} color={pctOcupacion >= 90 ? '#DC2626' : pctOcupacion >= 70 ? '#D97706' : '#8B2EFF'} />

      {/* Fecha */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {fechas.map((d, i) => {
          const f = formatFecha(d);
          const label = i === 0
            ? 'Hoy'
            : d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
          return <Chip key={f} label={label} active={fecha === f} onClick={() => setFecha(f)} />;
        })}
      </div>

      {/* Canchas (tabs, solo activas de la sede) */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#111111]">Cancha</p>
        {canchasDeSede.length === 0 ? (
          <Card className="text-center py-6"><p className="text-sm text-[#6B7280]">No hay canchas activas en tu sede.</p></Card>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {canchasDeSede.map((c) => (
              <button key={c.id} onClick={() => setCanchaId(c.id)} className={`rounded-xl px-4 py-3 text-sm font-semibold border whitespace-nowrap ${canchaId === c.id ? 'bg-[#8B2EFF] text-white border-[#8B2EFF]' : 'bg-white text-[#111111] border-[#E5E7EB]'}`} style={{ minHeight: 44 }}>
                {c.nombre} · {c.tipo}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grilla de horarios según franjas reales */}
      <div className="space-y-2">
        {slots.length === 0 ? (
          <Card className="text-center py-6"><p className="text-sm text-[#6B7280]">La sede no tiene franjas horarias cargadas.</p></Card>
        ) : (
          slots.map((h) => {
            const hi = `${String(h).padStart(2, '0')}:00`;
            const hf = `${String(h + 1).padStart(2, '0')}:00`;
            const ocupante = reservaEnSlot(h);
            const pico = esHoraPico(h);
            const pasado = slotPasado(h);
            if (ocupante) {
              return (
                <div key={hi} className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-3.5 flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111111]">{hi} - {hf}</p>
                    <p className="text-xs text-[#6B7280] truncate">Ocupado · {ocupante.usuario.nombre} {ocupante.usuario.apellido}</p>
                  </div>
                  <Badge variant="gray">Ocupado</Badge>
                </div>
              );
            }
            if (pasado) {
              return (
                <div key={hi} className="rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] opacity-60 p-3.5 flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
                  <p className="text-sm font-semibold text-[#6B7280]">{hi} - {hf}</p>
                  <Badge variant="gray">Finalizado</Badge>
                </div>
              );
            }
            return (
              <button
                key={hi}
                onClick={() => abrirSlot(h)}
                className="w-full rounded-xl border-2 border-dashed border-[#8B2EFF]/40 bg-white p-3.5 flex items-center justify-between gap-3 hover:border-[#8B2EFF] hover:bg-[#F3E8FF]/40 transition-colors text-left"
                style={{ minHeight: 44 }}
              >
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{hi} - {hf}</p>
                  <p className="text-xs text-[#8B2EFF] font-medium">Libre — reservar</p>
                </div>
                <div className="flex items-center gap-2">
                  {pico && <Badge variant="amber">Pico 19-21</Badge>}
                  <Badge variant="green">Libre</Badge>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Cancelación de reservas existentes (secundario) */}
      {reservas.filter((r) => r.estado === 'CONFIRMADA').length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#6B7280]">Reservas para {fecha} (cancelar)</p>
          {reservas.filter((r) => r.estado === 'CONFIRMADA').map((r) => (
            <Card key={r.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111111] truncate">{r.horaInicio.slice(0, 5)} - {r.horaFin.slice(0, 5)} · {r.usuario.nombre} {r.usuario.apellido}</p>
                <p className="text-xs text-[#6B7280]">${r.precioFinal} · {r.estrategiaPrecio}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleCancelar(r.id)} disabled={accionId === r.id}>Cancelar</Button>
            </Card>
          ))}
        </div>
      )}

      {/* Panel superpuesto: reserva en 2 pasos */}
      {slotSel !== null && canchaSel && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={cerrarPanel}>
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#111111]">
                  Reservar {canchaSel.nombre} · {String(slotSel).padStart(2, '0')}:00 - {String(slotSel + 1).padStart(2, '0')}:00
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">{fecha} · Paso {paso} de 2</p>
              </div>
              <button onClick={cerrarPanel} aria-label="Cerrar" className="text-[#6B7280] hover:text-[#111111] px-2" style={{ minHeight: 44, minWidth: 44 }}>✕</button>
            </div>

            {errorPanel && <p className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{errorPanel}</p>}

            {paso === 1 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-semibold text-[#111111]">1 · Buscar cliente (Socio o Externo)</p>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, email o DNI"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
                  style={{ minHeight: 44 }}
                />
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {usuariosFiltrados.length === 0 && (
                    <p className="text-sm text-[#6B7280] text-center py-4">Sin resultados.</p>
                  )}
                  {usuariosFiltrados.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setUsuarioIdSel(u.id)}
                      className={`w-full text-left rounded-xl border p-3.5 transition-colors ${usuarioIdSel === u.id ? 'border-[#8B2EFF] bg-[#F3E8FF]/60' : 'border-[#E5E7EB] bg-white hover:border-[#8B2EFF]/50'}`}
                      style={{ minHeight: 44 }}
                    >
                      <p className="text-sm font-semibold text-[#111111]">{u.nombre} {u.apellido}</p>
                      <p className="text-xs text-[#6B7280]">{u.tipoActor}{u.dni ? ` · DNI ${u.dni}` : ''}</p>
                    </button>
                  ))}
                </div>
                <Button fullWidth disabled={!usuarioIdSel || cotizando} onClick={irAPaso2}>
                  {cotizando ? 'Cotizando...' : 'Continuar'}
                </Button>
              </div>
            )}

            {paso === 2 && usuarioSel && (
              <div className="mt-4 space-y-4">
                <p className="text-sm font-semibold text-[#111111]">2 · Confirmar con cotización</p>
                <Card className="bg-[#FAFAFA]">
                  <p className="text-sm text-[#6B7280]">Cancha</p>
                  <p className="text-sm font-semibold text-[#111111]">{canchaSel.nombre} · {canchaSel.tipo}</p>
                  <p className="text-sm text-[#6B7280] mt-2">Turno</p>
                  <p className="text-sm font-semibold text-[#111111]">{fecha} · {String(slotSel).padStart(2, '0')}:00 - {String(slotSel + 1).padStart(2, '0')}:00</p>
                  <p className="text-sm text-[#6B7280] mt-2">Cliente</p>
                  <p className="text-sm font-semibold text-[#111111]">{usuarioSel.nombre} {usuarioSel.apellido} · {usuarioSel.tipoActor}</p>
                </Card>
                {cotizacion ? (
                  <Card>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#6B7280]">Precio base</span>
                        <span className="font-semibold text-[#111111]">${Number(canchaSel.costoHoraBase).toLocaleString('es-AR')}/h</span>
                      </div>
                      <p className="text-xs text-[#6B7280]">{ETIQUETA_ESTRATEGIA[cotizacion.estrategia] ?? cotizacion.estrategia}</p>
                      <div className="flex justify-between border-t border-[#E5E7EB] pt-2 mt-1">
                        <span className="font-bold text-[#111111]">Total</span>
                        <span className="font-bold text-lg text-[#8B2EFF]">${Number(cotizacion.precioFinal).toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <p className="text-sm text-[#6B7280]">Calculando cotización...</p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" fullWidth onClick={() => setPaso(1)}>Atrás</Button>
                  <Button fullWidth disabled={!cotizacion || confirmando} onClick={handleConfirmar}>
                    {confirmando ? 'Confirmando...' : 'Confirmar y cobrar'}
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
