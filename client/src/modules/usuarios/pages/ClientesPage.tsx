import { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { usuariosApi, type ClienteAfiliado, type TipoCliente } from '../usuarios.api';
import { Avatar, Badge, Pagination } from '../../../shared/components/ui';
import { Select } from '../../../shared/components/Select';
import { MetricCard } from '../../../shared/components/MetricCard';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { useTitulo } from '../../../shared/hooks/useTitulo';

const TIPO_LABEL: Record<TipoCliente, string> = {
  SOCIO: 'Socio',
  EXTERNO: 'Externo',
  INSTRUCTOR: 'Instructor',
};

const PLAN_LABEL: Record<string, string> = {
  MENSUAL: 'Mensual',
  TRIMESTRAL: 'Trimestral',
  ANUAL: 'Anual',
};

const OPCIONES_TIPO = [
  { value: 'SOCIO', label: 'Socios' },
  { value: 'EXTERNO', label: 'Externos' },
  { value: 'INSTRUCTOR', label: 'Instructores' },
];

const OPCIONES_ESTADO = [
  { value: 'ACTIVO', label: 'Activos' },
  { value: 'BAJA', label: 'De baja' },
];

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// Pantalla de solo lectura para el Gerente General: todas las personas afiliadas
// a la cadena (socios, externos e instructores). El filtrado, el orden (bajas al
// final) y la paginación los resuelve el servidor.
export function ClientesPage() {
  useTitulo('Clientes');
  const [filas, setFilas] = useState<ClienteAfiliado[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [tipo, setTipo] = useState<TipoCliente | ''>('');
  const [estado, setEstado] = useState<'ACTIVO' | 'BAJA' | ''>('');

  // La búsqueda se aplica con una pequeña espera para no pedir en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError(false);
    usuariosApi
      .getClientes({ page, q: busquedaAplicada, tipo, estado })
      .then((res) => {
        if (!viva) return;
        setFilas(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setCargando(false));
    return () => {
      viva = false;
    };
  }, [page, busquedaAplicada, tipo, estado, recarga]);

  const hayFiltros = Boolean(busquedaAplicada || tipo || estado);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Clientes</h2>
          <p>Socios, externos e instructores de la cadena. Solo lectura.</p>
        </div>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard
          label={hayFiltros ? 'Coincidencias' : 'Total de afiliados'}
          value={cargando && filas.length === 0 ? '—' : String(total)}
          change={hayFiltros ? 'con los filtros aplicados' : 'en la cadena'}
          icon={Users}
        />
      </div>

      <section className="glass panel" aria-label="Listado de clientes">
        <div className="filters" style={{ boxShadow: 'none', marginBottom: 14 }}>
          <div className="select-field">
            <span className="field-label">TIPO</span>
            <Select
              value={tipo}
              onChange={(v) => {
                setTipo(v as TipoCliente | '');
                setPage(1);
              }}
              placeholder="Todos los tipos"
              ariaLabel="Filtrar por tipo"
              opciones={OPCIONES_TIPO}
            />
          </div>
          <div className="select-field">
            <span className="field-label">ESTADO</span>
            <Select
              value={estado}
              onChange={(v) => {
                setEstado(v as 'ACTIVO' | 'BAJA' | '');
                setPage(1);
              }}
              placeholder="Todos los estados"
              ariaLabel="Filtrar por estado"
              opciones={OPCIONES_ESTADO}
            />
          </div>
          <div className="select-field">
            <span className="field-label">BUSCAR</span>
            <label className="search search-wide">
              <Search size={15} aria-hidden />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, apellido, DNI o email..."
                aria-label="Buscar clientes"
              />
            </label>
          </div>
        </div>

        {cargando ? (
          <LoadingState rows={5} label="Cargando clientes" />
        ) : error ? (
          <ErrorState title="No pudimos cargar los clientes" onRetry={() => setRecarga((n) => n + 1)} />
        ) : filas.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hayFiltros ? 'Nadie coincide con el filtro' : 'Todavía no hay clientes'}
            description={hayFiltros ? 'Probá con otra búsqueda o quitá algún filtro.' : 'Cuando se registren socios, externos o instructores van a aparecer acá.'}
          />
        ) : (
          <div className="ops-table" style={{ ['--cols' as string]: '2fr 0.9fr 1fr 1.2fr 1.4fr 0.8fr' }}>
            <div className="ops-row ops-head">
              <span>NOMBRE</span>
              <span>TIPO</span>
              <span>DNI</span>
              <span>CONTACTO</span>
              <span>SEDE / MEMBRESÍA</span>
              <span>ESTADO</span>
            </div>
            {filas.map((c) => {
              const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ');
              return (
                <div className="ops-row" key={`${c.tipo}-${c.id}`} style={c.activo ? undefined : { opacity: 0.55 }}>
                  <div className="person-cell">
                    <Avatar name={nombre} size={34} />
                    <span>
                      <strong>{nombre}</strong>
                      {c.email && <small>{c.email}</small>}
                    </span>
                  </div>
                  <span data-label="TIPO">{TIPO_LABEL[c.tipo]}</span>
                  <span data-label="DNI">{c.dni ?? '—'}</span>
                  <span data-label="CONTACTO">{c.telefono ?? '—'}</span>
                  <span data-label="SEDE / MEMBRESÍA">
                    {c.sede?.nombre ?? '—'}
                    {c.membresia && (
                      <small style={{ display: 'block' }}>
                        {PLAN_LABEL[c.membresia.plan] ?? c.membresia.plan} · vence {formatearFecha(c.membresia.vencimiento)}
                      </small>
                    )}
                  </span>
                  <span data-label="ESTADO">
                    <Badge variant={c.activo ? 'success' : 'neutral'}>{c.activo ? 'Activo' : 'Baja'}</Badge>
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
