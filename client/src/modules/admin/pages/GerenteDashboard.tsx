import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Building2, CalendarDays, Clock3, DoorOpen, UserCheck, Users, Wallet } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import {
  adminApi,
  type AuditoriaRegistro,
  type DashboardResumen,
  type MembresiaPorSedeItem,
  type ReporteFinanciero,
} from '../admin.api';
import { accesoApi } from '../../acceso/acceso.api';
import type { ResumenAccesos } from '../../acceso/acceso.types';
import { sedesApi } from '../../sedes/sedes.api';
import { usuariosApi } from '../../usuarios/usuarios.api';
import { formatMoney } from '../../../shared/components/ui';
import { MetricCard } from '../../../shared/components/MetricCard';
import { MiniChart } from '../../../shared/components/MiniChart';
import { Ranking } from '../../../shared/components/Ranking';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { ActividadReciente } from '../components/ActividadReciente';
import { useTitulo } from '../../../shared/hooks/useTitulo';

// Mismo patrón para cada bloque: dato, carga y error propios, así un endpoint
// caído no apaga el resto del panel.
interface Bloque<T> {
  data: T | null;
  cargando: boolean;
  error: boolean;
}

function inicial<T>(): Bloque<T> {
  return { data: null, cargando: true, error: false };
}

function variacion(actual: number, anterior: number): string {
  if (anterior <= 0) return 'sin ingresos el mes anterior';
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}% vs mes anterior`;
}

function valor<T>(b: Bloque<T>, fmt: (d: T) => string): string {
  return b.data !== null ? fmt(b.data) : '—';
}

export function GerenteDashboard() {
  useTitulo('Panel general');
  const { user } = useAuth();
  const [resumen, setResumen] = useState<Bloque<DashboardResumen>>(inicial);
  const [fin, setFin] = useState<Bloque<ReporteFinanciero>>(inicial);
  const [accesos, setAccesos] = useState<Bloque<ResumenAccesos>>(inicial);
  const [membresias, setMembresias] = useState<Bloque<MembresiaPorSedeItem[]>>(inicial);
  const [sedesActivas, setSedesActivas] = useState<Bloque<number>>(inicial);
  const [usuarios, setUsuarios] = useState<Bloque<number>>(inicial);
  const [actividad, setActividad] = useState<Bloque<AuditoriaRegistro[]>>(inicial);

  const cargarActividad = useCallback(() => {
    setActividad(inicial());
    adminApi
      .getAuditoria(undefined, 1, 8)
      .then((r) => setActividad({ data: r.data, cargando: false, error: false }))
      .catch(() => setActividad({ data: null, cargando: false, error: true }));
  }, []);

  const cargar = useCallback(() => {
    function bloque<T>(promesa: Promise<T>, set: (b: Bloque<T>) => void) {
      set(inicial());
      promesa
        .then((data) => set({ data, cargando: false, error: false }))
        .catch(() => set({ data: null, cargando: false, error: true }));
    }
    bloque(adminApi.getDashboardResumen(), setResumen);
    bloque(adminApi.getReporteFinanciero(), setFin);
    bloque(accesoApi.getResumenAccesos(), setAccesos);
    bloque(adminApi.getMembresiasPorSede(), setMembresias);
    bloque(sedesApi.getAll(1, 100).then((r) => r.data.filter((s) => s.activa).length), setSedesActivas);
    bloque(usuariosApi.getAll(1, 1).then((r) => r.total), setUsuarios);
    cargarActividad();
  }, [cargarActividad]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const sociosActivos = membresias.data ? membresias.data.reduce((acc, s) => acc + s.activas, 0) : null;
  const porSede = fin.data?.porSede ?? [];
  const hayIngresosPorSede = porSede.some((s) => s.total > 0);
  const ocupacion = (accesos.data?.porSede ?? []).map((s) => ({
    name: s.sede,
    value: s.aforoMaximo > 0 ? Math.min(100, Math.round((s.aforoActual / s.aforoMaximo) * 100)) : 0,
  }));

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Panel general</h2>
          <p>Hola, {user?.nombre}. Así está toda la red hoy.</p>
        </div>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <MetricCard
          label="Ingresos del mes"
          value={valor(fin, (f) => formatMoney(f.ingresosMes))}
          change={fin.data ? variacion(fin.data.ingresosMes, fin.data.ingresosMesAnterior) : fin.cargando ? 'cargando' : 'no disponible'}
          icon={Wallet}
        />
        <MetricCard label="Ingresos de hoy" value={valor(fin, (f) => formatMoney(f.ingresosHoy))} change="pagos aprobados" icon={Banknote} />
        <MetricCard label="Clases hoy" value={valor(resumen, (r) => String(r.clasesHoy))} change="en toda la red" icon={CalendarDays} />
        <MetricCard label="Horas de cancha hoy" value={valor(resumen, (r) => `${r.horasCanchasAgendadasHoy} h`)} change="agendadas" icon={Clock3} />
        <MetricCard label="Sedes activas" value={valor(sedesActivas, String)} change="en operación" icon={Building2} />
        <MetricCard label="Socios con membresía activa" value={sociosActivos === null ? '—' : String(sociosActivos)} change="suma de todas las sedes" icon={UserCheck} />
        <MetricCard label="Usuarios registrados" value={valor(usuarios, String)} change="socios, externos y personal" icon={Users} />
        <MetricCard label="Entradas a sedes hoy" value={valor(accesos, (a) => String(a.totalIngresosHoy))} change="ingresos validados" icon={DoorOpen} />
      </div>

      <div className="content-grid">
        <section className="glass panel" aria-label="Ingresos por sede">
          <SectionHeader title="Ingresos del mes por sede" description="Pagos aprobados desde el 1° del mes." />
          {fin.cargando ? (
            <LoadingState rows={1} label="Cargando ingresos" />
          ) : fin.error ? (
            <ErrorState title="No pudimos cargar los ingresos" onRetry={cargar} />
          ) : !hayIngresosPorSede ? (
            <EmptyState icon={Wallet} title="Sin ingresos este mes" description="Todavía no hay pagos aprobados en el mes actual." />
          ) : (
            <MiniChart
              values={porSede.map((s) => s.total)}
              labels={porSede.map((s) => s.sede)}
              ariaLabel="Ingresos del mes por sede"
            />
          )}
        </section>

        <section className="glass panel" aria-label="Ocupación por sede">
          <SectionHeader title="Ocupación ahora" description="Personas adentro sobre el aforo de cada sede." />
          {accesos.cargando ? (
            <LoadingState rows={2} label="Cargando ocupación" />
          ) : accesos.error ? (
            <ErrorState title="No pudimos cargar la ocupación" onRetry={cargar} />
          ) : ocupacion.length === 0 ? (
            <EmptyState icon={Building2} title="No hay sedes activas" description="Cuando haya sedes activas, mostramos su ocupación." />
          ) : (
            <Ranking items={[...ocupacion].sort((a, b) => b.value - a.value)} />
          )}
        </section>
      </div>

      <div style={{ marginTop: 14 }}>
        <ActividadReciente
          registros={actividad.data}
          cargando={actividad.cargando}
          error={actividad.error}
          onRetry={cargarActividad}
          description="Últimos movimientos del equipo."
        />
      </div>

      <p style={{ marginTop: 14, fontSize: 12 }}>
        Más detalle en <Link to="/admin/reportes" style={{ color: 'var(--lime)' }}>Reportes</Link>.
      </p>
    </>
  );
}
