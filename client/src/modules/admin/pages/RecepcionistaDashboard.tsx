import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, CalendarCheck, CalendarDays, KeyRound, LogOut, QrCode, UserCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { accesoApi } from '../../acceso/acceso.api';
import type { SesionAbierta } from '../../acceso/acceso.types';
import { canchasApi } from '../../canchas/canchas.api';
import { adminApi, type DashboardResumen } from '../admin.api';
import { Donut } from '../../../shared/components/Donut';
import { MetricCard } from '../../../shared/components/MetricCard';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { useTitulo } from '../../../shared/hooks/useTitulo';

function hoyYMD() {
  return new Date().toISOString().split('T')[0];
}

function haceCuanto(horaIngreso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(horaIngreso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `hace ${h} h` : `hace ${h} h ${m} min`;
}

export function RecepcionistaDashboard() {
  useTitulo('Panel de recepción');
  const { user } = useAuth();
  const navigate = useNavigate();
  const sedeId = user?.sedeId ?? null;

  const [sede, setSede] = useState<Sede | null>(null);
  const [aforo, setAforo] = useState<{ actual: number; maximo: number } | null>(null);
  const [errorAforo, setErrorAforo] = useState(false);
  const [cargandoAforo, setCargandoAforo] = useState(true);
  const [dentro, setDentro] = useState<SesionAbierta[]>([]);
  const [totalDentro, setTotalDentro] = useState(0);
  const [cargandoDentro, setCargandoDentro] = useState(true);
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [reservasCanchasHoy, setReservasCanchasHoy] = useState<number | null>(null);

  useEffect(() => {
    if (!sedeId) return;
    let viva = true;
    sedesApi.getOne(sedeId).then((s) => viva && setSede(s)).catch(() => undefined);
    accesoApi
      .getAforo(sedeId)
      .then((a) => viva && setAforo(a))
      .catch(() => viva && setErrorAforo(true))
      .finally(() => viva && setCargandoAforo(false));
    accesoApi
      .listarDentro(sedeId, 1, 5)
      .then((r) => {
        if (!viva) return;
        setDentro(r.data);
        setTotalDentro(r.total);
      })
      .catch(() => undefined)
      .finally(() => viva && setCargandoDentro(false));
    adminApi.getDashboardResumen().then((r) => viva && setResumen(r)).catch(() => undefined);
    // Reservas de canchas de hoy en esta sede (una llamada por cancha de la sede).
    canchasApi
      .getAll(1, 100)
      .then(async (res) => {
        const propias = res.data.filter((c) => c.sede.id === sedeId);
        const listas = await Promise.all(
          propias.map((c) => canchasApi.getReservasPorCancha(c.id, hoyYMD()).then((r) => r.data).catch(() => [])),
        );
        if (viva) setReservasCanchasHoy(listas.flat().filter((r) => r.estado === 'CONFIRMADA').length);
      })
      .catch(() => undefined);
    return () => {
      viva = false;
    };
  }, [sedeId]);

  const pct = aforo && aforo.maximo > 0 ? Math.min(100, Math.round((aforo.actual / aforo.maximo) * 100)) : 0;

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Hola, {user?.nombre}</h2>
          <p>{sede ? `Operando en ${sede.nombre}.` : 'Operación de tu sede.'}</p>
        </div>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <MetricCard label="Clases hoy" value={resumen ? String(resumen.clasesHoy) : '—'} change="en tu sede" icon={CalendarDays} />
        <MetricCard
          label="Reservas de canchas hoy"
          value={reservasCanchasHoy === null ? '—' : String(reservasCanchasHoy)}
          change="confirmadas"
          icon={CalendarCheck}
        />
        <MetricCard label="Personas adentro" value={aforo ? String(aforo.actual) : '—'} change="ahora mismo" icon={UserCheck} />
      </div>

      <div className="content-grid">
        <section className="glass panel" aria-label="Aforo de la sede">
          <SectionHeader title="Aforo actual" description={sede ? sede.nombre : undefined} />
          {cargandoAforo ? (
            <LoadingState rows={1} label="Cargando aforo" />
          ) : errorAforo || !aforo ? (
            <ErrorState
              title="No pudimos cargar el aforo"
              description="Revisá tu conexión e intentá de nuevo."
              onRetry={() => window.location.reload()}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <Donut value={pct} label="ocupado" />
              <div>
                <div className="metric-value">
                  {aforo.actual} / {aforo.maximo}
                </div>
                <p style={{ fontSize: 12 }}>personas adentro sobre la capacidad de la sede</p>
              </div>
            </div>
          )}
        </section>

        <section className="glass panel quick-panel" aria-label="Accesos rápidos">
          <SectionHeader title="Accesos rápidos" />
          <button className="btn btn-primary" onClick={() => navigate('/admin/acceso?modo=camara')}>
            <QrCode size={16} aria-hidden /> Escanear QR
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/acceso?modo=codigo')}>
            <KeyRound size={16} aria-hidden /> Ingresar código
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/acceso/dentro')}>
            <LogOut size={16} aria-hidden /> Registrar egreso
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/cobrar')}>
            <Banknote size={16} aria-hidden /> Cobrar
          </button>
        </section>
      </div>

      <section className="glass panel" style={{ marginTop: 14 }} aria-label="Personas adentro">
        <SectionHeader
          title="Adentro ahora"
          description={totalDentro > 5 ? `Las 5 personas que más tiempo llevan, de ${totalDentro}.` : 'Ingresos sin egreso registrado.'}
          action={
            <button className="btn btn-ghost" onClick={() => navigate('/admin/acceso/dentro')}>
              Ver lista completa
            </button>
          }
        />
        {cargandoDentro ? (
          <LoadingState rows={3} label="Cargando accesos" />
        ) : dentro.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="No hay nadie adentro"
            description="Cuando valides un ingreso, la persona aparece acá hasta que registres su egreso."
          />
        ) : (
          <div className="stack-list">
            {dentro.map((s) => (
              <div className="list-row" key={s.id}>
                <span className="avatar" aria-hidden>
                  {`${s.usuario.nombre[0] ?? ''}${s.usuario.apellido[0] ?? ''}`.toUpperCase()}
                </span>
                <div className="row-main">
                  <strong>
                    {s.usuario.nombre} {s.usuario.apellido}
                  </strong>
                  <span>
                    Ingresó {s.horaIngreso.slice(0, 5)} · {haceCuanto(s.horaIngreso)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
