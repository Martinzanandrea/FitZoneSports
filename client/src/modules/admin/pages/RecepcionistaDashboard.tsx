import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, QrCode, Calendar, CalendarCheck, Banknote } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { accesoApi } from '../../acceso/acceso.api';

const CARDS = [
  { to: '/admin/acceso', icon: QrCode, title: 'Control de acceso', description: 'Validar QR y ver aforo actual de tu sede' },
  { to: '/admin/reservas-clases', icon: Calendar, title: 'Reservas de clases', description: 'Anotar o cancelar reservas de socios en tu sede' },
  { to: '/admin/reservas-canchas', icon: CalendarCheck, title: 'Reservas de canchas', description: 'Reservar o cancelar turnos en tu sede' },
  { to: '/admin/cobrar', icon: Banknote, title: 'Cobrar en efectivo', description: 'Registrar un pago manual y emitir comprobante' },
];

export function RecepcionistaDashboard() {
  const { user } = useAuth();
  const [sede, setSede] = useState<Sede | null>(null);
  const [aforo, setAforo] = useState<{ actual: number; maximo: number } | null>(null);

  useEffect(() => {
    if (!user?.sedeId) return;
    sedesApi.getOne(user.sedeId).then(setSede).catch(() => setSede(null));
    accesoApi.getAforo(user.sedeId).then(setAforo).catch(() => setAforo(null));
  }, [user?.sedeId]);

  if (!user?.sedeId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Panel de Recepción</h1>
        <div className="mt-4 p-4 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-sm text-[#92400E]">
          Tu usuario no tiene una sede asignada. Contactá a un gerente.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#F3E8FF] border border-[#DDD6FE]">
          <MapPin size={14} className="text-[#8B2EFF]" />
          <span className="text-xs font-semibold text-[#8B2EFF]">
            Operando en: {sede?.nombre ?? 'Cargando…'}
          </span>
        </div>

        {aforo && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#F0FDF4] border border-[#BBF7D0]">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            <span className="text-xs font-semibold text-[#16A34A]">
              Aforo: {aforo.actual} / {aforo.maximo}
            </span>
          </div>
        )}
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111111] tracking-tight">Panel de Recepción</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Solo podés gestionar operaciones de esta sede</p>
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