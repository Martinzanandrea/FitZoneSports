import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CreditCard, Dumbbell, MapPin, Sparkles } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { membresiasApi } from '../membresias.api';
import type { Membresia } from '../membresias.types';
import { Button, Card } from '../../../shared/components/ui';

const BENEFICIOS = [
  { icon: Dumbbell, titulo: 'Acceso libre todo el día', detalle: 'De 6:00 a 23:00, sin límites' },
  { icon: CalendarDays, titulo: 'Clases grupales incluidas', detalle: 'Yoga, Spinning, CrossFit y más' },
  { icon: MapPin, titulo: 'Todas las sedes', detalle: 'Entrená donde te quede cómodo' },
  { icon: Sparkles, titulo: 'Reservas sin costo', detalle: 'Clases y canchas incluidas' },
];

export function MiMembresia() {
  const { user } = useAuth();
  const [membresia, setMembresia] = useState<Membresia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    membresiasApi.getVigente(user.id).then(setMembresia).catch(() => setError('No se pudo cargar la membresía.')).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 text-sm text-[#6B7280]">Cargando membresía...</div>;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-4">
      <h2 className="text-2xl font-black tracking-tight text-gray-900">Mi Membresía</h2>
      {error && <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}
      {!membresia ? (
        <Card className="text-center py-8 space-y-3">
          <p className="text-sm text-[#6B7280]">No tenés una membresía activa.</p>
          <Link to="/completar-membresia"><Button>Contratar membresía</Button></Link>
        </Card>
      ) : (
        <MembresiaCard membresia={membresia} />
      )}
    </div>
  );
}

function MembresiaCard({ membresia }: { membresia: Membresia }) {
  const inicio = new Date(`${membresia.fechaInicio}T00:00:00`).getTime();
  const fin = new Date(`${membresia.fechaFin}T00:00:00`).getTime();
  const totalDias = Math.max(1, Math.round((fin - inicio) / (24 * 60 * 60 * 1000)));
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const restantes = Math.ceil((fin - hoy.getTime()) / (24 * 60 * 60 * 1000));
  const usados = Math.min(totalDias, Math.max(0, totalDias - restantes));
  const progreso = (usados / totalDias) * 100;
  const vencida = membresia.estado === 'VENCIDO' || restantes < 0;
  const porVencer = !vencida && restantes <= 15;

  return (
    <div>
      <div className="bg-white rounded-[1.75rem] border border-gray-100 shadow-sm mb-4 overflow-hidden">
        <div className="flex flex-col items-center py-8 px-6" style={{ background: 'linear-gradient(160deg, #8B2EFF 0%, #A855F7 100%)' }}>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3">
            <Sparkles size={30} className="text-white" />
          </div>
          <h3 className="text-2xl font-black tracking-tight text-white text-center mb-2">Plan {membresia.plan}</h3>
          <div className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full">
            <span className={`w-2 h-2 rounded-full ${vencida ? 'bg-red-300' : 'bg-emerald-300'}`} />
            <span className="text-xs font-bold text-white">{vencida ? 'Vencida' : membresia.estado === 'ACTIVO' ? 'Activa' : membresia.estado}</span>
          </div>
        </div>
        <div className="p-5">
          <div className="mb-1">
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>{usados} de {totalDias} días</span>
              <span className="font-bold text-[#8B2EFF]">{Math.max(0, restantes)} restantes</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${progreso}%`, background: 'linear-gradient(90deg, #8B2EFF, #A855F7)' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          ['Fecha de inicio', new Date(`${membresia.fechaInicio}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })],
          ['Vencimiento', new Date(`${membresia.fechaFin}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })],
        ].map(([lbl, val]) => (
          <div key={lbl} className="bg-white rounded-[1.75rem] border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">{lbl}</p>
            <p className="text-sm font-black text-gray-900">{val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[1.75rem] border border-gray-100 shadow-sm p-5 mb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Lo que incluye tu plan</p>
        <div className="space-y-3">
          {BENEFICIOS.map((b) => (
            <div key={b.titulo} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#F3EAFF] flex items-center justify-center flex-shrink-0 mt-0.5">
                <b.icon size={15} className="text-[#8B2EFF]" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{b.titulo}</p>
                <p className="text-xs text-gray-400">{b.detalle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(vencida || porVencer) ? (
        <Link to="/completar-membresia?renovar=true" className="flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-black text-base text-white transition-all active:scale-[0.98] w-full" style={{ background: 'linear-gradient(135deg, #8B2EFF, #A855F7)' }}>
          Renovar membresía →
        </Link>
      ) : (
        <Link to="/completar-membresia?renovar=true" className="block w-full py-4 rounded-2xl font-bold text-sm text-gray-400 bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors text-center">
          Renovar anticipadamente
        </Link>
      )}
      <div className="flex items-center gap-2 mt-3 text-xs text-[#6B7280]">
        <CreditCard size={14} />
        <span>Sede alta: {membresia.sedeAlta.nombre}</span>
      </div>
    </div>
  );
}
