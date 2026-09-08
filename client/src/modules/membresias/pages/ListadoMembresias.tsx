import { useEffect, useMemo, useState } from 'react';
import { membresiasApi } from '../membresias.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Membresia } from '../membresias.types';
import type { Sede } from '../../sedes/sedes.types';
import { TipoActor } from '../../../shared/types/enums';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Chip, PageHeader } from '../../../shared/components/ui';

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

export function ListadoMembresias() {
  const { user } = useAuth();
  const esGerente = user?.tipoActor === TipoActor.GERENTE;

  const [membresias, setMembresias] = useState<Membresia[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('TODOS');
  const [filtroSede, setFiltroSede] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setCargando(true);
    membresiasApi
      .getAll()
      .then((data) => {
        setMembresias(data);
        setError('');
      })
      .catch(() => {
        setMembresias([]);
        setError('No se pudieron cargar las membresías.');
      })
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!esGerente) return;
    sedesApi.getAll().then(setSedes).catch(() => setSedes([]));
  }, [esGerente]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return membresias.filter((m) => {
      if (filtroEstado !== 'TODOS' && m.estado !== filtroEstado) return false;
      if (filtroSede && m.sedeAlta.id !== filtroSede) return false;
      if (texto) {
        const nombre = `${m.usuario?.nombre ?? ''} ${m.usuario?.apellido ?? ''}`.toLowerCase();
        const dni = (m.usuario?.dni ?? '').toLowerCase();
        if (!nombre.includes(texto) && !dni.includes(texto)) return false;
      }
      return true;
    });
  }, [membresias, filtroEstado, filtroSede, busqueda]);

  return (
    <div>
      <PageHeader title="Membresías" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTROS_ESTADO.map((f) => (
          <Chip key={f.value} label={f.label} active={filtroEstado === f.value} onClick={() => setFiltroEstado(f.value)} />
        ))}
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#6B7280] uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Nombre completo</th>
                <th className="px-5 py-3 font-medium">DNI</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Fecha inicio</th>
                <th className="px-5 py-3 font-medium">Fecha fin</th>
                <th className="px-5 py-3 font-medium">Sede</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((m) => (
                <tr key={m.id} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="px-5 py-3.5 font-medium text-[#111111]">
                    {m.usuario ? `${m.usuario.nombre} ${m.usuario.apellido}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-[#374151]">{m.usuario?.dni ?? '—'}</td>
                  <td className="px-5 py-3.5 text-[#374151]">{m.plan}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={badgePorEstado[m.estado]}>{m.estado}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-[#374151]">{m.fechaInicio}</td>
                  <td className="px-5 py-3.5 text-[#374151]">{m.fechaFin}</td>
                  <td className="px-5 py-3.5 text-[#374151]">{m.sedeAlta.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length === 0 && (
            <p className="p-8 text-center text-sm text-[#6B7280]">No hay membresías que coincidan con el filtro</p>
          )}
        </div>
      )}
    </div>
  );
}
