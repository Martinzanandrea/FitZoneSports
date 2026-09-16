import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock3, Search, AlertTriangle, Users } from 'lucide-react';
import { Badge, Button, Card, Chip, Pagination, StatCard } from '../../../shared/components/ui';
import { adminApi, type ReservaCanchaAdminItem, type ReservaClaseAdminItem, type ReservasAdminPaginadas } from '../admin.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';

export function ReservasPage() {
  const navigate = useNavigate();
  const [reservas, setReservas] = useState<ReservasAdminPaginadas | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedeFiltro, setSedeFiltro] = useState('TODAS');
  const [fecha, setFecha] = useState('');
  const [estado, setEstado] = useState('TODOS');
  const [tipo, setTipo] = useState<'TODOS' | 'CLASE' | 'CANCHA'>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  // Un solo page/limit compartido: el backend pagina ambos sub-listados juntos.
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    adminApi.getReservas(page).then((res) => { setReservas(res); setTotalPages(Math.max(res.clases.totalPages, res.canchas.totalPages)); }).catch(() => setError(true)).finally(() => setCargando(false));
    sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
  }, [page]);

  // TODO: estos filtros solo aplican a la página actual, no al total — filtrar server-side en el futuro.
  const clases: ReservaClaseAdminItem[] = useMemo(() => (reservas?.clases.data ?? []).filter((reserva) => {
    const coincideSede = sedeFiltro === 'TODAS' || reserva.sede === sedes.find((s) => s.id === sedeFiltro)?.nombre;
    const coincideFecha = !fecha || reserva.fecha === fecha;
    const coincideEstado = estado === 'TODOS' || reserva.estado === estado;
    const texto = `${reserva.clase} ${reserva.sede} ${reserva.usuario}`.toLowerCase();
    return coincideSede && coincideFecha && coincideEstado && texto.includes(busqueda.toLowerCase());
  }), [reservas, fecha, estado, busqueda, sedeFiltro, sedes]);

  const canchas: ReservaCanchaAdminItem[] = useMemo(() => (reservas?.canchas.data ?? []).filter((reserva) => {
    const coincideSede = sedeFiltro === 'TODAS' || reserva.sede === sedes.find((s) => s.id === sedeFiltro)?.nombre;
    const coincideFecha = !fecha || reserva.fecha === fecha;
    const coincideEstado = estado === 'TODOS' || reserva.estado === estado;
    const texto = `${reserva.cancha} ${reserva.sede} ${reserva.usuario}`.toLowerCase();
    return coincideSede && coincideFecha && coincideEstado && texto.includes(busqueda.toLowerCase());
  }), [reservas, fecha, estado, busqueda, sedeFiltro, sedes]);

  const mostrarClases = tipo === 'TODOS' || tipo === 'CLASE';
  const mostrarCanchas = tipo === 'TODOS' || tipo === 'CANCHA';
  const alertaOcupacion = (reservas?.resumen.clasesConOcupacionAlta ?? 0) > 0;

  // "Canceladas hoy" no es derivable (las filas no traen fecha de cancelación),
  // así que se omiten; lista de espera sí se puede contar.
  const statsReservas = useMemo(() => {
    const cl = reservas?.clases.data ?? [];
    const ca = reservas?.canchas.data ?? [];
    return {
      clasesActivas: cl.filter((r) => r.estado === 'RESERVADA').length,
      canchasActivas: ca.filter((r) => r.estado === 'CONFIRMADA').length,
      enEspera: cl.filter((r) => r.estado === 'LISTA_ESPERA').length,
    };
  }, [reservas]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111111]">Reservas</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Consultá las reservas de todas las sedes.</p>
      </div>

      {alertaOcupacion && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
          <AlertTriangle size={18} /> Atención: {reservas?.resumen.clasesConOcupacionAlta} clase(s) con ocupación &gt;80% hoy. Revisá la capacidad.
        </div>
      )}

      {error && <p className="mb-6 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">No se pudieron cargar las reservas.</p>}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Clases activas" value={cargando ? '...' : String(statsReservas.clasesActivas)} icon={CalendarDays} />
        <StatCard label="Canchas activas" value={cargando ? '...' : String(statsReservas.canchasActivas)} icon={Clock3} iconColor="#16A34A" />
        <StatCard label="En lista de espera" value={cargando ? '...' : String(statsReservas.enEspera)} icon={Users} iconColor="#D97706" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <Chip label="Todas las sedes" active={sedeFiltro === 'TODAS'} onClick={() => setSedeFiltro('TODAS')} />
        {sedes.map((s) => <Chip key={s.id} label={s.nombre} active={sedeFiltro === s.id} onClick={() => setSedeFiltro(s.id)} />)}
      </div>

      <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por sede, usuario o actividad" className="w-full rounded-lg border border-[#E5E7EB] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} />
          </label>
          <label>
            <span className="sr-only">Fecha</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} />
          </label>
          <label>
            <span className="sr-only">Estado</span>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }}>
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
            <button key={opcion} type="button" onClick={() => setTipo(opcion)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tipo === opcion ? 'bg-[#8B2EFF] text-white' : 'border border-[#E5E7EB] text-[#6B7280]'}`} style={{ minHeight: 44 }}>
              {opcion === 'TODOS' ? 'Todas' : opcion === 'CLASE' ? 'Clases' : 'Canchas'}
            </button>
          ))}
        </div>
      </div>

      {mostrarClases && <section className="mb-6"><h2 className="mb-3 text-base font-bold text-[#111111]">Clases reservadas</h2>{clases.length === 0 ? <Empty text="No hay clases que coincidan con los filtros." /> : <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[#E5E7EB] text-left text-xs text-[#6B7280] uppercase tracking-wide"><th className="px-5 py-3 font-medium">Socio</th><th className="px-5 py-3 font-medium">Clase</th><th className="px-5 py-3 font-medium">Fecha/Hora</th><th className="px-5 py-3 font-medium">Estado</th><th className="px-5 py-3 font-medium">Acciones</th></tr></thead><tbody>{clases.map((reserva) => (<tr key={reserva.id} className="border-b border-[#E5E7EB] last:border-0"><td className="px-5 py-3.5 font-medium text-[#111111]">{reserva.usuario}</td><td className="px-5 py-3.5 text-[#374151]">{reserva.clase}<span className="block text-xs text-[#6B7280]">{reserva.sede}</span></td><td className="px-5 py-3.5 text-[#374151] whitespace-nowrap">{reserva.fecha} · {reserva.horario}</td><td className="px-5 py-3.5"><Badge variant={reserva.estado === 'LISTA_ESPERA' ? 'amber' : reserva.estado === 'CANCELADA' ? 'red' : 'green'}>{reserva.estado}</Badge></td><td className="px-5 py-3.5 text-xs text-[#6B7280] whitespace-nowrap">Cupo {reserva.ocupadas}/{reserva.capacidad}</td></tr>))}</tbody></table></div></div>}</section>}

      {mostrarCanchas && <section><h2 className="mb-3 text-base font-bold text-[#111111]">Canchas reservadas</h2>{canchas.length === 0 ? <Empty text="No hay canchas que coincidan con los filtros." /> : <div className="space-y-2">{canchas.map((reserva) => <Card key={reserva.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-[#111111]">{reserva.cancha}</p><p className="mt-1 text-xs text-[#6B7280]">{reserva.sede} · {reserva.usuario}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#6B7280]"><CalendarDays size={13} />{reserva.fecha} · <Clock3 size={13} />{reserva.horario}</p></div><div className="flex items-center gap-3"><span className="text-sm font-bold text-[#111111]">${reserva.precioFinal}</span><Badge variant={reserva.estado === 'CANCELADA' ? 'red' : 'green'}>{reserva.estado}</Badge></div></Card>)}</div>}</section>}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
      <div>
        <h2 className="mb-3 text-base font-bold text-[#111111]">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <Button fullWidth onClick={() => navigate('/admin/clases')}>Ver calendario de clases</Button>
          <Button variant="outline" fullWidth onClick={() => navigate('/admin/canchas')}>Ver canchas</Button>
        </div>
      </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <Card className="py-6 text-center text-sm text-[#6B7280]">{text}</Card>;
}
