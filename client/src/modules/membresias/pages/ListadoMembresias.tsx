import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClock, UserCheck, UserPlus, Users } from 'lucide-react';
import { membresiasApi } from '../membresias.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Membresia } from '../membresias.types';
import type { Sede } from '../../sedes/sedes.types';
import { TipoActor } from '../../../shared/types/enums';
import { useAuth } from '../../auth/AuthContext';
import { Avatar, Badge, Button, Chip, PageHeader, Pagination, StatCard } from '../../../shared/components/ui';

type FiltroEstado = 'TODOS' | 'ACTIVO' | 'VENCIDO' | 'SUSPENDIDO';

const FILTROS_ESTADO: { value: FiltroEstado; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'VENCIDO', label: 'Vencido' },
  { value: 'SUSPENDIDO', label: 'Suspendido' },
];

const badgePorEstado: Record<Exclude<FiltroEstado, 'TODOS'>, 'green' | 'red' | 'amber'> = {
  ACTIVO: 'green',
  VENCIDO: 'red',
  SUSPENDIDO: 'amber',
};

function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// fechaFin viene como "YYYY-MM-DD": comparación lexicográfica válida.
function esPorVencer(fechaFin: string) {
  const hoy = ymdLocal(new Date());
  const limite = ymdLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  return fechaFin >= hoy && fechaFin <= limite;
}

