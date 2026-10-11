import { useEffect, useMemo, useState } from 'react';
import { AlarmClock, CreditCard, Search, UserCheck, UserX } from 'lucide-react';
import { membresiasApi } from '../membresias.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Membresia } from '../membresias.types';
import type { Sede } from '../../sedes/sedes.types';
import { TipoActor } from '../../../shared/types/enums';
import { useAuth } from '../../auth/AuthContext';
import { Avatar, Badge, Chip } from '../../../shared/components/atoms';
import { Pagination } from '../../../shared/components/molecules';
import { Select } from '../../../shared/components/atoms';;
import { MetricCard } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { useTitulo } from '../../../shared/hooks/useTitulo';

type Semaforo = 'ACTIVO' | 'POR_VENCER' | 'VENCIDO' | 'SUSPENDIDO';
type Filtro = 'TODOS' | Semaforo;

const DIAS_POR_VENCER = 7;

const ETIQUETA: Record<Semaforo, string> = {
  ACTIVO: 'Activo',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  SUSPENDIDO: 'Suspendido',
};

// Verde (--success), ámbar (--warning), coral (danger) y neutro.
const VARIANTE: Record<Semaforo, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVO: 'success',
  POR_VENCER: 'warning',
  VENCIDO: 'danger',
  SUSPENDIDO: 'neutral',
};

