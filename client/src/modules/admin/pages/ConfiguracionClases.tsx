import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { clasesApi } from '../../clases/clases.api';
import type { Clase } from '../../clases/clases.types';
import { Badge, Button, Card, Chip, PageHeader } from '../../../shared/components/ui';
import { colorPorTipo } from '../../../shared/utils/colorClase';

type Tab = 'ACTIVIDADES' | 'INSTRUCTORES' | 'RECURRENCIA';

export function ConfiguracionClases() {
  const [tab, setTab] = useState<Tab>('ACTIVIDADES');
  const [clases, setClases] = useState<Clase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    clasesApi
      .getAll(undefined, 1, 100)
      .then((res) => setClases(res.data.filter((c) => c.activa !== false)))
      .catch(() => setError('No se pudieron cargar las clases.'))
      .finally(() => setLoading(false));
  }, []);

  const porTipo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of clases) mapa.set(c.tipoClase, (mapa.get(c.tipoClase) ?? 0) + 1);
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
  }, [clases]);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Configuración de Clases" onBack={() => window.history.back()} />

      <div className="mb-6 flex gap-2">
        <Chip label="Actividades" active={tab === 'ACTIVIDADES'} onClick={() => setTab('ACTIVIDADES')} />
        <Chip label="Instructores" active={tab === 'INSTRUCTORES'} onClick={() => setTab('INSTRUCTORES')} />
        <Chip label="Recurrencia" active={tab === 'RECURRENCIA'} onClick={() => setTab('RECURRENCIA')} />
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      )}

      {tab === 'ACTIVIDADES' && (
        <Card>
          {loading ? (
            <p className="text-sm text-[#6B7280]">Cargando actividades...</p>
          ) : porTipo.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Todavía no hay tipos de clase cargados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#6B7280] uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Clases activas</th>
                </tr>
              </thead>
              <tbody>
                {porTipo.map(([tipo, cantidad]) => {
                  const color = colorPorTipo(tipo);
                  return (
                    <tr key={tipo} className="border-b border-[#E5E7EB] last:border-0">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-medium text-[#111111]">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: color.borde }}
                          />
                          {tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="violet">{cantidad}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'INSTRUCTORES' && (
        <Card className="text-center py-8">
          <p className="text-sm font-semibold text-[#111111]">Los instructores se gestionan en su propia pantalla</p>
          <p className="mt-1 text-xs text-[#6B7280]">Altas, datos y clases asignadas por instructor.</p>
          <div className="mt-4">
            <Link to="/admin/instructores">
              <Button>Ir a Instructores</Button>
            </Link>
          </div>
        </Card>
      )}

      {tab === 'RECURRENCIA' && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-[#111111]">Cómo se generan las clases</p>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Las clases son plantillas semanales: al crear una se generan automáticamente sus
            fechas concretas (ocurrencias) para las próximas 4 semanas, y un proceso automático
            semanal mantiene siempre esa ventana hacia adelante sin que tengas que hacer nada.
          </p>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Si desactivás una clase, deja de generar fechas nuevas pero lo ya generado y reservado
            queda intacto. Cada sede tiene una única sala, así que dos clases nunca se superponen
            en la misma sede: el sistema no te deja guardar horarios solapados.
          </p>
        </Card>
      )}
    </div>
  );
}
