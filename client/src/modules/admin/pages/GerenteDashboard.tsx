import { Link } from 'react-router-dom';
import { Users, Building2, ScanLine, BookOpen, CreditCard, TrendingUp } from 'lucide-react';

const CARDS = [
  { to: '/admin/personal', icon: Users, title: 'Personal', description: 'Dar de alta recepcionistas y gerentes' },
  { to: '/admin/sedes', icon: Building2, title: 'Sedes', description: 'Crear y administrar sucursales' },
  { to: '/admin/canchas', icon: ScanLine, title: 'Canchas', description: 'Alta, precios y mantenimiento (todas las sedes)' },
  { to: '/admin/clases', icon: BookOpen, title: 'Clases', description: 'Crear clases y asignar instructores (todas las sedes)' },
  { to: '/admin/membresias', icon: CreditCard, title: 'Membresías', description: 'Ver y gestionar membresías de socios' },
  { to: '/admin/reportes', icon: TrendingUp, title: 'Reportes', description: 'Vista consolidada de pagos y ocupación' },
];

export function GerenteDashboard() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111111] tracking-tight">Panel del Gerente</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Acceso completo a todas las sedes de la cadena</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group w-full text-left bg-white rounded-2xl p-5 border border-[#E5E7EB]
              hover:border-[#8B2EFF] hover:shadow-md hover:shadow-[#8B2EFF]/10
              transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#8B2EFF]/30"
          >
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl bg-[#F3E8FF] flex items-center justify-center shrink-0
                group-hover:bg-[#8B2EFF] transition-colors duration-200"
              >
                <card.icon size={18} className="text-[#8B2EFF] group-hover:text-white transition-colors duration-200" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111111] group-hover:text-[#8B2EFF] transition-colors duration-200">
                  {card.title}
                </p>
                <p className="mt-0.5 text-xs text-[#6B7280] leading-relaxed">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}