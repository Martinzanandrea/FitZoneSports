import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Search } from 'lucide-react';
import { Badge, Card } from '../../../shared/components/ui';
import { adminApi, type ReservaAdmin } from '../admin.api';

export function ReservasPage() {
  const [reservas, setReservas] = useState<ReservaAdmin | null>(null);
  const [fecha, setFecha] = useState('');
  const [estado, setEstado] = useState('TODOS');
  const [tipo, setTipo] = useState<'TODOS' | 'CLASE' | 'CANCHA'>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminApi.getReservas().then(setReservas).catch(() => setError(true)).finally(() => setCargando(false));
  }, []);

  const clases = useMemo(() => (reservas?.clases ?? []).filter((reserva) => {
    const coincideFecha = !fecha || reserva.fecha === fecha;
    const coincideEstado = estado === 'TODOS' || reserva.estado === estado;
    const texto = `${reserva.clase} ${reserva.sede} ${reserva.usuario}`.toLowerCase();
    return coincideFecha && coincideEstado && texto.includes(busqueda.toLowerCase());
  }), [reservas, fecha, estado, busqueda]);

  const canchas = useMemo(() => (reservas?.canchas ?? []).filter((reserva) => {
    const coincideFecha = !fecha || reserva.fecha === fecha;
    const coincideEstado = estado === 'TODOS' || reserva.estado === estado;
    const texto = `${reserva.cancha} ${reserva.sede} ${reserva.usuario}`.toLowerCase();
    return coincideFecha && coincideEstado && texto.includes(busqueda.toLowerCase());
  }), [reservas, fecha, estado, busqueda]);

  const mostrarClases = tipo === 'TODOS' || tipo === 'CLASE';
  const mostrarCanchas = tipo === 'TODOS' || tipo === 'CANCHA';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111111]">Reservas</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Consultá las reservas de todas las sedes.</p>
      </div>

      {error && <p className="mb-6 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">No se pudieron cargar las reservas.</p>}

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Metric label="Canchas reservadas" value={reservas?.resumen.canchasReservadas} loading={cargando} />
        <Metric label="Clases con 80% o más de ocupación" value={reservas?.resumen.clasesConOcupacionAlta} loading={cargando} />
      </div>

      <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por sede, usuario o actividad" className="w-full rounded-lg border border-[#E5E7EB] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#8B2EFF]" />
          </label>
          <label>
            <span className="sr-only">Fecha</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" />
          </label>
          <label>
            <span className="sr-only">Estado</span>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]">
              <option value="TODOS">Todos los estados</option>
              <option value="CONFIRMADA">Confirmada</option>
              <option value="RESERVADA">Reservada</option>
              <option value="LISTA_ESPERA">Lista de espera</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          {(['TODOS', 'CLASE', 'CANCHA'] as const).map((opcion) => (
            <button key={opcion} type="button" onClick={() => setTipo(opcion)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tipo === opcion ? 'bg-[#8B2EFF] text-white' : 'border border-[#E5E7EB] text-[#6B7280]'}`}>
              {opcion === 'TODOS' ? 'Todas' : opcion === 'CLASE' ? 'Clases' : 'Canchas'}
            </button>
          ))}
        </div>
      </div>

      {mostrarClases && <section className="mb-6"><h2 className="mb-3 text-base font-bold text-[#111111]">Clases reservadas</h2>{clases.length === 0 ? <Empty text="No hay clases que coincidan con los filtros." /> : <div className="space-y-2">{clases.map((reserva) => <Card key={reserva.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-[#111111]">{reserva.clase}</p><p className="mt-1 text-xs text-[#6B7280]">{reserva.sede} · {reserva.usuario}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#6B7280]"><CalendarDays size={13} />{reserva.fecha} · <Clock3 size={13} />{reserva.horario}</p></div><div className="flex items-center gap-3"><span className="text-xs text-[#6B7280]">Cupo {reserva.ocupadas}/{reserva.capacidad}</span><Badge variant={reserva.estado === 'LISTA_ESPERA' ? 'amber' : reserva.estado === 'CANCELADA' ? 'red' : 'green'}>{reserva.estado}</Badge></div></Card>)}</div>}</section>}

      {mostrarCanchas && <section><h2 className="mb-3 text-base font-bold text-[#111111]">Canchas reservadas</h2>{canchas.length === 0 ? <Empty text="No hay canchas que coincidan con los filtros." /> : <div className="space-y-2">{canchas.map((reserva) => <Card key={reserva.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-[#111111]">{reserva.cancha}</p><p className="mt-1 text-xs text-[#6B7280]">{reserva.sede} · {reserva.usuario}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#6B7280]"><CalendarDays size={13} />{reserva.fecha} · <Clock3 size={13} />{reserva.horario}</p></div><div className="flex items-center gap-3"><span className="text-sm font-bold text-[#111111]">${reserva.precioFinal}</span><Badge variant={reserva.estado === 'CANCELADA' ? 'red' : 'green'}>{reserva.estado}</Badge></div></Card>)}</div>}</section>}
    </div>
  );
}

function Metric({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return <div className="rounded-xl border border-[#E5E7EB] bg-white p-4"><p className="text-2xl font-extrabold text-[#111111]">{loading ? '...' : value ?? 0}</p><p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <Card className="py-6 text-center text-sm text-[#6B7280]">{text}</Card>;
}
