import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, ScanLine, BookOpen, CreditCard, TrendingUp, CalendarDays, Clock3, RefreshCw, GraduationCap, Tag } from 'lucide-react';
import { adminApi, type DashboardResumen } from '../admin.api';

const CARDS = [
  { to: '/admin/personal', icon: Users, title: 'Personal', description: 'Dar de alta recepcionistas y gerentes' },
  { to: '/admin/sedes', icon: Building2, title: 'Sedes', description: 'Crear y administrar sucursales' },
  { to: '/admin/canchas', icon: ScanLine, title: 'Canchas', description: 'Alta, precios y mantenimiento (todas las sedes)' },
  { to: '/admin/clases', icon: BookOpen, title: 'Clases', description: 'Crear clases y asignar instructores (todas las sedes)' },
  { to: '/admin/instructores', icon: GraduationCap, title: 'Instructores', description: 'Dar de alta instructores para clases' },
  { to: '/admin/membresias', icon: CreditCard, title: 'Membresías', description: 'Ver y gestionar membresías de socios' },
  { to: '/admin/reportes', icon: TrendingUp, title: 'Reportes', description: 'Vista consolidada de pagos y ocupación' },
  { to: '/admin/reservas', icon: CalendarDays, title: 'Reservas', description: 'Consultar reservas de clases y canchas' },
  { to: '/admin/precios', icon: Tag, title: 'Precios', description: 'Editar precios de planes de membresía' },
];

export function GerenteDashboard() {
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [horaActual, setHoraActual] = useState(() => new Date());

  function cargarResumen() {
    setCargando(true);
    setError(false);
    adminApi.getDashboardResumen()
      .then(setResumen)
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargarResumen();
  }, []);

  useEffect(() => {
    const intervalo = window.setInterval(() => setHoraActual(new Date()), 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] tracking-tight">Panel del Gerente</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Acceso completo a todas las sedes de la cadena</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#374151]">
          <Clock3 size={16} className="text-[#8B2EFF]" />
          <time dateTime={horaActual.toISOString()}>
            {horaActual.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </time>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]">
          <span>No se pudo cargar el resumen del día.</span>
          <button
            type="button"
            onClick={cargarResumen}
            className="inline-flex items-center gap-2 rounded-lg border border-[#FECACA] px-3 py-2 font-semibold hover:bg-[#FEE2E2]"
          >
            <RefreshCw size={15} /> Reintentar
          </button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard
          icon={CalendarDays}
          label="Clases de hoy"
          value={resumen?.clasesHoy}
          loading={cargando}
        />
        <MetricCard
          icon={Clock3}
          label="Horas de cancha reservadas hoy"
          value={resumen?.horasCanchasAgendadasHoy}
          loading={cargando}
          suffix=" h"
        />
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

function MetricCard({
  icon: Icon,
  label,
  value,
  loading,
  suffix = '',
}: {
  icon: typeof Users;
  label: string;
  value?: number;
  loading: boolean;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3E8FF]">
          <Icon size={17} className="text-[#8B2EFF]" />
        </span>
        <span className="text-2xl font-extrabold text-[#111111]">
          {loading ? '...' : `${value ?? 0}${suffix}`}
        </span>
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
    </div>
  );
}