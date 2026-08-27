import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, QrCode, Receipt } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Card, SectionTitle } from '../../../shared/components/ui';

const quickActions = [
  { label: 'Reservar clase', to: '/clases', icon: CalendarDays },
  { label: 'Reservar cancha', to: '/canchas', icon: MapPin },
  { label: 'Mi código QR', to: '/qr', icon: QrCode },
  { label: 'Mis pagos', to: '/pagos', icon: Receipt },
];

// Placeholder hasta que conectemos el módulo de membresías en el frontend.
const membresiaMock = { plan: 'Mensual', estado: 'ACTIVO', vence: '2026-09-15' };

export function Dashboard() {
  const { user } = useAuth();

  const statusMap: Record<string, { label: string; variant: 'green' | 'red' | 'amber' }> = {
    ACTIVO: { label: 'Activo', variant: 'green' },
    VENCIDO: { label: 'Vencido', variant: 'red' },
    SUSPENDIDO: { label: 'Suspendido', variant: 'amber' },
  };
  const status = statusMap[membresiaMock.estado];

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div>
        <p className="text-sm font-medium text-[#6B7280]">¡Buen día! 👋</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111111] mt-0.5">
          {user?.nombre} {user?.apellido}
        </h1>
      </div>

      <Link
        to="/membresia"
        className="block w-full text-left rounded-2xl p-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #5B0FBF 0%, #8B2EFF 60%, #A855F7 100%)', minHeight: 44 }}
      >
        <div className="absolute -right-8 -top-8 rounded-full opacity-10 w-32 h-32 bg-white" />
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-purple-200 mb-1">Mi Membresía</p>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl font-bold text-white">Plan {membresiaMock.plan}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-sm text-purple-200">
            Vence el{' '}
            <span className="font-semibold text-white">
              {new Date(membresiaMock.vence).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </p>
        </div>
      </Link>

      <div>
        <SectionTitle>Acceso rápido</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex flex-col items-start gap-3 rounded-xl p-4 bg-white border border-[#E5E7EB] hover:border-[#8B2EFF] transition-all"
              style={{ minHeight: 88 }}
            >
              <a.icon size={22} className="text-[#8B2EFF]" />
              <span className="text-sm font-semibold text-[#111111] leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Próximas reservas</SectionTitle>
        <Card className="text-center py-8">
          <p className="text-sm text-[#6B7280]">Todavía no tenés reservas próximas.</p>
        </Card>
      </div>
    </div>
  );
}