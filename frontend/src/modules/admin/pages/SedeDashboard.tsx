import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CalendarDays, Clock3, DoorOpen, ScanLine, UserCheck, Wallet } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import {
  adminApi,
  type AuditoriaRegistro,
  type DashboardResumen,
  type MembresiaPorSedeItem,
  type PlanPopularidad,
  type ReporteFinanciero,
} from '../admin.api';
import { accesoApi } from '../../acceso/acceso.api';
import type { Aforo, SesionAbierta } from '../../acceso/acceso.types';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { canchasApi } from '../../canchas/canchas.api';
import { formatMoney } from '../../../shared/utils/formatMoney';
import { Donut } from '../../../shared/components/atoms';;
import { MetricCard } from '../../../shared/components/molecules';;
import { MiniChart } from '../../../shared/components/molecules';;
import { Ranking } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { ActividadReciente } from '../components/ActividadReciente';
import { useTitulo } from '../../../shared/hooks/useTitulo';

interface Bloque<T> {
  data: T | null;
  cargando: boolean;
  error: boolean;
}

function inicial<T>(): Bloque<T> {
  return { data: null, cargando: true, error: false };
}

function valor<T>(b: Bloque<T>, fmt: (d: T) => string): string {
  return b.data !== null ? fmt(b.data) : '—';
}

