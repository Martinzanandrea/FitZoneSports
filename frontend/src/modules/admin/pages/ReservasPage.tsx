import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarDays, ClipboardList, Clock3, Search, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../../../shared/components/atoms';
import { Pagination } from '../../../shared/components/molecules';
import { Select } from '../../../shared/components/atoms';;
import { MetricCard } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { adminApi, type ReservaCanchaAdminItem, type ReservaClaseAdminItem, type ReservasAdminPaginadas } from '../admin.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

const ESTADOS = [
  { value: 'TODOS', label: 'Todos los estados' },
  { value: 'CONFIRMADA', label: 'Confirmada' },
  { value: 'RESERVADA', label: 'Reservada' },
  { value: 'LISTA_ESPERA', label: 'Lista de espera' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

function tonoEstado(estado: string): 'success' | 'warning' | 'danger' {
  return estado === 'LISTA_ESPERA' ? 'warning' : estado === 'CANCELADA' ? 'danger' : 'success';
}

export function ReservasPage() {
  useTitulo('Reservas');
  const navigate = useNavigate();
  const { user } = useAuth();
  // El GS ve solo su sede (el backend ya acota /admin/reservas): sin selector.
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  const [reservas, setReservas] = useState<ReservasAdminPaginadas | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedeFiltro, setSedeFiltro] = useState('TODAS');
  const [fecha, setFecha] = useState('');
  const [estado, setEstado] = useState('TODOS');
  const [tipo, setTipo] = useState<'TODOS' | 'CLASE' | 'CANCHA'>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  // Un solo page/limit compartido: el backend pagina ambos sub-listados juntos.
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!esGG) return;
    sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
  }, [esGG]);

  useEffect(() => {
    let viva = true;
    setCargando(true);
    setError(false);
    adminApi
      .getReservas(page)
      .then((res) => {
        if (!viva) return;
        setReservas(res);
        setTotalPages(Math.max(res.clases.totalPages, res.canchas.totalPages));
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setCargando(false));
    return () => {
      viva = false;
    };
  }, [page, recarga]);

  // Estos filtros aplican a la página actual, no al total.
  const nombreSede = useMemo(() => sedes.find((s) => s.id === sedeFiltro)?.nombre, [sedes, sedeFiltro]);
  const pasa = useCallback(
    (r: { sede: string; fecha: string; estado: string }, texto: string) =>
      (!esGG || sedeFiltro === 'TODAS' || r.sede === nombreSede) &&
      (!fecha || r.fecha === fecha) &&
      (estado === 'TODOS' || r.estado === estado) &&
      texto.toLowerCase().includes(busqueda.trim().toLowerCase()),
    [esGG, sedeFiltro, nombreSede, fecha, estado, busqueda],
  );

  const clases: ReservaClaseAdminItem[] = useMemo(
    () => (reservas?.clases.data ?? []).filter((r) => pasa(r, `${r.clase} ${r.sede} ${r.usuario}`)),
    [reservas, pasa],
  );
  const canchas: ReservaCanchaAdminItem[] = useMemo(
    () => (reservas?.canchas.data ?? []).filter((r) => pasa(r, `${r.cancha} ${r.sede} ${r.usuario}`)),
    [reservas, pasa],
  );

  const mostrarClases = tipo === 'TODOS' || tipo === 'CLASE';
  const mostrarCanchas = tipo === 'TODOS' || tipo === 'CANCHA';
  const ocupacionAlta = reservas?.resumen.clasesConOcupacionAlta ?? 0;

  // Lista de espera sí se puede contar; "canceladas hoy" no (las filas no traen fecha de cancelación).
  const stats = useMemo(() => {
    const cl = reservas?.clases.data ?? [];
    const ca = reservas?.canchas.data ?? [];
    return {
      clasesActivas: cl.filter((r) => r.estado === 'RESERVADA').length,
      canchasActivas: ca.filter((r) => r.estado === 'CONFIRMADA').length,
      enEspera: cl.filter((r) => r.estado === 'LISTA_ESPERA').length,
    };
  }, [reservas]);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Reservas</h2>
          <p>{esGG ? 'Consultá las reservas de todas las sedes.' : 'Consultá las reservas de tu sede.'}</p>
        </div>
        <div className="inline-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/admin/clases')}>
            <CalendarDays size={15} aria-hidden /> Calendario de clases
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/canchas')}>
            <ClipboardList size={15} aria-hidden /> Canchas
          </button>
        </div>
      </div>

      {ocupacionAlta > 0 && (
        <p role="status" className="notice notice-err" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} aria-hidden /> Atención: {ocupacionAlta} clase(s) con ocupación mayor al 80% hoy. Revisá la capacidad.
        </p>
      )}

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard label="Clases reservadas" value={cargando ? '—' : String(stats.clasesActivas)} change="en esta página" icon={CalendarDays} />
        <MetricCard label="Canchas confirmadas" value={cargando ? '—' : String(stats.canchasActivas)} change="en esta página" icon={Clock3} />
        <MetricCard label="En lista de espera" value={cargando ? '—' : String(stats.enEspera)} change="en esta página" icon={Users} />
      </div>

      <section className="glass panel" aria-label="Reservas">
        <div className="filters" style={{ boxShadow: 'none', marginBottom: 14 }}>
          {esGG && (
            <div className="select-field">
              <span className="field-label">SEDE</span>
              <Select
                value={sedeFiltro}
                onChange={setSedeFiltro}
                ariaLabel="Sede"
                opciones={[{ value: 'TODAS', label: 'Todas las sedes' }, ...sedes.map((s) => ({ value: s.id, label: s.nombre }))]}
              />
            </div>
          )}
          <div className="select-field">
            <span className="field-label">BUSCAR</span>
            <label className="search search-wide">
              <Search size={15} aria-hidden />
              <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Usuario o actividad" aria-label="Buscar por usuario o actividad" />
            </label>
          </div>
          <div className="select-field">
            <span className="field-label">FECHA</span>
            <input className="field-input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" />
          </div>
          <div className="select-field">
            <span className="field-label">ESTADO</span>
            <Select value={estado} onChange={setEstado} opciones={ESTADOS} ariaLabel="Estado" />
          </div>
        </div>

        <div className="segmented" role="tablist" aria-label="Tipo de reserva">
          {(['TODOS', 'CLASE', 'CANCHA'] as const).map((opcion) => (
            <button key={opcion} role="tab" aria-selected={tipo === opcion} className={tipo === opcion ? 'active' : ''} onClick={() => setTipo(opcion)}>
              {opcion === 'TODOS' ? 'Todas' : opcion === 'CLASE' ? 'Clases' : 'Canchas'}
            </button>
          ))}
        </div>

        {cargando ? (
          <LoadingState rows={4} label="Cargando reservas" />
        ) : error ? (
          <ErrorState title="No pudimos cargar las reservas" onRetry={() => setRecarga((n) => n + 1)} />
        ) : (
          <>
            {mostrarClases && (
              <div style={{ marginBottom: 22 }}>
                <SectionHeader title="Clases reservadas" />
                {clases.length === 0 ? (
                  <EmptyState icon={CalendarDays} title="No hay clases para mostrar" description="Ninguna reserva de clase coincide con los filtros." />
                ) : (
                  <div className="stack-list">
                    {clases.map((r) => (
                      <div className="list-row" key={r.id}>
                        <div className="row-main">
                          <strong>{r.usuario}</strong>
                          <span>
                            {r.clase} · {r.sede} · {r.fecha} · {r.horario} · cupo {r.ocupadas}/{r.capacidad}
                          </span>
                        </div>
                        <Badge variant={tonoEstado(r.estado)}>{r.estado}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mostrarCanchas && (
              <div>
                <SectionHeader title="Canchas reservadas" />
                {canchas.length === 0 ? (
                  <EmptyState icon={Clock3} title="No hay canchas para mostrar" description="Ninguna reserva de cancha coincide con los filtros." />
                ) : (
                  <div className="stack-list">
                    {canchas.map((r) => (
                      <div className="list-row" key={r.id}>
                        <div className="row-main">
                          <strong>{r.cancha}</strong>
                          <span>
                            {r.usuario} · {r.sede} · {r.fecha} · {r.horario} · ${r.precioFinal}
                          </span>
                        </div>
                        <Badge variant={tonoEstado(r.estado)}>{r.estado}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>
    </>
  );
}
