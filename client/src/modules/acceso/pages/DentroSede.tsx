import { useEffect, useMemo, useState } from 'react';
import { Building2, Search, UserCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { accesoApi } from '../acceso.api';
import type { SesionAbierta } from '../acceso.types';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { TipoActor } from '../../../shared/types/enums';
import { Pagination } from '../../../shared/components/ui';
import { Select } from '../../../shared/components/Select';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { useTitulo } from '../../../shared/hooks/useTitulo';

function haceCuanto(horaIngreso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(horaIngreso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `hace ${h} h` : `hace ${h} h ${m} min`;
}

export function DentroSede() {
  useTitulo('Quién está dentro');
  const { user } = useAuth();
  const esGerente = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  // Registrar egresos es solo del Recepcionista; los gerentes ven la lista sin acciones.
  const puedeEgreso = user?.tipoActor === TipoActor.RECEPCIONISTA;
  const [sedeId, setSedeId] = useState<string | null>(user?.sedeId ?? null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sesiones, setSesiones] = useState<SesionAbierta[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [egresandoId, setEgresandoId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.sedeId) {
      setSedeId(user.sedeId);
    } else if (esGerente) {
      sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
    }
  }, [user, esGerente]);

  useEffect(() => {
    if (!sedeId) {
      setLoading(false);
      return;
    }
    let viva = true;
    setLoading(true);
    setError(false);
    accesoApi
      .listarDentro(sedeId, page)
      .then((res) => {
        if (!viva) return;
        setSesiones(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .catch(() => {
        if (!viva) return;
        setSesiones([]);
        setTotal(0);
        setError(true);
      })
      .finally(() => viva && setLoading(false));
    return () => {
      viva = false;
    };
  }, [sedeId, page, recarga]);

  // La búsqueda filtra la página actual (el endpoint no filtra por texto).
  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return sesiones;
    return sesiones.filter((s) => `${s.usuario.nombre} ${s.usuario.apellido}`.toLowerCase().includes(texto));
  }, [sesiones, busqueda]);

  async function handleEgreso(usuarioId: string, nombre: string) {
    setEgresandoId(usuarioId);
    setMsg(null);
    try {
      await accesoApi.registrarEgreso({ usuarioId });
      setMsg({ type: 'ok', text: `Egreso registrado: ${nombre}` });
      if (!sedeId) return;
      const res = await accesoApi.listarDentro(sedeId, page);
      if (res.data.length === 0 && page > 1) {
        setPage(page - 1);
      } else {
        setSesiones(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      }
    } catch {
      setMsg({ type: 'err', text: 'No se pudo registrar el egreso.' });
    } finally {
      setEgresandoId(null);
    }
  }

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Quién está dentro{total > 0 ? ` (${total})` : ''}</h2>
          <p>Personas con ingreso sin egreso registrado en la sede.</p>
        </div>
      </div>

      <section className="glass panel" aria-label="Personas dentro de la sede">
        <div className="filters" style={{ boxShadow: 'none', marginBottom: 14 }}>
          {esGerente && (
            <div className="select-field">
              <span className="field-label">SEDE</span>
              <Select
                value={sedeId ?? ''}
                onChange={(v) => {
                  setSedeId(v || null);
                  setPage(1);
                }}
                placeholder="Seleccionar sede..."
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
                placeholder="Buscar por nombre..."
                aria-label="Buscar por nombre"
              />
            </label>
          </div>
        </div>

        {msg && (
          <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginBottom: 14 }}>
            {msg.text}
          </p>
        )}

        {loading ? (
          <LoadingState rows={4} label="Cargando personas" />
        ) : !sedeId ? (
          <EmptyState icon={Building2} title="Elegí una sede" description="Seleccioná una sede para ver quién está dentro." />
        ) : error ? (
          <ErrorState onRetry={() => setRecarga((n) => n + 1)} />
        ) : filtradas.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title={busqueda ? 'Nadie coincide con la búsqueda' : 'No hay nadie adentro'}
            description={busqueda ? 'Probá con otro nombre.' : 'Cuando se valide un ingreso, la persona aparece acá.'}
          />
        ) : (
          <>
            <SectionHeader title="Adentro ahora" description="Ordenadas por quien lleva más tiempo." />
            <div className="stack-list">
              {filtradas.map((s) => {
                const nombre = `${s.usuario.nombre} ${s.usuario.apellido}`;
                const ocupado = egresandoId === s.usuario.id;
                return (
                  <div className="list-row" key={s.id}>
                    <span className="avatar" aria-hidden>
                      {`${s.usuario.nombre[0] ?? ''}${s.usuario.apellido[0] ?? ''}`.toUpperCase()}
                    </span>
                    <div className="row-main">
                      <strong>{nombre}</strong>
                      <span>
                        Ingresó {s.horaIngreso.slice(0, 5)} · {haceCuanto(s.horaIngreso)}
                      </span>
                    </div>
                    {puedeEgreso && (
                      <button className="btn btn-secondary" onClick={() => void handleEgreso(s.usuario.id, nombre)} disabled={ocupado}>
                        {ocupado ? 'Registrando...' : 'Registrar egreso'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>
    </>
  );
}
