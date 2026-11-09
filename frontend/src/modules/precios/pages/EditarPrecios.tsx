import { useEffect, useState } from 'react';
import { CreditCard, DollarSign, Tag, Users } from 'lucide-react';
import { preciosApi } from '../precios.api';
import type { PrecioPlan } from '../precios.types';
import { adminApi, type PlanPopularidad, type ReporteFinanciero } from '../../admin/admin.api';
import { ProgressBar } from '../../../shared/components/atoms';
import { formatMoney } from '../../../shared/utils/formatMoney';
import { MetricCard } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { useTitulo } from '../../../shared/hooks/useTitulo';

function nombrePlan(plan: string) {
  return plan.charAt(0) + plan.slice(1).toLowerCase();
}

export function EditarPrecios() {
  useTitulo('Precios');
  const [precios, setPrecios] = useState<PrecioPlan[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [popularidad, setPopularidad] = useState<PlanPopularidad[] | null>(null);
  const [financiero, setFinanciero] = useState<ReporteFinanciero | null>(null);

  useEffect(() => {
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    preciosApi
      .getMembresiasPublico()
      .then((data) => {
        if (!viva) return;
        setPrecios(data);
        const init: Record<string, string> = {};
        data.forEach((p) => (init[p.plan] = p.precio));
        setValores(init);
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setLoading(false));
    adminApi.getPopularidadPlanes().then((r) => viva && setPopularidad(r)).catch(() => viva && setPopularidad(null));
    adminApi.getReporteFinanciero().then((r) => viva && setFinanciero(r)).catch(() => viva && setFinanciero(null));
    return () => {
      viva = false;
    };
  }, [recarga]);

  async function guardar(plan: string) {
    const precio = Number(valores[plan]);
    if (!precio || precio <= 0) {
      setMensajes((m) => ({ ...m, [plan]: { ok: false, text: 'Precio inválido' } }));
      return;
    }
    setGuardando(plan);
    setMensajes((m) => ({ ...m, [plan]: { ok: true, text: '' } }));
    try {
      const actualizado = await preciosApi.actualizar(plan, precio);
      setPrecios((prev) => prev.map((p) => (p.plan === plan ? actualizado : p)));
      setMensajes((m) => ({ ...m, [plan]: { ok: true, text: 'Guardado correctamente' } }));
    } catch {
      setMensajes((m) => ({ ...m, [plan]: { ok: false, text: 'No se pudo guardar' } }));
    } finally {
      setGuardando(null);
    }
  }

  const totalSocios = (popularidad ?? []).reduce((acc, p) => acc + p.socios, 0);
  const metodos = financiero?.porMetodo ?? [];
  const totalMetodos = metodos.reduce((acc, m) => acc + Number(m.total), 0);
  const maxMetodo = Math.max(...metodos.map((m) => Number(m.total)), 0);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Precios de membresías</h2>
          <p>Editá los precios de los 3 planes. Se aplican a los pagos nuevos.</p>
        </div>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard label="Planes" value={loading ? '—' : String(precios.length)} change="disponibles" icon={Tag} />
        <MetricCard label="Socios activos" value={popularidad ? String(totalSocios) : '—'} change="en todos los planes" icon={Users} />
        <MetricCard label="Ingresos del mes" value={financiero ? formatMoney(financiero.ingresosMes) : '—'} change="pagos aprobados" icon={DollarSign} />
      </div>

      {loading ? (
        <LoadingState rows={3} label="Cargando precios" />
      ) : error ? (
        <ErrorState title="No pudimos cargar los precios" onRetry={() => setRecarga((n) => n + 1)} />
      ) : precios.length === 0 ? (
        <EmptyState icon={CreditCard} title="No hay planes cargados" description="Los planes de membresía aparecen acá cuando existen en el sistema." />
      ) : (
        <div className="ops-grid">
          <div className="stack-gap">
            {precios.map((p) => {
              const m = mensajes[p.plan];
              return (
                <section key={p.plan} className="glass panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <strong style={{ fontSize: 15, color: 'var(--text)' }}>{nombrePlan(p.plan)}</strong>
                    <p style={{ fontSize: 11, margin: '4px 0 10px' }}>Actual: {formatMoney(Number(p.precio))}</p>
                    <label>
                      <span className="field-label">NUEVO PRECIO</span>
                      <input
                        className="field-input"
                        type="number"
                        min={1}
                        value={valores[p.plan] ?? ''}
                        onChange={(e) => setValores((v) => ({ ...v, [p.plan]: e.target.value }))}
                      />
                    </label>
                    {m?.text && (
                      <p role="status" className={`notice ${m.ok ? 'notice-ok' : 'notice-err'}`} style={{ marginTop: 8 }}>
                        {m.text}
                      </p>
                    )}
                  </div>
                  <button className="btn btn-primary" onClick={() => void guardar(p.plan)} disabled={guardando === p.plan}>
                    {guardando === p.plan ? 'Guardando...' : 'Guardar'}
                  </button>
                </section>
              );
            })}
          </div>

          <div className="stack-gap">
            <section className="glass panel">
              <SectionHeader title="Membresías por plan" />
              {!popularidad ? (
                <p style={{ fontSize: 12 }}>Datos de popularidad no disponibles.</p>
              ) : totalSocios === 0 ? (
                <p style={{ fontSize: 12 }}>Sin socios activos.</p>
              ) : (
                <div className="stack-gap" style={{ gap: 12 }}>
                  {popularidad.map((pl) => {
                    const pct = (pl.socios / totalSocios) * 100;
                    return (
                      <div key={pl.plan}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                          <strong style={{ color: 'var(--text)' }}>{nombrePlan(pl.plan)}</strong>
                          <span>
                            {pl.socios} · {Math.round(pct)}%
                          </span>
                        </div>
                        <ProgressBar value={pct} color="#caff3d" />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="glass panel">
              <SectionHeader title="Ingresos por método" description="Del mes en curso." />
              {!financiero ? (
                <p style={{ fontSize: 12 }}>Datos de ingresos no disponibles.</p>
              ) : metodos.length === 0 || totalMetodos === 0 ? (
                <p style={{ fontSize: 12 }}>Sin movimientos este mes.</p>
              ) : (
                <div className="stack-gap" style={{ gap: 12 }}>
                  {metodos.map((mt) => (
                    <div key={mt.metodo}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                        <strong style={{ color: 'var(--text)' }}>{mt.metodo}</strong>
                        <span>{formatMoney(Number(mt.total))}</span>
                      </div>
                      <ProgressBar value={maxMetodo ? (Number(mt.total) / maxMetodo) * 100 : 0} color="#54e6d8" />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
