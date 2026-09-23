import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, QrCode, Receipt } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { membresiasApi } from '../../membresias/membresias.api';
import type { Membresia } from '../../membresias/membresias.types';
import { fetchMapaReservasClase } from '../../clases/clases.api';
import { fetchMisReservasCancha } from '../../canchas/canchas.api';
import { Badge, Card } from '../../../shared/components/ui';
import { colorPorTipo } from '../../../shared/utils/colorClase';

const quickActions = [
  { label: 'Mi QR', desc: 'Entrá al gym', to: '/qr', icon: QrCode, color: '#8B2EFF', bg: '#F3EAFF' },
  { label: 'Clases', desc: 'Reservar', to: '/reservar-clases', icon: CalendarDays, color: '#0284C7', bg: '#EFF6FF' },
  { label: 'Canchas', desc: 'Reservar', to: '/reservar-canchas', icon: MapPin, color: '#D97706', bg: '#FFFBEB' },
  { label: 'Pagos', desc: 'Ver historial', to: '/pagos', icon: Receipt, color: '#16A34A', bg: '#F0FDF4' },
];

const statusMap: Record<string, { label: string; variant: 'green' | 'red' | 'amber' }> = {
  ACTIVO: { label: 'Activo', variant: 'green' },
  VENCIDO: { label: 'Vencido', variant: 'red' },
  SUSPENDIDO: { label: 'Suspendido', variant: 'amber' },
};

function formatearFechaCorta(fechaYMD: string): string {
  const [y, m, d] = fechaYMD.split('-');
  return `${d}/${m}/${y}`;
}

interface ProximaReserva {
  id: string;
  kind: 'clase' | 'cancha';
  titulo: string;
  fecha: string;
  hora: string;
  to: '/reservar-clases' | '/reservar-canchas';
}