function haceCuanto(horaIngreso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(horaIngreso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `hace ${h} h` : `hace ${h} h ${m} min`;
}

// Panel del Gerente de Sede: solo llama endpoints que el backend acota a su
// sede (reportes, accesos, canchas, auditoría); nunca los listados globales.
export function SedeDashboard() {
  useTitulo('Panel de sede');
  const { user } = useAuth();
  const sedeId = user?.sedeId ?? null;

  const [sede, setSede] = useState<Bloque<Sede>>(inicial);
  const [resumen, setResumen] = useState<Bloque<DashboardResumen>>(inicial);
  const [fin, setFin] = useState<Bloque<ReporteFinanciero>>(inicial);
  const [aforo, setAforo] = useState<Bloque<Aforo>>(inicial);
  const [ingresosHoy, setIngresosHoy] = useState<Bloque<number>>(inicial);
  const [membresias, setMembresias] = useState<Bloque<MembresiaPorSedeItem>>(inicial);
  const [planes, setPlanes] = useState<Bloque<PlanPopularidad[]>>(inicial);
  const [canchas, setCanchas] = useState<Bloque<{ total: number; mantenimiento: number }>>(inicial);
  const [dentro, setDentro] = useState<Bloque<{ lista: SesionAbierta[]; total: number }>>(inicial);
  const [actividad, setActividad] = useState<Bloque<AuditoriaRegistro[]>>(inicial);

  const cargarActividad = useCallback(() => {
    setActividad(inicial());
    adminApi
      .getAuditoria(undefined, 1, 8)
      .then((r) => setActividad({ data: r.data, cargando: false, error: false }))
      .catch(() => setActividad({ data: null, cargando: false, error: true }));
  }, []);

  const cargar = useCallback(() => {
    if (!sedeId) return;
    function bloque<T>(promesa: Promise<T>, set: (b: Bloque<T>) => void) {
      set(inicial());
      promesa
        .then((data) => set({ data, cargando: false, error: false }))
        .catch(() => set({ data: null, cargando: false, error: true }));
    }
    bloque(sedesApi.getOne(sedeId), setSede);
    bloque(adminApi.getDashboardResumen(), setResumen);
    bloque(adminApi.getReporteFinanciero(), setFin);
    bloque(accesoApi.getAforo(sedeId), setAforo);
    bloque(
      accesoApi.getResumenAccesos().then((r) => r.porSede.find((s) => s.sedeId === sedeId)?.ingresosHoy ?? 0),
      setIngresosHoy,
    );
    bloque(adminApi.getMembresiasPorSede().then((r) => r[0] ?? { sedeId, sede: '', activas: 0, vencidas: 0, suspendidas: 0, socios: [] }), setMembresias);
    bloque(adminApi.getPopularidadPlanes(), setPlanes);
    bloque(
      canchasApi.getAll(1, 100).then((r) => ({
        total: r.total,
        mantenimiento: r.data.filter((c) => c.estado === 'MANTENIMIENTO').length,
      })),
      setCanchas,
    );
    bloque(accesoApi.listarDentro(sedeId, 1, 5).then((r) => ({ lista: r.data, total: r.total })), setDentro);
    cargarActividad();
  }, [sedeId, cargarActividad]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const pct = aforo.data && aforo.data.maximo > 0 ? Math.min(100, Math.round((aforo.data.actual / aforo.data.maximo) * 100)) : 0;
  const totalPlanes = (planes.data ?? []).reduce((acc, p) => acc + p.socios, 0);
  const rankingPlanes = (planes.data ?? [])
    .filter((p) => p.socios > 0)
    .sort((a, b) => b.socios - a.socios)
    .map((p) => ({ name: p.plan, value: Math.round((p.socios / totalPlanes) * 100) }));
  const metodos = (fin.data?.porMetodo ?? []).filter((m) => m.total > 0);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Panel de sede{sede.data ? ` · ${sede.data.nombre}` : ''}</h2>
          <p>Hola, {user?.nombre}. Así está tu sede hoy.</p>
        </div>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <MetricCard label="Ingresos del mes" value={valor(fin, (f) => formatMoney(f.ingresosMes))} change="pagos aprobados en tu sede" icon={Wallet} />
        <MetricCard label="Ingresos de hoy" value={valor(fin, (f) => formatMoney(f.ingresosHoy))} change="pagos aprobados" icon={Banknote} />
        <MetricCard label="Clases hoy" value={valor(resumen, (r) => String(r.clasesHoy))} change="en tu sede" icon={CalendarDays} />
        <MetricCard label="Horas de cancha hoy" value={valor(resumen, (r) => `${r.horasCanchasAgendadasHoy} h`)} change="agendadas" icon={Clock3} />
        <MetricCard label="Membresías activas" value={valor(membresias, (m) => String(m.activas))} change={membresias.data ? `${membresias.data.vencidas} vencidas · ${membresias.data.suspendidas} suspendidas` : 'de tu sede'} icon={UserCheck} />
        <MetricCard label="Entradas hoy" value={valor(ingresosHoy, String)} change="ingresos validados" icon={DoorOpen} />
        <MetricCard
          label="Canchas"
          value={valor(canchas, (c) => String(c.total))}
          change={canchas.data ? `${canchas.data.mantenimiento} en mantenimiento` : 'de tu sede'}
          icon={ScanLine}
        />
      </div>

      <div className="content-grid">
        <section className="glass panel" aria-label="Aforo de la sede">
          <SectionHeader title="Aforo actual" description={sede.data?.nombre} />
          {aforo.cargando ? (
            <LoadingState rows={1} label="Cargando aforo" />
          ) : aforo.error || !aforo.data ? (
            <ErrorState title="No pudimos cargar el aforo" onRetry={cargar} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <Donut value={pct} label="ocupado" />
              <div>
                <div className="metric-value">
                  {aforo.data.actual} / {aforo.data.maximo}
                </div>
                <p style={{ fontSize: 12 }}>personas adentro sobre la capacidad de la sede</p>
              </div>
            </div>
          )}
        </section>

        <section className="glass panel" aria-label="Ingresos por método de pago">
          <SectionHeader title="Ingresos del mes por método" description="Pagos aprobados desde el 1° del mes." />
          {fin.cargando ? (
            <LoadingState rows={1} label="Cargando ingresos" />
          ) : fin.error ? (
            <ErrorState title="No pudimos cargar los ingresos" onRetry={cargar} />
          ) : metodos.length === 0 ? (
            <EmptyState icon={Wallet} title="Sin ingresos este mes" description="Todavía no hay pagos aprobados en tu sede." />
          ) : (
            <MiniChart values={metodos.map((m) => m.total)} labels={metodos.map((m) => m.metodo)} ariaLabel="Ingresos del mes por método de pago" />
          )}
        </section>
      </div>

      <div className="content-grid">
        <section className="glass panel" aria-label="Planes más elegidos">
          <SectionHeader title="Planes más elegidos" description="Participación entre las membresías activas de tu sede." />
          {planes.cargando ? (
            <LoadingState rows={2} label="Cargando planes" />
          ) : planes.error ? (
            <ErrorState title="No pudimos cargar los planes" onRetry={cargar} />
          ) : rankingPlanes.length === 0 ? (
            <EmptyState icon={UserCheck} title="Sin membresías activas" description="Cuando haya socios con membresía activa, vemos qué plan eligen." />
          ) : (
            <Ranking items={rankingPlanes} />
          )}
        </section>

        <section className="glass panel" aria-label="Personas adentro">
          <SectionHeader
            title="Adentro ahora"
            description={dentro.data && dentro.data.total > 5 ? `Las 5 que más tiempo llevan, de ${dentro.data.total}.` : 'Ingresos sin egreso registrado.'}
            action={
              <Link to="/admin/acceso/dentro" className="btn btn-ghost">
                Ver lista
              </Link>
            }
          />
          {dentro.cargando ? (
            <LoadingState rows={3} label="Cargando accesos" />
          ) : dentro.error ? (
            <ErrorState title="No pudimos cargar los accesos" onRetry={cargar} />
          ) : !dentro.data || dentro.data.lista.length === 0 ? (
            <EmptyState icon={DoorOpen} title="No hay nadie adentro" description="Cuando se valide un ingreso, la persona aparece acá." />
          ) : (
            <div className="stack-list">
              {dentro.data.lista.map((s) => (
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
      </div>

      <div style={{ marginTop: 14 }}>
        <ActividadReciente
          registros={actividad.data}
          cargando={actividad.cargando}
          error={actividad.error}
          onRetry={cargarActividad}
          description="Movimientos del equipo de tu sede."
        />
      </div>
    </>
  );
}