function esNuevoEsteMes(creadaEn: string) {
  const d = new Date(creadaEn);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

type TabVista = 'LISTADO' | 'ESTADO';
type CategoriaSemaforo = 'VENCIDAS' | 'DIAS_0_7' | 'DIAS_8_15' | 'DIAS_15_MAS';

function diasHasta(fechaFin: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(`${fechaFin}T00:00:00`);
  return Math.floor((fin.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

function categoriaDe(m: Membresia): CategoriaSemaforo | null {
  if (m.estado === 'VENCIDO') return 'VENCIDAS';
  if (m.estado !== 'ACTIVO') return null;
  const dias = diasHasta(m.fechaFin);
  if (dias <= 7) return 'DIAS_0_7';
  if (dias <= 15) return 'DIAS_8_15';
  return 'DIAS_15_MAS';
}

const CATEGORIAS_SEMAFORO: Array<{
  value: CategoriaSemaforo;
  label: string;
  card: string;
  numero: string;
}> = [
  { value: 'VENCIDAS', label: 'Vencidas', card: 'bg-[#FEF2F2] border-[#FECACA]', numero: 'text-[#DC2626]' },
  { value: 'DIAS_0_7', label: 'Vencen en 0-7 días', card: 'bg-[#FFFBEB] border-[#FDE68A]', numero: 'text-[#D97706]' },
  { value: 'DIAS_8_15', label: 'Vencen en 8-15 días', card: 'bg-[#FEF9C3] border-[#FDE68A]', numero: 'text-[#CA8A04]' },
  { value: 'DIAS_15_MAS', label: 'Vencen en 15+ días', card: 'bg-[#F0FDF4] border-[#BBF7D0]', numero: 'text-[#16A34A]' },
];

export function ListadoMembresias() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const esGerente = user?.tipoActor === TipoActor.GERENTE;

  const [membresias, setMembresias] = useState<Membresia[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('TODOS');
  const [filtroSede, setFiltroSede] = useState('');
  const [soloPorVencer, setSoloPorVencer] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, activos: 0, porVencer: 0, nuevos: 0 });
  const [tab, setTab] = useState<TabVista>('LISTADO');
  const [catSel, setCatSel] = useState<CategoriaSemaforo>('VENCIDAS');
  // Muestra compartida para stats y semáforo (mismo fetch, sin duplicar la llamada).
  const [muestra, setMuestra] = useState<Membresia[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    membresiasApi.getAll(page)
      .then((res) => {
        setMembresias(res.data);
        setTotalPages(res.totalPages);
        setError('');
      })
      .catch(() => {
        setMembresias([]);
        setError('No se pudieron cargar las membresías.');
      })
      .finally(() => setCargando(false));
  }, [page]);

  useEffect(() => {
    // Dataset para las estadísticas. Nota: el backend limita limit a 100,
    // así que con más de 100 membresías estos números serían parciales.
    membresiasApi.getAll(1, 100).then((res) => {
      setMuestra(res.data);
      setStats({
        total: res.total,
        activos: res.data.filter((m) => m.estado === 'ACTIVO').length,
        porVencer: res.data.filter((m) => esPorVencer(m.fechaFin)).length,
        nuevos: res.data.filter((m) => esNuevoEsteMes(m.creadaEn)).length,
      });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!esGerente) return;
    sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
  }, [esGerente]);

  // TODO: este filtro solo aplica a la página actual, no al total — filtrar server-side en el futuro.
  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return membresias.filter((m) => {
      if (filtroEstado !== 'TODOS' && m.estado !== filtroEstado) return false;
      if (filtroSede && m.sedeAlta.id !== filtroSede) return false;
      if (soloPorVencer && !esPorVencer(m.fechaFin)) return false;
      if (texto) {
        const nombre = `${m.usuario?.nombre ?? ''} ${m.usuario?.apellido ?? ''}`.toLowerCase();
        const dni = (m.usuario?.dni ?? '').toLowerCase();
        if (!nombre.includes(texto) && !dni.includes(texto)) return false;
      }
      return true;
    });
  }, [membresias, filtroEstado, filtroSede, soloPorVencer, busqueda]);

  const conteoSemaforo = useMemo(() => {
    const mapa: Record<CategoriaSemaforo, number> = {
      VENCIDAS: 0,
      DIAS_0_7: 0,
      DIAS_8_15: 0,
      DIAS_15_MAS: 0,
    };
    for (const m of muestra) {
      const cat = categoriaDe(m);
      if (cat) mapa[cat]++;
    }
    return mapa;
  }, [muestra]);

  const detalleSemaforo = useMemo(
    () => muestra.filter((m) => categoriaDe(m) === catSel),
    [muestra, catSel],
  );

  return (
    <div>
      <PageHeader title="Socios" />
      <p className="mt-1 mb-6 text-sm text-[#6B7280]">Gestioná las membresías de tu cadena</p>

      <div className="mb-6 flex gap-2">
        <Chip label="Listado" active={tab === 'LISTADO'} onClick={() => setTab('LISTADO')} />
        <Chip label="Estado de membresías" active={tab === 'ESTADO'} onClick={() => setTab('ESTADO')} />
      </div>

      {tab === 'LISTADO' ? (
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard label="Total" value={String(stats.total)} icon={Users} />
        <StatCard label="Activos" value={String(stats.activos)} icon={UserCheck} iconColor="#16A34A" />
        <StatCard label="Por vencer" value={String(stats.porVencer)} icon={AlarmClock} iconColor="#D97706" />
        <StatCard label="Nuevos este mes" value={String(stats.nuevos)} icon={UserPlus} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTROS_ESTADO.map((f) => (
          <Chip key={f.value} label={f.label} active={filtroEstado === f.value} onClick={() => setFiltroEstado(f.value)} />
        ))}
        <Chip label="Por vencer" active={soloPorVencer} onClick={() => setSoloPorVencer((v) => !v)} />
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o DNI..."
          className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF] md:max-w-xs"
          style={{ minHeight: 44 }}
        />
        {esGerente && (
          <select
            value={filtroSede}
            onChange={(e) => setFiltroSede(e.target.value)}
            className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF] md:max-w-xs"
            style={{ minHeight: 44 }}
            aria-label="Filtrar por sede"
          >
            <option value="">Todas las sedes</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {cargando ? (
        <p className="p-8 text-center text-sm text-[#6B7280]">Cargando membresías...</p>
      ) : error ? (
        <p className="p-8 text-center text-sm text-[#DC2626]">{error}</p>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#6B7280] uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Socio</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((m) => {
                  const nombre = m.usuario ? `${m.usuario.nombre} ${m.usuario.apellido}` : '—';
                  return (
                    <tr key={m.id} className="border-b border-[#E5E7EB] last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={nombre} size={36} />
                          <div>
                            <p className="font-medium text-[#111111]">{nombre}</p>
                            <p className="text-xs text-[#6B7280]">DNI {m.usuario?.dni ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={badgePorEstado[m.estado]}>{m.estado}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-[#374151]">{m.plan}</td>
                      <td className="px-5 py-3.5 text-[#374151]">{m.fechaFin}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtradas.length === 0 && (
            <p className="p-8 text-center text-sm text-[#6B7280]">No hay membresías que coincidan con el filtro</p>
          )}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
      <div>
        <h2 className="mb-3 text-base font-bold text-[#111111]">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <Button fullWidth onClick={() => setTab('ESTADO')}>Ver estado de membresías</Button>
          <Button variant="outline" fullWidth onClick={() => navigate('/admin/precios')}>Ir a Precios</Button>
          <Button variant="outline" fullWidth onClick={() => navigate('/admin/personal')}>Ir a Personal</Button>
        </div>
      </div>
      </div>
      ) : (
      <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CATEGORIAS_SEMAFORO.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCatSel(c.value)}
            className={`rounded-2xl border p-4 text-left ${c.card} ${catSel === c.value ? 'ring-2 ring-[#8B2EFF]' : ''}`}
            style={{ minHeight: 44 }}
          >
            <p className={`text-2xl font-bold ${c.numero}`}>{conteoSemaforo[c.value]}</p>
            <p className="mt-1 text-xs font-semibold text-[#374151]">{c.label}</p>
          </button>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#6B7280] uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Socio</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {detalleSemaforo.map((m) => {
                const nombre = m.usuario ? `${m.usuario.nombre} ${m.usuario.apellido}` : '—';
                return (
                  <tr key={m.id} className="border-b border-[#E5E7EB] last:border-0">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={nombre} size={36} />
                        <div>
                          <p className="font-medium text-[#111111]">{nombre}</p>
                          <p className="text-xs text-[#6B7280]">DNI {m.usuario?.dni ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={badgePorEstado[m.estado]}>{m.estado}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-[#374151]">{m.plan}</td>
                    <td className="px-5 py-3.5 text-[#374151]">{m.fechaFin}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {detalleSemaforo.length === 0 && (
          <p className="p-8 text-center text-sm text-[#6B7280]">No hay registros en esta categoría</p>
        )}
      </div>
      </>
      )}
    </div>
  );
}
