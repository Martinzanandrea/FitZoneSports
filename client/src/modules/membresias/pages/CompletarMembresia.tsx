import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CreditCard } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { sedesApi } from '../../sedes/sedes.api';
import { membresiasApi } from '../membresias.api';
import { pagosApi } from '../../pagos/pagos.api';
import type { Sede } from '../../sedes/sedes.types';
import type { TipoPlan } from '../membresias.types';
import { Button } from '../../../shared/components/ui';

const PLANES: { value: TipoPlan; label: string; precio: number; descripcion: string }[] = [
  { value: 'MENSUAL', label: 'Mensual', precio: 12500, descripcion: 'Ideal para empezar' },
  { value: 'TRIMESTRAL', label: 'Trimestral', precio: 34500, descripcion: 'Ahorrás un 8%' },
  { value: 'ANUAL', label: 'Anual', precio: 120000, descripcion: 'Ahorrás un 20%' },
];

export function CompletarMembresia() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedeId, setSedeId] = useState('');
  const [plan, setPlan] = useState<TipoPlan>('MENSUAL');
  const [metodo, setMetodo] = useState<'MERCADOPAGO' | 'MODO'>('MERCADOPAGO');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    sedesApi.getAllPublico().then(setSedes).catch(() => setSedes([]));
  }, []);

  const planSeleccionado = PLANES.find((p) => p.value === plan)!;

  async function handleConfirmar() {
    if (!user || !sedeId) {
      setError('Elegí una sede para continuar.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const membresia = await membresiasApi.create({ usuarioId: user.id, sedeAltaId: sedeId, plan });
      await pagosApi.pagarConPasarela({
        usuarioId: user.id,
        membresiaId: membresia.id,
        metodo,
        monto: planSeleccionado.precio,
      });
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
        <h1 className="text-xl font-bold text-[#111111]">¡Ya casi! Elegí tu plan</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Para activar tu membresía necesitamos que elijas un plan y una sede.</p>

        <div className="mt-6 space-y-2.5">
          {PLANES.map((p) => (
            <button
              key={p.value}
              onClick={() => setPlan(p.value)}
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
          ))}
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
        </div>

        {error && <p className="mt-4 text-sm text-[#DC2626]">{error}</p>}

        <Button fullWidth size="lg" className="mt-6" onClick={handleConfirmar} disabled={loading}>
          {loading ? 'Procesando pago…' : `Pagar $${planSeleccionado.precio.toLocaleString('es-AR')}`}
        </Button>
      </div>
    </div>
  );
}