import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { clasesApi, fetchMapaReservasClase } from '../clases.api';
import type { Clase, ClaseOcurrencia, ReservaClase } from '../clases.types';
import { Badge, Card } from '../../../shared/components/ui';
import { colorPorTipo } from '../../../shared/utils/colorClase';

const DIAS_A_FUTURO = 14;

function formatearFecha(fechaYMD: string): string {
  const [y, m, d] = fechaYMD.split('-');
  return `${d}/${m}/${y}`;
}

function inicioOcurrencia(o: ClaseOcurrencia): number {
  return new Date(`${o.fecha}T${o.horaInicio}`).getTime();
}

export function ReservarClases() {
  const { user } = useAuth();
  const [clases, setClases] = useState<Clase[]>([]);
  const [ocurrenciasPorClase, setOcurrenciasPorClase] = useState<Record<string, ClaseOcurrencia[]>>({});
  const [reservasPorOcurrencia, setReservasPorOcurrencia] = useState<Record<string, ReservaClase[]>>({});
  const [misReservas, setMisReservas] = useState<ReservaClase[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState<string>('TODOS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);

  const tipos = useMemo(() => {
    const set = new Set(clases.map((c) => c.tipoClase));
    return ['TODOS', ...Array.from(set)];
  }, [clases]);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const mapa = await fetchMapaReservasClase(DIAS_A_FUTURO);
      setClases(mapa.clases);
      setOcurrenciasPorClase(mapa.occMap);
      setReservasPorOcurrencia(mapa.resMap);
      if (user) {
        const todas = Object.values(mapa.resMap).flat();
        setMisReservas(todas.filter((r) => r.usuario.id === user.id && r.estado !== 'CANCELADA'));
      }
    } catch {
      setError('No se pudieron cargar las clases.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limiteReserva = Date.now() + 48 * 60 * 60 * 1000;
  const filtradas = clases.filter((c) => tipoFiltro === 'TODOS' || c.tipoClase === tipoFiltro);

  async function handleReservar(ocurrenciaId: string) {
    if (!user) return;
    setAccionId(ocurrenciaId);
    setError(null);
    try {
      const reserva = await clasesApi.reservar(ocurrenciaId, user.id);
      setReservasPorOcurrencia((prev) => ({ ...prev, [ocurrenciaId]: [...(prev[ocurrenciaId] ?? []), reserva] }));
      setMisReservas((prev) => [...prev, reserva]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo reservar.';
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      setError(Array.isArray(raw) ? raw.join(', ') : (raw ?? msg));
    } finally {
      setAccionId(null);
    }
  }

  async function handleCancelar(reservaId: string) {
    setAccionId(reservaId);
    setError(null);
    try {
      await clasesApi.cancelarReserva(reservaId);
      setMisReservas((prev) => prev.filter((r) => r.id !== reservaId));
      setReservasPorOcurrencia((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) next[k] = next[k].filter((r) => r.id !== reservaId);
        return next;
      });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      setError(Array.isArray(raw) ? raw.join(', ') : (raw ?? 'No se pudo cancelar.'));
    } finally {
      setAccionId(null);
    }
  }

  if (loading) return <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-[#6B7280]">Cargando clases...</div>;

  return (
    <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <h2 className="text-2xl font-black tracking-tight text-gray-900">Reservar clase</h2>

      {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500 font-medium">{error}</p>}

      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {tipos.map((t) => {
          const color = t === 'TODOS' ? '#8B2EFF' : colorPorTipo(t).borde;
          const activo = tipoFiltro === t;
          return (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold border transition-all ${activo ? 'text-white border-transparent' : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'}`}
              style={activo ? { backgroundColor: color } : {}}
            >
              {t === 'TODOS' ? 'Todas' : t}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {filtradas.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-sm text-[#6B7280]">No hay clases para ese filtro.</p>
          </Card>
        ) : (
          filtradas.map((clase) => {
            const proximas = (ocurrenciasPorClase[clase.id] ?? [])
              .filter((o) => o.estado === 'PROGRAMADA' && inicioOcurrencia(o) >= limiteReserva)
              .sort((a, b) => inicioOcurrencia(a) - inicioOcurrencia(b));
            const color = colorPorTipo(clase.tipoClase);
            return (
              <div key={clase.id} className="bg-white rounded-[1.75rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: color.borde + '15', color: color.borde }}>{clase.tipoClase}</span>
                      <h4 className="text-base font-black tracking-tight text-gray-900 mt-1.5">{clase.tipoClase}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">con {clase.instructor.nombre} · {clase.sede.nombre}</p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color.borde + '15' }}>
                      <CalendarDays size={20} style={{ color: color.borde }} />
                    </div>
                  </div>
                </div>
                <div className="px-5 pb-5 space-y-2">
                  {proximas.length === 0 ? (
                    <p className="text-xs text-[#6B7280]">Sin fechas próximas por ahora.</p>
                  ) : (
                    proximas.map((o) => {
                      const reservas = reservasPorOcurrencia[o.id] ?? [];
                      const ocupadas = reservas.filter((r) => r.estado === 'RESERVADA').length;
                      const llena = ocupadas >= clase.capacidad;
                      const pctOcupacion = clase.capacidad > 0 ? ocupadas / clase.capacidad : 0;
                      const colorCupo = llena ? '#DC2626' : pctOcupacion >= 0.8 ? '#D97706' : '#16A34A';
                      const yaReservada = misReservas.some((r) => r.ocurrencia.id === o.id);
                      return (
                        <div key={o.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all ${yaReservada ? 'bg-[#F3EAFF] border-[#8B2EFF]/20' : 'bg-gray-50 border-gray-100'}`}>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-gray-900">{formatearFecha(o.fecha)} · {o.horaInicio.slice(0, 5)} - {o.horaFin.slice(0, 5)}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colorCupo }} />
                              <p className="text-xs text-gray-400">{ocupadas}/{clase.capacidad} lugares</p>
                            </div>
                          </div>
                          {yaReservada ? (
                            <Badge variant="violet">Ya reservada</Badge>
                          ) : (
                            <button
                              onClick={() => handleReservar(o.id)}
                              disabled={accionId === o.id}
                              className="text-xs font-bold px-3.5 py-1.5 rounded-full border transition-all text-white border-transparent disabled:opacity-60"
                              style={{ backgroundColor: color.borde }}
                            >
                              {accionId === o.id ? '...' : llena ? 'Espera' : 'Reservar'}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Mis reservas</h2>
        {misReservas.length === 0 ? (
          <Card className="text-center py-6">
            <p className="text-sm text-[#6B7280]">Todavía no tenés reservas.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {misReservas.map((r) => (
              <div key={r.id} className="bg-white rounded-[1.75rem] border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: colorPorTipo(r.ocurrencia.clase.tipoClase).borde + '15' }}>
                  <Clock size={18} style={{ color: colorPorTipo(r.ocurrencia.clase.tipoClase).borde }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{r.ocurrencia.clase.tipoClase}</p>
                  <p className="text-xs text-gray-400">{formatearFecha(r.ocurrencia.fecha)} · {r.ocurrencia.horaInicio.slice(0, 5)}</p>
                  <div className="mt-1"><Badge variant={r.estado === 'LISTA_ESPERA' ? 'amber' : 'green'}>{r.estado}</Badge></div>
                </div>
                <button
                  onClick={() => handleCancelar(r.id)}
                  disabled={accionId === r.id}
                  className="text-xs text-red-500 font-bold bg-red-50 border border-red-100 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors disabled:opacity-60"
                >
                  {accionId === r.id ? '...' : 'Cancelar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
