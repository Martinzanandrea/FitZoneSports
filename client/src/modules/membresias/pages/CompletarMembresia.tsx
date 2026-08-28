import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CreditCard } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { sedesApi } from '../../sedes/sedes.api';
import { membresiasApi } from '../membresias.api';
import { pagosApi } from '../../pagos/pagos.api';
import { preciosApi } from '../../precios/precios.api';
import type { Sede } from '../../sedes/sedes.types';
import type { TipoPlan } from '../membresias.types';
import type { PrecioPlan } from '../../precios/precios.types';
import { Button } from '../../../shared/components/ui';

const DESCRIPCIONES: Record<string, string> = {
  MENSUAL: 'Ideal para empezar',
  TRIMESTRAL: 'Ahorrás un 8%',
  ANUAL: 'Ahorrás un 20%',
};

export function CompletarMembresia() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const esRenovacion = searchParams.get('renovar') === 'true';
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [precios, setPrecios] = useState<PrecioPlan[]>([]);
  const [sedeId, setSedeId] = useState('');
  const [plan, setPlan] = useState<TipoPlan>('MENSUAL');
  const [metodo, setMetodo] = useState<'MERCADOPAGO' | 'MODO'>('MERCADOPAGO');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [simularRechazo, setSimularRechazo] = useState(false);

  useEffect(() => {
    sedesApi.getAllPublico().then(setSedes).catch(() => setSedes([]));
    preciosApi.getMembresiasPublico().then(setPrecios).catch(() => setPrecios([]));
  }, []);

  // Reemplaza al array PLANES hardcodeado: ahora sale de precios_plan
  // (backend), editable por el Gerente sin tocar código.
  const planes = precios.map((p) => ({
    value: p.plan,
    label: p.plan.charAt(0) + p.plan.slice(1).toLowerCase(),
    precio: Number(p.precio),
    descripcion: DESCRIPCIONES[p.plan] ?? '',
  }));

  const planSeleccionado = planes.find((p) => p.value === plan);

  async function handleConfirmar() {
    if (!user || !sedeId) {
      setError('Elegí una sede para continuar.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const membresia = esRenovacion
        ? await membresiasApi.renovar({ usuarioId: user.id, sedeAltaId: sedeId, plan })
        : await membresiasApi.create({ usuarioId: user.id, sedeAltaId: sedeId, plan });
      const pago = await pagosApi.pagarConPasarela({
        usuarioId: user.id,
        membresiaId: membresia.id,
        metodo,
        simularRechazo,
        // Sin "monto": el backend recalcula el precio real desde
        // precios_plan, ignorando cualquier valor que mandemos acá.
      });
      if (pago.estado !== 'APROBADO') {
        await membresiasApi.cancelar(membresia.id);
        setError('El pago fue rechazado. Podés reintentar con otro método.');
        return;
      }
      navigate('/dashboard');
    } catch {
      setError('No se pudo completar el pago. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E5E7EB] p-6 md:p-8">
        <h1 className="text-xl font-bold text-[#111111]">{esRenovacion ? 'Renovar tu membresía' : '¡Ya casi! Elegí tu plan'}</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Para activar tu membresía necesitamos que elijas un plan y una sede.</p>

        <div className="mt-6 space-y-2.5">
          {planes.length === 0 ? (
            <p className="text-sm text-[#6B7280] py-4 text-center">Cargando planes…</p>
          ) : (
            planes.map((p) => (
              <button
                key={p.value}
                onClick={() => setPlan(p.value as TipoPlan)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 text-left transition-colors ${
                  plan === p.value ? 'border-[#8B2EFF] bg-[#F3E8FF]/40' : 'border-[#E5E7EB] hover:border-[#8B2EFF]/40'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{p.label}</p>
                  <p className="text-xs text-[#6B7280]">{p.descripcion}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#111111]">${p.precio.toLocaleString('es-AR')}</span>
                  {plan === p.value && <Check size={16} className="text-[#8B2EFF]" />}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="mt-5 space-y-1.5">
          <label className="text-sm font-medium text-[#374151]">Sede donde te vas a registrar</label>
          <select
            value={sedeId}
            onChange={(e) => setSedeId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20"
          >
            <option value="">Seleccionar sede…</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
          <p className="text-xs text-[#6B7280]">Recordá que tu abono te da acceso a todas las sedes por igual.</p>
        </div>

        <div className="mt-5 space-y-1.5">
          <label className="text-sm font-medium text-[#374151]">Método de pago</label>
          <div className="grid grid-cols-2 gap-2">
            {(['MERCADOPAGO', 'MODO'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetodo(m)}
                className={`py-2.5 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 transition-colors ${
                  metodo === m ? 'bg-[#8B2EFF] text-white border-[#8B2EFF]' : 'bg-white text-[#374151] border-[#E5E7EB]'
                }`}
              >
                <CreditCard size={14} /> {m === 'MERCADOPAGO' ? 'Mercado Pago' : 'Modo'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-[#6B7280] mt-2">
            <input
              type="checkbox"
              checked={simularRechazo}
              onChange={(e) => setSimularRechazo(e.target.checked)}
              className="rounded"
            />
            🧪 Simular pago rechazado (solo testing)
          </label>
        </div>

        {error && <p className="mt-4 text-sm text-[#DC2626]">{error}</p>}

        <Button
          fullWidth
          size="lg"
          className="mt-6"
          onClick={handleConfirmar}
          disabled={loading || !planSeleccionado}
        >
          {loading ? 'Procesando pago…' : `Pagar $${(planSeleccionado?.precio ?? 0).toLocaleString('es-AR')}`}
        </Button>
      </div>
    </div>
  );
}