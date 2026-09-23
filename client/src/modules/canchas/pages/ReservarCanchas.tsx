import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { canchasApi } from '../canchas.api';
import type { Cancha, ReservaCancha } from '../canchas.types';
import { TipoCancha } from '../canchas.types';
import { Badge, Button, Card } from '../../../shared/components/ui';

const HORAS = Array.from({ length: 15 }, (_, i) => 8 + i); // 8..22

function formatFecha(d: Date) {
  return d.toISOString().split('T')[0];
}
function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function ReservarCanchas() {
  const { user } = useAuth();
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [canchaId, setCanchaId] = useState<string>('');
  const [fecha, setFecha] = useState<string>(formatFecha(new Date()));
  const [reservas, setReservas] = useState<ReservaCancha[]>([]);
  const [loading, setLoading] = useState(true);
  const [reservando, setReservando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [ultimaReserva, setUltimaReserva] = useState<ReservaCancha | null>(null);
  const [cotizacion, setCotizacion] = useState<{ horaInicio: string; horaFin: string; precioFinal: number; estrategia: string } | null>(null);

  const fechas = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);

  const tipos = useMemo(() => Array.from(new Set(canchas.map((c) => c.tipo))), [canchas]);
  const [tipoSel, setTipoSel] = useState<TipoCancha | ''>('');

  const canchasFiltradas = useMemo(
    () => (tipoSel ? canchas.filter((c) => c.tipo === tipoSel) : canchas),
    [canchas, tipoSel],
  );

  useEffect(() => {
    if (tipos.length > 0 && (tipoSel === '' || !tipos.includes(tipoSel))) setTipoSel(tipos[0]);
  }, [tipos, tipoSel]);

  useEffect(() => {
    if (canchaId && !canchasFiltradas.some((c) => c.id === canchaId) && canchasFiltradas.length > 0) {
      setCanchaId(canchasFiltradas[0].id);
    }
  }, [canchasFiltradas, canchaId]);

  useEffect(() => {
    canchasApi.getAll(1, 100).then((res) => {
      const data = res.data;
      setCanchas(data);
      if (data.length) setCanchaId(data[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!canchaId) return;
    canchasApi.getReservasPorCancha(canchaId, fecha).then((res) => setReservas(res.data)).catch(() => setReservas([]));
  }, [canchaId, fecha]);

  const ocupadas = useMemo(() => new Set(reservas.filter((r) => r.estado === 'CONFIRMADA').map((r) => r.horaInicio.slice(0,5))), [reservas]);

  async function confirmarReserva() {
    if (!user || !canchaId || !cotizacion) return;
    const { horaInicio, horaFin } = cotizacion;
    setReservando(horaInicio);
    setMsg(null);
    try {
      const r = await canchasApi.reservar({ canchaId, usuarioId: user.id, fecha, horaInicio, horaFin });
      setUltimaReserva(r);
      setMsg({ type: 'ok', text: `Reserva confirmada — $${r.precioFinal} (${r.estrategiaPrecio})` });
      setReservas((prev) => [...prev, r]);
      setCotizacion(null);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: ax.response?.data?.message ?? 'No se pudo reservar.' });
    } finally {
      setReservando(null);
    }
  }

  async function handleReservar(hora: number) {
    if (!user || !canchaId) return;
    const horaInicio = `${String(hora).padStart(2,'0')}:00`;
    const horaFin = `${String(hora+1).padStart(2,'0')}:00`;
    setReservando(horaInicio);
    setMsg(null);
    setUltimaReserva(null);
    try {
      const quote = await canchasApi.cotizar({ canchaId, usuarioId: user.id, fecha, horaInicio, horaFin });
      setCotizacion({ horaInicio, horaFin, ...quote });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: ax.response?.data?.message ?? 'No se pudo reservar.' });
    } finally {
      setReservando(null);
    }
  }

  const hoy = formatFecha(new Date());
  const horaActual = new Date().getHours();

  async function handleCancelar(id: string) {
    setReservando(id);
    try {
      await canchasApi.cancelar(id);
      setReservas((prev) => prev.filter((r) => r.id !== id));
      setMsg({ type: 'ok', text: 'Reserva cancelada.' });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: ax.response?.data?.message ?? 'No se pudo cancelar.' });
    } finally {
      setReservando(null);
    }
  }

  if (loading) return <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-[#6B7280]">Cargando canchas...</div>;

  return (
    <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <h2 className="text-2xl font-black tracking-tight text-gray-900">Reservar cancha</h2>

      {msg && <p className={`rounded-2xl border px-4 py-3 text-sm font-medium ${msg.type==='ok' ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : 'border-red-100 bg-red-50 text-red-500'}`}>{msg.text}</p>}
      {ultimaReserva && <Card className="bg-[#F3E8FF] border-[#DDD6FE]"><p className="text-sm text-[#6B7280]">Precio final: <span className="font-bold text-[#111111]">${ultimaReserva.precioFinal}</span> <Badge variant="violet">{ultimaReserva.estrategiaPrecio}</Badge></p></Card>}

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {fechas.map((d, i) => {
          const f = formatFecha(d);
          const activo = fecha === f;
          return (
            <button
              key={f}
              onClick={() => setFecha(f)}
              className={`flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all ${activo ? 'text-white border-transparent' : 'bg-white border-gray-100 text-gray-500'}`}
              style={activo ? { background: 'linear-gradient(135deg, #8B2EFF, #A855F7)' } : {}}
            >
              <span className="uppercase text-[10px]">{i === 0 ? 'hoy' : d.toLocaleDateString('es-AR', { weekday: 'short' })}</span>
              <span className="text-lg font-black leading-tight">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="flex bg-gray-100 rounded-2xl p-1 mb-5">
        {tipos.map((t) => (
          <button
            key={t}
            onClick={() => setTipoSel(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tipoSel === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#111111]">Cancha</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {canchasFiltradas.map((c) => (
            <button key={c.id} onClick={() => setCanchaId(c.id)} className={`rounded-xl px-4 py-3 text-sm font-semibold border whitespace-nowrap ${canchaId===c.id ? 'bg-[#8B2EFF] text-white border-[#8B2EFF]' : 'bg-white text-[#111111] border-[#E5E7EB]'}`} style={{minHeight:44}}>
              {c.nombre} · ${c.costoHoraBase}/h
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {HORAS.map((h) => {
          const hi = `${String(h).padStart(2,'0')}:00`;
          const ocupado = ocupadas.has(hi);
          const vencido = fecha === hoy && h <= horaActual;
          const hf = `${String(h+1).padStart(2,'0')}:00`;
          const libre = !ocupado && !vencido;
          return (
            <button
              key={hi}
              disabled={!libre || reservando !== null}
              onClick={() => handleReservar(h)}
              className={`rounded-2xl p-4 text-left border-2 transition-all ${libre ? 'bg-white border-[#8B2EFF]/20 hover:border-[#8B2EFF]/60 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]' : 'bg-gray-50 border-gray-100 cursor-not-allowed'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-lg font-black ${libre ? 'text-gray-900' : 'text-gray-300'}`}>{hi.slice(0, 5)}</span>
              </div>
              {libre ? (
                <p className="text-xs font-black text-[#8B2EFF]">{reservando === hi ? 'Consultando...' : `${hf} · Tocá para reservar`}</p>
              ) : (
                <p className="text-xs text-gray-300 font-medium">{ocupado ? 'Ocupado' : 'Vencido'}</p>
              )}
            </button>
          );
        })}
      </div>

      {cotizacion && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="confirmar-reserva" onClick={() => setCotizacion(null)}>
          <div className="bg-white rounded-t-[2rem] p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 id="confirmar-reserva" className="text-xl font-black tracking-tight text-gray-900 mb-5">Confirmar reserva</h3>
            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm"><span className="text-gray-400">Fecha y hora</span><span className="font-semibold text-gray-900">{fecha} · {cotizacion.horaInicio} - {cotizacion.horaFin}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Tarifa aplicada</span><span className="font-semibold text-gray-900">{cotizacion.estrategia}</span></div>
              <div className="h-px bg-gray-100 my-2" />
              <div className="flex justify-between"><span className="font-black text-gray-900">Total a pagar</span><span className="font-black text-2xl text-[#8B2EFF]">${cotizacion.precioFinal}</span></div>
            </div>
            <Button fullWidth onClick={() => void confirmarReserva()} disabled={reservando !== null}>{reservando ? 'Reservando...' : 'Confirmar y pagar'}</Button>
            <button className="w-full py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setCotizacion(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {reservas.filter((r)=>r.usuario.id===user?.id && r.estado==='CONFIRMADA').length>0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#111111]">Mis reservas para {fecha}</p>
          {reservas.filter((r)=>r.usuario.id===user?.id && r.estado==='CONFIRMADA').map((r)=>(
            <Card key={r.id} className="flex items-center justify-between">
              <div><p className="text-sm font-semibold">{r.horaInicio.slice(0,5)} - {r.horaFin.slice(0,5)}</p><p className="text-xs text-[#6B7280]">${r.precioFinal} · {r.estrategiaPrecio}</p></div>
              <Button variant="outline" size="sm" onClick={()=>handleCancelar(r.id)} disabled={reservando===r.id}>Cancelar</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
