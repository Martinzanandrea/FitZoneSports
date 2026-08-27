import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { canchasApi } from '../canchas.api';
import type { Cancha, ReservaCancha } from '../canchas.types';
import { Badge, Button, Card, Chip } from '../../../shared/components/ui';

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

  const fechas = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);

  useEffect(() => {
    canchasApi.getAll().then((data) => {
      setCanchas(data);
      if (data.length) setCanchaId(data[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!canchaId) return;
    canchasApi.getReservasPorCancha(canchaId, fecha).then(setReservas).catch(() => setReservas([]));
  }, [canchaId, fecha]);

  const ocupadas = useMemo(() => new Set(reservas.filter((r) => r.estado === 'CONFIRMADA').map((r) => r.horaInicio.slice(0,5))), [reservas]);

  async function handleReservar(hora: number) {
    if (!user || !canchaId) return;
    const horaInicio = `${String(hora).padStart(2,'0')}:00`;
    const horaFin = `${String(hora+1).padStart(2,'0')}:00`;
    setReservando(horaInicio);
    setMsg(null);
    setUltimaReserva(null);
    try {
      const r = await canchasApi.reservar({ canchaId, usuarioId: user.id, fecha, horaInicio, horaFin });
      setUltimaReserva(r);
      setMsg({ type: 'ok', text: `Reserva confirmada — $${r.precioFinal} (${r.estrategiaPrecio})` });
      setReservas((prev) => [...prev, r]);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: ax.response?.data?.message ?? 'No se pudo reservar.' });
    } finally {
      setReservando(null);
    }
  }

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

  if (loading) return <div className="max-w-lg mx-auto px-4 py-6 text-sm text-[#6B7280]">Cargando canchas...</div>;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#111111]">Reservar canchas</h1>
        <p className="text-sm text-[#6B7280] mt-1">Elegí cancha, fecha y horario.</p>
      </div>

      {msg && <p className={`rounded-lg border p-3 text-sm ${msg.type==='ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>{msg.text}</p>}
      {ultimaReserva && <Card className="bg-[#F3E8FF] border-[#DDD6FE]"><p className="text-sm text-[#6B7280]">Precio final: <span className="font-bold text-[#111111]">${ultimaReserva.precioFinal}</span> <Badge variant="violet">{ultimaReserva.estrategiaPrecio}</Badge></p></Card>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {fechas.map((d) => {
          const f = formatFecha(d);
          return <Chip key={f} label={d.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short' })} active={fecha===f} onClick={() => setFecha(f)} />;
        })}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#111111]">Cancha</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {canchas.map((c) => (
            <button key={c.id} onClick={() => setCanchaId(c.id)} className={`rounded-xl px-4 py-3 text-sm font-semibold border whitespace-nowrap ${canchaId===c.id ? 'bg-[#8B2EFF] text-white border-[#8B2EFF]' : 'bg-white text-[#111111] border-[#E5E7EB]'}`} style={{minHeight:44}}>
              {c.nombre} · {c.tipo} · ${c.costoHoraBase}/h
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {HORAS.map((h) => {
          const hi = `${String(h).padStart(2,'0')}:00`;
          const ocupado = ocupadas.has(hi);
          const hf = `${String(h+1).padStart(2,'0')}:00`;
          return (
            <div key={hi} className={`rounded-xl border p-3 text-center ${ocupado ? 'bg-[#F3F4F6] border-[#E5E7EB] opacity-60' : 'bg-white border-[#E5E7EB]'}`}>
              <p className="text-sm font-semibold text-[#111111]">{hi} - {hf}</p>
              <p className="text-xs mt-1"><Badge variant={ocupado ? 'gray' : 'green'}>{ocupado ? 'Ocupada' : 'Disponible'}</Badge></p>
              {!ocupado && <Button size="sm" fullWidth className="mt-2" onClick={() => handleReservar(h)} disabled={reservando===hi}>{reservando===hi ? '...' : 'Reservar'}</Button>}
            </div>
          );
        })}
      </div>

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
