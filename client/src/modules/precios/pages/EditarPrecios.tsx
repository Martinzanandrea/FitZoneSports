import { useEffect, useState } from 'react';
import { preciosApi } from '../precios.api';
import type { PrecioPlan } from '../precios.types';
import { adminApi, type PlanPopularidad, type ReporteFinanciero } from '../../admin/admin.api';
import { Button, Card, PageHeader } from '../../../shared/components/ui';

export function EditarPrecios() {
  const [precios, setPrecios] = useState<PrecioPlan[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [popularidad, setPopularidad] = useState<PlanPopularidad[] | null>(null);
  const [financiero, setFinanciero] = useState<ReporteFinanciero | null>(null);

  useEffect(() => {
    preciosApi.getMembresiasPublico().then((data) => {
      setPrecios(data);
      const init: Record<string, string> = {};
      data.forEach((p) => init[p.plan] = p.precio);
      setValores(init);
    }).catch(() => setError('No se pudieron cargar los precios.')).finally(() => setLoading(false));
    adminApi.getPopularidadPlanes().then(setPopularidad).catch(() => setPopularidad(null));
    adminApi.getReporteFinanciero().then(setFinanciero).catch(() => setFinanciero(null));
  }, []);

  async function guardar(plan: string) {
    const precio = Number(valores[plan]);
    if (!precio || precio <= 0) { setMensajes((m) => ({ ...m, [plan]: 'Precio inválido' })); return; }
    setGuardando(plan);
    setMensajes((m) => ({ ...m, [plan]: '' }));
    try {
      const actualizado = await preciosApi.actualizar(plan, precio);
      setPrecios((prev) => prev.map((p) => p.plan === plan ? actualizado : p));
      setMensajes((m) => ({ ...m, [plan]: 'Guardado correctamente' }));
    } catch {
      setMensajes((m) => ({ ...m, [plan]: 'No se pudo guardar' }));
    } finally {
      setGuardando(null);
    }
  }

  if (loading) return <div className="max-w-4xl"><p className="text-sm text-[#6B7280]">Cargando precios...</p></div>;

  return (
    <div className="max-w-6xl">
      <PageHeader title="Precios de membresías" />
      <p className="-mt-4 mb-4 text-sm text-[#6B7280]">Editá los precios de los 3 planes. Se aplican a futuros pagos.</p>
      {error && <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
        {precios.map((p) => (
          <Card key={p.plan} className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#111111]">{p.plan.charAt(0)+p.plan.slice(1).toLowerCase()}</p>
              <p className="text-xs text-[#6B7280]">Actual: ${Number(p.precio).toLocaleString('es-AR')}</p>
              <input type="number" min={1} value={valores[p.plan] ?? ''} onChange={(e) => setValores((v) => ({ ...v, [p.plan]: e.target.value }))} className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none" style={{ minHeight: 44 }} />
              {mensajes[p.plan] && <p className={`mt-1 text-xs ${mensajes[p.plan].includes('correctamente') ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{mensajes[p.plan]}</p>}
            </div>
            <Button onClick={() => guardar(p.plan)} disabled={guardando===p.plan} className="md:w-28">{guardando===p.plan ? 'Guardando...' : 'Guardar'}</Button>
          </Card>
        ))}
        </div>

        <div>
          <h2 className="text-base font-bold text-[#111111] mb-3">Métricas</h2>
          <div className="grid grid-cols-1 gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#111111] mb-2">Membresías por plan</h3>
            {!popularidad ? <Card className="py-6 text-center text-sm text-[#6B7280]">No hay datos de popularidad (endpoint no disponible).</Card> : (() => {
              const total = popularidad.reduce((acc, p) => acc + p.socios, 0);
              if (total === 0) return <Card className="py-6 text-center text-sm text-[#6B7280]">Sin socios activos.</Card>;
              return (
              <Card>
                <p className="text-xs text-[#6B7280] mb-3">Total socios activos: {total}</p>
                <div className="space-y-3">
                  {popularidad.map((pl) => {
                    const pct = total ? (pl.socios / total) * 100 : 0;
                    return (
                    <div key={pl.plan}>
                      <div className="flex justify-between text-xs mb-1"><span className="font-semibold text-[#111111]">{pl.plan}</span><span className="text-[#6B7280]">{pl.socios} · {Math.round(pct)}%</span></div>
                      <div className="h-2.5 rounded-full bg-[#F3F4F6] overflow-hidden"><div className="h-full bg-[#8B2EFF] rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                    </div>
                  );})}
                </div>
              </Card>
            );})()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#111111] mb-2">Ingresos del mes por método de pago</h3>
            {!financiero ? <Card className="py-6 text-center text-sm text-[#6B7280]">No hay datos de ingresos (endpoint no disponible).</Card> : (() => {
              const metodos = financiero.porMetodo ?? [];
              const total = metodos.reduce((acc, m) => acc + Number(m.total), 0);
              if (metodos.length === 0 || total === 0) return <Card className="py-6 text-center text-sm text-[#6B7280]">Sin movimientos este mes.</Card>;
              const max = Math.max(...metodos.map((m) => Number(m.total)));
              return (
              <Card>
                <p className="text-xs text-[#6B7280] mb-3">Total del mes: ${total.toLocaleString('es-AR')}</p>
                <div className="space-y-3">
                  {metodos.map((m) => {
                    const pct = max ? (Number(m.total) / max) * 100 : 0;
                    return (
                    <div key={m.metodo}>
                      <div className="flex justify-between text-xs mb-1"><span className="font-semibold text-[#111111]">{m.metodo}</span><span className="text-[#6B7280]">${Number(m.total).toLocaleString('es-AR')}</span></div>
                      <div className="h-2.5 rounded-full bg-[#F3F4F6] overflow-hidden"><div className="h-full bg-[#8B2EFF] rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                    </div>
                  );})}
                </div>
              </Card>
            );})()}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
