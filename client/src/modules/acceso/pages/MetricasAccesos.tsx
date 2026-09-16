import { useEffect, useMemo, useState } from 'react';
import { Activity, LogIn, LogOut } from 'lucide-react';
import { accesoApi } from '../acceso.api';
import type { ResumenAccesos } from '../acceso.types';
import { Card, PageHeader, ProgressBar, StatCard } from '../../../shared/components/ui';

export function MetricasAccesos() {
  const [resumen, setResumen] = useState<ResumenAccesos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    accesoApi
      .getResumenAccesos()
      .then((res) => {
        setResumen(res);
        setError('');
      })
      .catch(() => {
        setResumen(null);
        setError('No se pudieron cargar las métricas de accesos.');
      })
      .finally(() => setCargando(false));
  }, []);

  const totales = useMemo(() => {
    const porSede = resumen?.porSede ?? [];
    return {
      aforoActual: porSede.reduce((acc, s) => acc + s.aforoActual, 0),
      aforoMaximo: porSede.reduce((acc, s) => acc + s.aforoMaximo, 0),
    };
  }, [resumen]);

  return (
    <div className="max-w-6xl">
      <PageHeader title="Métricas de accesos" />
      <p className="-mt-4 mb-4 text-sm text-[#6B7280]">
        Ingresos, egresos y aforo de todas las sedes activas. Solo lectura.
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label="Total ingresos hoy"
          value={cargando ? '...' : String(resumen?.totalIngresosHoy ?? 0)}
          icon={LogIn}
          iconColor="#16A34A"
        />
        <StatCard
          label="Total egresos hoy"
          value={cargando ? '...' : String(resumen?.totalEgresosHoy ?? 0)}
          icon={LogOut}
          iconColor="#3B82F6"
        />
        <StatCard
          label="Aforo total actual"
          value={cargando ? '...' : `${totales.aforoActual}/${totales.aforoMaximo}`}
          icon={Activity}
          iconColor="#8B2EFF"
        />
      </div>

      {cargando ? (
        <p className="p-8 text-center text-sm text-[#6B7280]">Cargando métricas...</p>
      ) : !resumen || resumen.porSede.length === 0 ? (
        <Card className="py-8 text-center text-sm text-[#6B7280]">
          No hay sedes activas para mostrar.
        </Card>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#6B7280] uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Sede</th>
                  <th className="px-5 py-3 font-medium">Aforo</th>
                  <th className="px-5 py-3 font-medium">Ingresos hoy</th>
                  <th className="px-5 py-3 font-medium">Egresos hoy</th>
                </tr>
              </thead>
              <tbody>
                {resumen.porSede.map((s) => {
                  const pct =
                    s.aforoMaximo > 0
                      ? Math.min(100, Math.round((s.aforoActual / s.aforoMaximo) * 100))
                      : 0;
                  const color = pct >= 90 ? '#DC2626' : pct >= 70 ? '#D97706' : '#8B2EFF';
                  return (
                    <tr key={s.sedeId} className="border-b border-[#E5E7EB] last:border-0">
                      <td className="px-5 py-3.5 font-medium text-[#111111]">{s.sede}</td>
                      <td className="px-5 py-3.5 text-[#374151]">
                        <div className="flex items-center gap-3">
                          <span className="whitespace-nowrap text-sm font-semibold text-[#111111]">
                            {s.aforoActual}/{s.aforoMaximo}
                          </span>
                          <div className="w-24">
                            <ProgressBar value={pct} color={color} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[#374151]">{s.ingresosHoy}</td>
                      <td className="px-5 py-3.5 text-[#374151]">{s.egresosHoy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