function diasParaVencer(fechaFin: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(`${fechaFin}T00:00:00`);
  return Math.ceil((fin.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

function MembresiaDestacada({ membresia }: { membresia: Membresia }) {
  const dias = diasParaVencer(membresia.fechaFin);
  const vencida = membresia.estado === 'VENCIDO' || dias < 0;
  const porVencer = !vencida && dias <= 7;
  const nombrePlan = `Plan ${membresia.plan.charAt(0) + membresia.plan.slice(1).toLowerCase()}`;
  const fechaLarga = new Date(`${membresia.fechaFin}T00:00:00`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const inicio = new Date(`${membresia.fechaInicio}T00:00:00`).getTime();
  const fin = new Date(`${membresia.fechaFin}T00:00:00`).getTime();
  const totalDias = Math.max(1, Math.round((fin - inicio) / (24 * 60 * 60 * 1000)));
  const usados = Math.min(totalDias, Math.max(0, totalDias - dias));
  const pctVigencia = (usados / totalDias) * 100;

  if (vencida || porVencer) {
    const alerta = vencida
      ? 'bg-[#FEF2F2] border-[#FECACA]'
      : 'bg-[#FFFBEB] border-[#FDE68A]';
    const texto = vencida ? 'text-[#B91C1C]' : 'text-[#92400E]';
    const detalle = vencida
      ? `Venció el ${fechaLarga}`
      : dias === 0
        ? 'Vence hoy'
        : `Vence en ${dias} día(s) · ${fechaLarga}`;
    return (
      <Link
        to="/membresia"
        className={`block w-full text-left rounded-[1.75rem] p-5 border ${alerta}`}
        style={{ minHeight: 44 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xl font-bold text-[#111111]">{nombrePlan}</span>
          <Badge variant={statusMap[membresia.estado]?.variant ?? 'gray'}>
            {statusMap[membresia.estado]?.label ?? membresia.estado}
          </Badge>
        </div>
        <p className={`text-sm font-semibold ${texto}`}>{detalle}</p>
      </Link>
    );
  }

  return (
    <Link
      to="/membresia"
      className="block w-full text-left rounded-[1.75rem] overflow-hidden border border-gray-100 shadow-sm"
      style={{ minHeight: 44 }}
    >
      <div className="p-5" style={{ background: 'linear-gradient(135deg, #8B2EFF 0%, #A855F7 100%)' }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-0.5">Plan activo</p>
            <h2 className="text-lg font-black tracking-tight text-white">{nombrePlan}</h2>
          </div>
          <div className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
            <span className="text-xs font-bold text-white">Activo</span>
          </div>
        </div>
        <div className="mb-1">
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pctVigencia}%` }} />
          </div>
        </div>
        <div className="flex justify-between text-xs text-white/70 mt-1">
          <span>{usados} días cursados</span>
          <span>{dias} días restantes</span>
        </div>
      </div>
      <div className="px-5 py-3 flex items-center justify-between bg-white">
        <p className="text-xs text-gray-400">Vence el <span className="font-bold text-gray-700">{fechaLarga}</span></p>
        <span className="text-xs font-bold text-[#8B2EFF]">Ver detalle ›</span>
      </div>
    </Link>
  );
}
export function Dashboard() {
  const { user } = useAuth();
  const [membresia, setMembresia] = useState<Membresia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorMembresia, setErrorMembresia] = useState(false);
  const [proximas, setProximas] = useState<ProximaReserva[]>([]);
  const [cargandoReservas, setCargandoReservas] = useState(true);

  const hoyTexto = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  useEffect(() => {
    if (!user) return;
    membresiasApi
      .getVigente(user.id)
      .then(setMembresia)
      .catch(() => setErrorMembresia(true))
      .finally(() => setCargando(false));
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCargandoReservas(false);
      return;
    }
    let viva = true;
    (async () => {
      try {
        // Reusa la misma agregación que las pantallas de reserva (sin endpoints nuevos).
        const [mapa, misCanchas] = await Promise.all([
          fetchMapaReservasClase(14),
          fetchMisReservasCancha(user.id),
        ]);
        const hoy = new Date().toISOString().split('T')[0];
        const items: ProximaReserva[] = [];
        for (const reservas of Object.values(mapa.resMap)) {
          for (const r of reservas) {
            if (r.usuario.id !== user.id || r.estado !== 'RESERVADA' || r.ocurrencia.fecha < hoy) continue;
            items.push({
              id: r.id,
              kind: 'clase',
              titulo: r.ocurrencia.clase.tipoClase,
              fecha: r.ocurrencia.fecha,
              hora: r.ocurrencia.horaInicio.slice(0, 5),
              to: '/reservar-clases',
            });
          }
        }
        for (const { reserva, cancha } of misCanchas) {
          if (reserva.fecha < hoy) continue;
          items.push({
            id: reserva.id,
            kind: 'cancha',
            titulo: cancha.nombre,
            fecha: reserva.fecha,
            hora: reserva.horaInicio.slice(0, 5),
            to: '/reservar-canchas',
          });
        }
        items.sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
        if (viva) setProximas(items.slice(0, 3));
      } catch {
        // Si falla, se mantiene el mensaje vacío original.
      } finally {
        if (viva) setCargandoReservas(false);
      }
    })();
    return () => {
      viva = false;
    };
  }, [user]);

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="mb-6">
        <p className="text-sm text-gray-400 capitalize mb-0.5">{hoyTexto}</p>
        <h1 className="text-3xl font-black tracking-tight text-gray-900">
          Hola, {user?.nombre} 👋
        </h1>
      </div>

      <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-6 lg:items-start">
        <div className="space-y-6 min-w-0">
          {cargando ? (
            <div className="rounded-[1.75rem] p-5 bg-[#F3F4F6] animate-pulse h-28" />
          ) : errorMembresia ? (
            <Card className="text-center py-6">
              <p className="text-sm text-[#DC2626]">No pudimos cargar tu membresía. Recargá la página.</p>
            </Card>
          ) : membresia ? (
            <MembresiaDestacada membresia={membresia} />
          ) : (
            <Card className="text-center py-6">
              <p className="text-sm text-[#6B7280]">Todavía no tenés una membresía activa.</p>
              <Link to="/completar-membresia" className="text-sm font-semibold text-[#8B2EFF] hover:underline mt-2 inline-block">
                Elegir un plan →
              </Link>
            </Card>
          )}

          <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Accesos rápidos</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {quickActions.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="text-left p-4 rounded-[1.75rem] border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] duration-200"
                >
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: a.bg }}>
                    <a.icon size={20} style={{ color: a.color }} />
                  </div>
                  <p className="text-sm font-black tracking-tight text-gray-900">{a.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Próximas reservas</h2>
            <Link to="/reservar-clases" className="text-xs font-bold text-[#8B2EFF]">Ver todas →</Link>
          </div>
        {cargandoReservas ? (
          <div className="rounded-[1.75rem] p-5 bg-[#F3F4F6] animate-pulse h-20" />
        ) : proximas.length === 0 ? (
          <div className="bg-white rounded-[1.75rem] border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <CalendarDays size={24} className="text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-400 mb-1">Sin reservas próximas</p>
            <p className="text-xs text-gray-300 mb-3">Reservá una clase o cancha para verlas acá</p>
            <Link to="/reservar-clases" className="text-xs font-bold text-[#8B2EFF]">Reservar clase →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {proximas.map((p) => {
              const color = p.kind === 'clase' ? colorPorTipo(p.titulo) : null;
              const iconColor = p.kind === 'clase' ? (color?.borde ?? '#8B2EFF') : '#D97706';
              const iconBg = p.kind === 'clase' ? ((color?.borde ?? '#8B2EFF') + '15') : '#FFFBEB';
              return (
                <Link
                  key={`${p.kind}-${p.id}`}
                  to={p.to}
                  className="bg-white rounded-[1.75rem] border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: iconBg }}>
                    <CalendarDays size={18} style={{ color: iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{p.titulo}</p>
                    <p className="text-xs text-gray-400">{formatearFechaCorta(p.fecha)} · {p.hora}</p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ backgroundColor: iconBg, color: iconColor }}
                  >
                    {p.kind === 'clase' ? 'Clase' : 'Cancha'}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