function diasHasta(fechaFin: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(`${fechaFin}T00:00:00`);
  return Math.round((fin.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

function semaforoDe(m: Membresia): Semaforo {
  if (m.estado === 'VENCIDO') return 'VENCIDO';
  if (m.estado === 'SUSPENDIDO') return 'SUSPENDIDO';
  const dias = diasHasta(m.fechaFin);
  if (dias < 0) return 'VENCIDO';
  return dias <= DIAS_POR_VENCER ? 'POR_VENCER' : 'ACTIVO';
}

function textoVencimiento(m: Membresia, s: Semaforo): string {
  const dias = diasHasta(m.fechaFin);
  if (s === 'POR_VENCER') return dias === 0 ? 'vence hoy' : `en ${dias} ${dias === 1 ? 'día' : 'días'}`;
  if (s === 'VENCIDO' && dias < 0) return `hace ${-dias} ${dias === -1 ? 'día' : 'días'}`;
  return '';
}

export function ListadoMembresias() {
  useTitulo('Membresías');
  const { user } = useAuth();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;

  const [membresias, setMembresias] = useState<Membresia[]>([]);
  const [muestra, setMuestra] = useState<Membresia[]>([]);
  const [total, setTotal] = useState(0);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [filtroSede, setFiltroSede] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError(false);
    membresiasApi
      .getAll(page)
      .then((res) => {
        if (!viva) return;
        setMembresias(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setCargando(false));
    return () => {
      viva = false;
    };
  }, [page, recarga]);

  // Muestra para los contadores (el backend limita a 100 por pedido).
  useEffect(() => {
    membresiasApi
      .getAll(1, 100)
      .then((res) => setMuestra(res.data))
      .catch(() => setMuestra([]));
  }, [recarga]);

  useEffect(() => {
    // El GS no elige sede: el backend ya le devuelve solo la suya.
    if (!esGG) return;
    sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
  }, [esGG]);

  const conteo = useMemo(() => {
    const c: Record<Semaforo, number> = { ACTIVO: 0, POR_VENCER: 0, VENCIDO: 0, SUSPENDIDO: 0 };
    for (const m of muestra) c[semaforoDe(m)]++;
    return c;
  }, [muestra]);

  // Los filtros aplican a la página cargada.
  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return membresias.filter((m) => {
      if (filtro !== 'TODOS' && semaforoDe(m) !== filtro) return false;
      if (esGG && filtroSede && m.sedeAlta.id !== filtroSede) return false;
      if (texto) {
        const nombre = `${m.usuario?.nombre ?? ''} ${m.usuario?.apellido ?? ''}`.toLowerCase();
        if (!nombre.includes(texto) && !(m.usuario?.dni ?? '').toLowerCase().includes(texto)) return false;
      }
      return true;
    });
  }, [membresias, filtro, filtroSede, busqueda, esGG]);

  const sinDatos = cargando && muestra.length === 0;
  const cols = esGG ? '2fr 1fr 1fr 1.1fr 1fr' : '2fr 1fr 1.1fr 1fr';

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Membresías</h2>
          <p>{esGG ? 'Estado de las membresías de toda la red.' : 'Estado de las membresías de tu sede.'}</p>
        </div>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard label="Total" value={cargando && !total ? '—' : String(total)} change={esGG ? 'en la red' : 'en tu sede'} icon={CreditCard} />
        <MetricCard label="Activas" value={sinDatos ? '—' : String(conteo.ACTIVO)} change="al día" icon={UserCheck} />
        <MetricCard label="Por vencer" value={sinDatos ? '—' : String(conteo.POR_VENCER)} change={`en ${DIAS_POR_VENCER} días o menos`} icon={AlarmClock} />
        <MetricCard label="Vencidas" value={sinDatos ? '—' : String(conteo.VENCIDO)} change="requieren renovación" icon={UserX} />
      </div>

      <section className="glass panel" aria-label="Listado de membresías">
        <div className="inline-actions" style={{ marginBottom: 12 }}>
          {(['TODOS', 'ACTIVO', 'POR_VENCER', 'VENCIDO', 'SUSPENDIDO'] as Filtro[]).map((f) => (
            <Chip key={f} label={f === 'TODOS' ? 'Todas' : ETIQUETA[f]} active={filtro === f} onClick={() => setFiltro(f)} />
          ))}
        </div>

        <div className="filters" style={{ boxShadow: 'none', marginBottom: 14 }}>
          {esGG && (
            <div className="select-field">
              <span className="field-label">SEDE</span>
              <Select
                value={filtroSede}
                onChange={setFiltroSede}
                placeholder="Todas las sedes"
                ariaLabel="Filtrar por sede"
                opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
              />
            </div>
          )}
          <div className="select-field">
            <span className="field-label">BUSCAR</span>
            <label className="search search-wide">
              <Search size={15} aria-hidden />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o DNI..."
                aria-label="Buscar por nombre o DNI"
              />
            </label>
          </div>
        </div>

        {cargando ? (
          <LoadingState rows={4} label="Cargando membresías" />
        ) : error ? (
          <ErrorState title="No pudimos cargar las membresías" onRetry={() => setRecarga((n) => n + 1)} />
        ) : filtradas.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={membresias.length === 0 ? 'Todavía no hay membresías' : 'Ninguna membresía coincide'}
            description={membresias.length === 0 ? 'Cuando un socio contrate un plan aparece acá.' : 'Probá con otro estado, sede o búsqueda.'}
          />
        ) : (
          <div className="ops-table" style={{ ['--cols' as string]: cols }}>
            <div className="ops-row ops-head">
              <span>SOCIO</span>
              <span>PLAN</span>
              {esGG && <span>SEDE</span>}
              <span>VENCIMIENTO</span>
              <span>ESTADO</span>
            </div>
            {filtradas.map((m) => {
              const s = semaforoDe(m);
              const nombre = m.usuario ? `${m.usuario.nombre} ${m.usuario.apellido}` : '—';
              const aviso = textoVencimiento(m, s);
              return (
                <div className="ops-row" key={m.id}>
                  <div className="person-cell">
                    <Avatar name={nombre} size={34} />
                    <span>
                      <strong>{nombre}</strong>
                      <small>DNI {m.usuario?.dni ?? '—'}</small>
                    </span>
                  </div>
                  <span data-label="PLAN">{m.plan}</span>
                  {esGG && <span data-label="SEDE">{m.sedeAlta.nombre}</span>}
                  <span data-label="VENCE">
                    <span className="ops-strong">{m.fechaFin}</span>
                    {aviso && ` · ${aviso}`}
                  </span>
                  <span>
                    <Badge variant={VARIANTE[s]}>{ETIQUETA[s]}</Badge>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>
    </>
  );
}
