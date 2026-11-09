import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Activity, Building2, ClipboardList, Clock3, MapPin, TrendingUp } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { clasesApi } from '../../clases/clases.api';
import { Badge, ProgressBar } from '../../../shared/components/atoms';
import { Pagination } from '../../../shared/components/molecules';
import { MetricCard } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

function aMinutos(hora: string) {
  const [h = '0', m = '0'] = hora.slice(0, 5).split(':');
  return Number(h) * 60 + Number(m);
}

interface UsoSede {
  sede: Sede;
  usadas: number;
  disponibles: number;
}

export function SedesConHorarios() {
  useTitulo('Clases');
  const navigate = useNavigate();
  const { user } = useAuth();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  const [usos, setUsos] = useState<UsoSede[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSedes, setTotalSedes] = useState(0);

  useEffect(() => {
    // El Gerente de Sede no elige sede: va directo al calendario de la suya.
    if (!esGG) return;
    let viva = true;
    async function cargar() {
      setLoading(true);
      setError(false);
      try {
        const sedesRes = await sedesApi.getAll(page);
        const lista = await Promise.all(
          sedesRes.data.map(async (sede) => {
            const [franjas, clases] = await Promise.all([
              sedesApi.getFranjas(sede.id).catch(() => []),
              clasesApi.getAll(sede.id, 1, 100).catch(() => ({ data: [] as never[] })),
            ]);
            // Las franjas aplican los 7 días (no distinguen día de semana),
            // así que la disponibilidad DIARIA se multiplica ×7 para la semanal.
            const disponibles =
              franjas.reduce((acc, f) => acc + Math.max(0, (aMinutos(f.cierre) - aMinutos(f.apertura)) / 60), 0) * 7;
            const usadas = clases.data
              .filter((c) => c.activa !== false)
              .reduce((acc, c) => acc + Number(c.horasSemanalesTotales ?? 0), 0);
            return { sede, usadas, disponibles };
          }),
        );
        if (!viva) return;
        setTotalPages(sedesRes.totalPages);
        setTotalSedes(sedesRes.total);
        setUsos(lista);
      } catch {
        if (viva) setError(true);
      } finally {
        if (viva) setLoading(false);
      }
    }
    void cargar();
    return () => {
      viva = false;
    };
  }, [page, recarga, esGG]);

  if (!esGG) {
    return user?.sedeId ? <Navigate to={`/admin/clases/${user.sedeId}`} replace /> : <Navigate to="/admin/sin-sede" replace />;
  }

  const activas = usos.filter((u) => u.sede.activa).length;
  const horasTotales = usos.reduce((acc, u) => acc + u.disponibles, 0);
  const top = usos.reduce<UsoSede | null>((mejor, actual) => {
    const pct = (u: UsoSede) => (u.disponibles > 0 ? (u.usadas / u.disponibles) * 100 : 0);
    if (!mejor) return actual;
    return pct(actual) > pct(mejor) ? actual : mejor;
  }, null);
  const topPct = top && top.disponibles > 0 ? Math.round((top.usadas / top.disponibles) * 100) : 0;

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Clases por sede</h2>
          <p>Elegí una sede para ver su calendario semanal y crear clases.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/reservas-clases')}>
          <ClipboardList size={15} aria-hidden /> Reservas de clases
        </button>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard label="Total de sedes" value={loading && !usos.length ? '—' : String(totalSedes)} change="en la red" icon={Building2} />
        <MetricCard label="Sedes activas" value={loading && !usos.length ? '—' : String(activas)} change="en esta página" icon={Activity} />
        <MetricCard label="Horas semanales" value={loading && !usos.length ? '—' : `${horasTotales} h`} change="disponibles según franjas" icon={Clock3} />
        <MetricCard label="Mayor ocupación" value={top ? `${topPct}%` : '—'} change={top ? top.sede.nombre : 'sin datos'} icon={TrendingUp} />
      </div>

      {loading ? (
        <LoadingState rows={3} label="Cargando sedes" />
      ) : error ? (
        <ErrorState title="No pudimos cargar las sedes" onRetry={() => setRecarga((n) => n + 1)} />
      ) : usos.length === 0 ? (
        <EmptyState icon={Building2} title="Todavía no hay sedes" description="Creá una sede para empezar a programar clases." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {usos.map(({ sede, usadas, disponibles }) => {
            const pct = disponibles > 0 ? (usadas / disponibles) * 100 : 0;
            const color = pct >= 100 ? '#ff826c' : pct >= 70 ? '#ffd071' : '#caff3d';
            return (
              <article key={sede.id} className="glass panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 15, color: 'var(--text)' }}>{sede.nombre}</strong>
                    <p style={{ marginTop: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} aria-hidden /> {sede.direccion}
                    </p>
                  </div>
                  <Badge variant={sede.activa ? 'success' : 'neutral'}>{sede.activa ? 'Activa' : 'Inactiva'}</Badge>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                    <span>Horas semanales usadas</span>
                    <strong style={{ color: 'var(--text)' }}>
                      {usadas} / {disponibles} h
                    </strong>
                  </div>
                  <ProgressBar value={pct} color={color} />
                </div>
                <Link to={`/admin/clases/${sede.id}`} className="btn btn-secondary" style={{ marginTop: 'auto' }}>
                  Ver horarios
                </Link>
              </article>
            );
          })}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </>
  );
}
