import { useEffect, useState } from 'react';
import { preciosApi } from '../precios.api';
import type { PrecioPlan } from '../precios.types';
import { Button, Card } from '../../../shared/components/ui';

export function EditarPrecios() {
  const [precios, setPrecios] = useState<PrecioPlan[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    preciosApi.getMembresiasPublico().then((data) => {
      setPrecios(data);
      const init: Record<string, string> = {};
      data.forEach((p) => init[p.plan] = p.precio);
      setValores(init);
    }).catch(() => setError('No se pudieron cargar los precios.')).finally(() => setLoading(false));
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
              <input
                type="number"
                min={1}
                value={valores[p.plan] ?? ''}
                onChange={(e) => setValores((v) => ({ ...v, [p.plan]: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
                style={{minHeight:44}}
              />
              {mensajes[p.plan] && <p className={`mt-1 text-xs ${mensajes[p.plan].includes('correctamente') ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{mensajes[p.plan]}</p>}
            </div>
            <Button onClick={() => guardar(p.plan)} disabled={guardando===p.plan} className="md:w-28">
              {guardando===p.plan ? 'Guardando...' : 'Guardar'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
