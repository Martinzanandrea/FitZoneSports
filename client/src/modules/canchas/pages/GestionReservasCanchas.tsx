import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { canchasApi } from '../canchas.api';
import type { Cancha, ReservaCancha } from '../canchas.types';
import { usuariosApi } from '../../usuarios/usuarios.api';
import type { Usuario } from '../../usuarios/usuarios.types';
import { Badge, Button, Card, Chip } from '../../../shared/components/ui';

const HORAS = Array.from({ length: 15 }, (_, i) => 8 + i);

function formatFecha(d: Date) {
  return d.toISOString().split('T')[0];
}
function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function GestionReservasCanchas() {
  const { user } = useAuth();
  const sedeId = user?.sedeId ?? null;

  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [canchaId, setCanchaId] = useState('');
  const [fecha, setFecha] = useState<string>(formatFecha(new Date()));
  const [reservas, setReservas] = useState<ReservaCancha[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [usuarioIdSel, setUsuarioIdSel] = useState('');
  const [loading, setLoading] = useState(true);
  const [reservando, setReservando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [ultimaReserva, setUltimaReserva] = useState<ReservaCancha | null>(null);

  const fechas = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);

  const canchasDeSede = useMemo(() => {
    if (!sedeId) return [];
    return canchas.filter((c) => c.sede.id === sedeId);
  }, [canchas, sedeId]);

  const usuariosFiltrados = useMemo(() => {
    const q = busquedaUsuario.trim().toLowerCase();
    const base = usuarios.filter((u) => u.tipoActor === 'SOCIO' || u.tipoActor === 'EXTERNO');
    if (!q) return base.slice(0, 50);
    return base.filter((u) =>
      `${u.nombre} ${u.apellido} ${u.email} ${u.dni ?? ''}`.toLowerCase().includes(q),
    ).slice(0, 50);
  }, [usuarios, busquedaUsuario]);

  useEffect(() => {
    async function init() {
      try {
        const [allCanchas, allUsuarios] = await Promise.all([canchasApi.getAll(), usuariosApi.getAll()]);
        setCanchas(allCanchas);
        setUsuarios(allUsuarios);
        const filtradas = sedeId ? allCanchas.filter((c) => c.sede.id === sedeId) : [];
        if (filtradas.length) setCanchaId(filtradas[0].id);
      } catch {
        setCanchas([]);
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [sedeId]);

  // si la cancha seleccionada no pertenece a la sede, resetear
  useEffect(() => {
    if (canchasDeSede.length && !canchasDeSede.some((c) => c.id === canchaId)) {
      setCanchaId(canchasDeSede[0].id);
    }
  }, [canchasDeSede, canchaId]);

  useEffect(() => {
    if (!canchaId) return;
    canchasApi.getReservasPorCancha(canchaId, fecha).then(setReservas).catch(() => setReservas([]));
  }, [canchaId, fecha]);

  const ocupadas = useMemo(() => new Set(reservas.filter((r) => r.estado === 'CONFIRMADA').map((r) => r.horaInicio.slice(0, 5))), [reservas]);

  async function handleReservar(hora: number) {
    if (!canchaId) return;
    if (!usuarioIdSel) {
      setMsg({ type: 'err', text: 'Seleccioná un usuario para la reserva.' });
      return;
    }
    const horaInicio = `${String(hora).padStart(2, '0')}:00`;
    const horaFin = `${String(hora + 1).padStart(2, '0')}:00`;
    setReservando(horaInicio);
    setMsg(null);
    setUltimaReserva(null);
    try {
      const r = await canchasApi.reservar({ canchaId, usuarioId: usuarioIdSel, fecha, horaInicio, horaFin });
      setUltimaReserva(r);
      setMsg({ type: 'ok', text: `Reserva confirmada — $${r.precioFinal} (${r.estrategiaPrecio})` });
      setReservas((prev) => [...prev, r]);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const text = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo reservar.';
      setMsg({ type: 'err', text });
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
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const text = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo cancelar.';
      setMsg({ type: 'err', text });
    } finally {
      setReservando(null);
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
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#111111]">Reservas de canchas</h1>
        <p className="text-sm text-[#6B7280] mt-1">Reservá en nombre de un socio/externo. Solo canchas de tu sede.</p>
      </div>

      {msg && <p className={`rounded-lg border p-3 text-sm ${msg.type === 'ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>{msg.text}</p>}
      {ultimaReserva && <Card className="bg-[#F3E8FF] border-[#DDD6FE]"><p className="text-sm text-[#6B7280]">Precio final: <span className="font-bold text-[#111111]">${ultimaReserva.precioFinal}</span> <Badge variant="violet">{ultimaReserva.estrategiaPrecio}</Badge></p></Card>}

      {/* Selector de usuario */}
      <Card>
        <p className="text-sm font-semibold text-[#111111] mb-3">Usuario para la reserva</p>
        <div className="space-y-3">
          <input
            type="text"
            value={busquedaUsuario}
            onChange={(e) => setBusquedaUsuario(e.target.value)}
            placeholder="Buscar por nombre, email o DNI"
            className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
            style={{ minHeight: 44 }}
          />
          <select
            value={usuarioIdSel}
            onChange={(e) => setUsuarioIdSel(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none bg-white"
            style={{ minHeight: 44 }}
          >
            <option value="">Seleccionar usuario…</option>
            {usuariosFiltrados.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre} {u.apellido} — {u.email} — {u.tipoActor}{u.dni ? ` — ${u.dni}` : ''}</option>
            ))}
          </select>
          {usuarioIdSel && <p className="text-xs text-[#6B7280]">Reservarás a nombre del usuario seleccionado. El precio lo calcula el backend.</p>}
        </div>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {fechas.map((d) => {
          const f = formatFecha(d);
          return <Chip key={f} label={d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} active={fecha === f} onClick={() => setFecha(f)} />;
        })}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#111111]">Cancha (solo tu sede)</p>
        {canchasDeSede.length === 0 ? (
          <Card className="text-center py-6"><p className="text-sm text-[#6B7280]">No hay canchas en tu sede.</p></Card>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {canchasDeSede.map((c) => (
              <button key={c.id} onClick={() => setCanchaId(c.id)} className={`rounded-xl px-4 py-3 text-sm font-semibold border whitespace-nowrap ${canchaId === c.id ? 'bg-[#8B2EFF] text-white border-[#8B2EFF]' : 'bg-white text-[#111111] border-[#E5E7EB]'}`} style={{ minHeight: 44 }}>
                {c.nombre} · {c.tipo} · ${c.costoHoraBase}/h
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {HORAS.map((h) => {
          const hi = `${String(h).padStart(2, '0')}:00`;
          const ocupado = ocupadas.has(hi);
          const hf = `${String(h + 1).padStart(2, '0')}:00`;
          return (
            <div key={hi} className={`rounded-xl border p-3 text-center ${ocupado ? 'bg-[#F3F4F6] border-[#E5E7EB] opacity-60' : 'bg-white border-[#E5E7EB]'}`}>
              <p className="text-sm font-semibold text-[#111111]">{hi} - {hf}</p>
              <p className="text-xs mt-1"><Badge variant={ocupado ? 'gray' : 'green'}>{ocupado ? 'Ocupada' : 'Disponible'}</Badge></p>
              {!ocupado && <Button size="sm" fullWidth className="mt-2" onClick={() => handleReservar(h)} disabled={reservando === hi || !usuarioIdSel}>{reservando === hi ? '...' : 'Reservar'}</Button>}
            </div>
          );
        })}
      </div>

      {reservas.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#111111]">Reservas para {fecha}</p>
          {reservas.filter((r) => r.estado === 'CONFIRMADA').map((r) => (
            <Card key={r.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#111111]">{r.horaInicio.slice(0, 5)} - {r.horaFin.slice(0, 5)} · {r.usuario.nombre} {r.usuario.apellido}</p>
                <p className="text-xs text-[#6B7280]">${r.precioFinal} · {r.estrategiaPrecio}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleCancelar(r.id)} disabled={reservando === r.id}>Cancelar</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
