import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Building2, ClipboardList, Clock3, MapPin, Plus, Tag, TrendingUp } from 'lucide-react';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { clasesApi } from '../../clases/clases.api';
import { Badge, Button, Card, PageHeader, Pagination, ProgressBar, StatCard } from '../../../shared/components/ui';

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
  const navigate = useNavigate();
  const [usos, setUsos] = useState<UsoSede[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSedes, setTotalSedes] = useState(0);

  useEffect(() => {
    async function cargar() {
      try {
        const sedesRes = await sedesApi.getAll(page);
        setTotalPages(sedesRes.totalPages);
        setTotalSedes(sedesRes.total);
        const sedes = sedesRes.data;
        const lista = await Promise.all(
          sedes.map(async (sede) => {
            const [franjas, clases] = await Promise.all([
              sedesApi.getFranjas(sede.id).catch(() => []),
              clasesApi.getAll(sede.id, 1, 100).catch(() => ({ data: [] as never[] })),
            ]);
            // Las franjas aplican los 7 días (no distinguen día de semana),
            // así que la disponibilidad DIARIA se multiplica ×7 para la semanal.
            const disponibles =
              franjas.reduce(
                (acc, f) => acc + Math.max(0, (aMinutos(f.cierre) - aMinutos(f.apertura)) / 60),
                0,
              ) * 7;
            const usadas = clases.data
              .filter((c) => c.activa !== false)
              .reduce((acc, c) => acc + Number(c.horasSemanalesTotales ?? 0), 0);
            return { sede, usadas, disponibles };
          }),
        );
        setUsos(lista);
      } catch {
        setError('No se pudieron cargar las sedes.');
      } finally {
        setLoading(false);
      }
    }
    void cargar();
  }, [page]);

  const activas = usos.filter((u) => u.sede.activa).length;
  const horasTotales = usos.reduce((acc, u) => acc + u.disponibles, 0);
  const top = usos.reduce<UsoSede | null>((mejor, actual) => {
    const pct = (u: UsoSede) => (u.disponibles > 0 ? (u.usadas / u.disponibles) * 100 : 0);
    if (!mejor) return actual;
    return pct(actual) > pct(mejor) ? actual : mejor;
  }, null);
  const topPct = top && top.disponibles > 0 ? Math.round((top.usadas / top.disponibles) * 100) : 0;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Sedes"
        action={
          <Button size="sm" onClick={() => navigate('/admin/sedes')}>
            <Plus size={16} /> Nueva sede
          </Button>
        }
      />
      <p className="-mt-4 mb-4 text-sm text-[#6B7280]">
        Elegí una sede para ver su calendario semanal y crear clases.
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total sedes" value={String(totalSedes)} icon={Building2} iconColor="#8B2EFF" />
        <StatCard label="Sedes activas" value={String(activas)} icon={Activity} iconColor="#16A34A" />
        <StatCard label="Horas semanales" value={`${horasTotales} h`} icon={Clock3} iconColor="#D97706" />
        <StatCard
          label="Mayor ocupación"
          value={top ? `${topPct}%` : '—'}
          sub={top ? top.sede.nombre : undefined}
          icon={TrendingUp}
          iconColor="#8B2EFF"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          {loading ? (
            <p className="text-sm text-[#6B7280]">Cargando sedes...</p>
          ) : usos.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-sm text-[#6B7280]">Todavía no hay sedes.</p>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {usos.map(({ sede, usadas, disponibles }) => {
                const pct = disponibles > 0 ? (usadas / disponibles) * 100 : 0;
                const color = pct >= 100 ? '#9CA3AF' : pct >= 70 ? '#F59E0B' : '#8B2EFF';
                return (
                  <Card key={sede.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3E8FF] text-[#8B2EFF]">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <h2 className="text-sm font-semibold text-[#111111]">{sede.nombre}</h2>
                          <p className="mt-1 flex items-center gap-1 text-xs text-[#6B7280]">
                            <MapPin size={13} />
                            {sede.direccion}
                          </p>
                        </div>
                      </div>
                      <Badge variant={sede.activa ? 'green' : 'gray'}>
                        {sede.activa ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-baseline justify-between">
                        <p className="text-xs text-[#6B7280]">Horas semanales usadas</p>
                        <p className="text-sm font-bold text-[#111111]">
                          {usadas} / {disponibles} h
                        </p>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={pct} color={color} />
                      </div>
                    </div>

                    <div className="mt-4">
                      <Link to={`/admin/clases/${sede.id}`}>
                        <Button variant="outline" fullWidth>
                          Ver horarios
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <div className="mt-4">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-base font-bold text-[#111111]">Acciones Rápidas</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <Button fullWidth onClick={() => navigate('/admin/sedes')}>
              <Plus size={16} /> Nueva sede
            </Button>
            <Button variant="outline" fullWidth onClick={() => navigate('/admin/reservas-clases')}>
              <ClipboardList size={16} /> Ver reservas de clases
            </Button>
            <Button variant="outline" fullWidth onClick={() => navigate('/admin/precios')}>
              <Tag size={16} /> Configurar precios
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
