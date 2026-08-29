import { useEffect, useState } from 'react';
import { preciosApi } from '../precios.api';
import type { PrecioPlan } from '../precios.types';
import { adminApi, type PlanPopularidad } from '../../admin/admin.api';
import { Button, Card } from '../../../shared/components/ui';

export function EditarPrecios() {
  const [precios, setPrecios] = useState<PrecioPlan[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [popularidad, setPopularidad] = useState<PlanPopularidad[] | null>(null);

  useEffect(() => {
    preciosApi.getMembresiasPublico().then((data) => {
      setPrecios(data);
      const init: Record<string, string> = {};
      data.forEach((p) => init[p.plan] = p.precio);
      setValores(init);
    }).catch(() => setError('No se pudieron cargar los precios.')).finally(() => setLoading(false));
    adminApi.getPopularidadPlanes().then(setPopularidad).catch(() => setPopularidad(null));
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

  if (loading) return <div className="max-w-2xl"><p className="text-sm text-[#6B7280]">Cargando precios...</p></div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[#111111]">Precios de membresías</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Editá los precios de los 3 planes. Se aplican a futuros pagos.</p>
      {error && <p className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}

      <div className="mt-6 space-y-3">
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

      <div className="mt-8">
        <h2 className="text-base font-bold text-[#111111] mb-3">Popularidad por plan</h2>
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
    </div>
  );
}
