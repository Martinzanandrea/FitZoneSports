import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QrCode, Calendar, CalendarCheck, Banknote, CalendarDays, HelpCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { accesoApi } from '../../acceso/acceso.api';
import { canchasApi } from '../../canchas/canchas.api';
import { adminApi, type DashboardResumen } from '../admin.api';
import { Button, StatCard, Tooltip } from '../../../shared/components/ui';

function hoyYMD() {
  return new Date().toISOString().split('T')[0];
}

const CARDS = [
  { to: '/admin/acceso', icon: QrCode, title: 'Control de acceso', description: 'Validar QR y ver aforo actual de tu sede' },
  { to: '/admin/reservas-clases', icon: Calendar, title: 'Reservas de clases', description: 'Anotar o cancelar reservas de socios en tu sede' },
  { to: '/admin/reservas-canchas', icon: CalendarCheck, title: 'Reservas de canchas', description: 'Reservar o cancelar turnos en tu sede' },
  { to: '/admin/cobrar', icon: Banknote, title: 'Cobrar en efectivo', description: 'Registrar un pago manual y emitir comprobante' },
];

export function RecepcionistaDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sede, setSede] = useState<Sede | null>(null);
  const [aforo, setAforo] = useState<{ actual: number; maximo: number } | null>(null);
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [reservasCanchasHoy, setReservasCanchasHoy] = useState<number | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(true);

  useEffect(() => {
    if (!user?.sedeId) return;
    const sedeId = user.sedeId;
    sedesApi.getOne(sedeId).then(setSede).catch(() => setSede(null));
    accesoApi.getAforo(sedeId).then(setAforo).catch(() => setAforo(null));
    // Reservas de canchas de hoy en esta sede (pocas canchas por sede, una llamada por cancha).
    canchasApi.getAll(1, 100).then((res) => {
      const propias = res.data.filter((c) => c.sede.id === sedeId);
      if (propias.length === 0) {
        setReservasCanchasHoy(0);
        return;
      }
      Promise.all(
        propias.map((c) =>
          canchasApi.getReservasPorCancha(c.id, hoyYMD()).then((r) => r.data).catch(() => []),
        ),
      )
        .then((listas) =>
          setReservasCanchasHoy(
            listas.flat().filter((r) => r.estado === 'CONFIRMADA').length,
          ),
        )
        .catch(() => setReservasCanchasHoy(null));
    }).catch(() => setReservasCanchasHoy(null));
  }, [user?.sedeId]);

  useEffect(() => {
    adminApi.getDashboardResumen().then(setResumen).catch(() => setResumen(null)).finally(() => setCargandoResumen(false));
  }, []);

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111111] tracking-tight">Panel de Recepción</h1>
        <p className="mt-1 text-sm text-[#6B7280]">{sede ? `Operando en ${sede.nombre}` : 'Solo podés gestionar operaciones de tu sede'}</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Clases hoy" value={cargandoResumen ? '...' : String(resumen?.clasesHoy ?? 0)} icon={CalendarDays} />
        <StatCard label="Reservas de canchas hoy" value={reservasCanchasHoy === null ? (cargandoResumen ? '...' : '—') : String(reservasCanchasHoy)} icon={CalendarCheck} iconColor="#16A34A" />
        <div className="relative">
          <StatCard label="Aforo" value={aforo ? `${aforo.actual}/${aforo.maximo}` : '—'} icon={QrCode} iconColor="#D97706" />
          <span className="absolute right-2 top-2">
            <Tooltip text="Cantidad de personas que están actualmente adentro del gimnasio, respecto al máximo permitido">
              <HelpCircle size={14} className="text-[#9CA3AF]" />
            </Tooltip>
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
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
        <div>
          <h2 className="mb-3 text-base font-bold text-[#111111]">Acciones Rápidas</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <Button fullWidth onClick={() => navigate('/admin/acceso')}>
              <QrCode size={16} /> Control de Acceso
            </Button>
            <Button variant="outline" fullWidth onClick={() => navigate('/admin/reservas-clases')}>
              <Calendar size={16} /> Reservas de Clases
            </Button>
            <Button variant="outline" fullWidth onClick={() => navigate('/admin/reservas-canchas')}>
              <CalendarCheck size={16} /> Reservas de Canchas
            </Button>
            <Button variant="outline" fullWidth onClick={() => navigate('/admin/cobrar')}>
              <Banknote size={16} /> Cobrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}