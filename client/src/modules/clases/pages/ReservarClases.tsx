import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { TipoActor } from '../../../shared/types/enums';
import { clasesApi, fetchMapaClases } from '../clases.api';
import type { Clase, ClaseOcurrencia, MiReservaClase } from '../clases.types';
import { Badge } from '../../../shared/components/atoms';
import { Select } from '../../../shared/components/atoms';;
import { EmptyState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { useAhora } from '../../../shared/hooks/useAhora';
import { useTitulo } from '../../../shared/hooks/useTitulo';

const DIAS_A_FUTURO = 14;

function formatearFecha(fechaYMD: string): string {
  const [y, m, d] = fechaYMD.split('-');
  return `${d}/${m}/${y}`;
}

function etiquetaDia(fechaYMD: string): string {
  const [y, m, d] = fechaYMD.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = Math.round((fecha.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
  const nombre = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
  if (diff === 0) return `Hoy, ${nombre}`;
  if (diff === 1) return `Mañana, ${nombre}`;
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

function inicioOcurrencia(o: ClaseOcurrencia): number {
  return new Date(`${o.fecha}T${o.horaInicio}`).getTime();
}

function fechaLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ReservarClases() {
  const ahora = useAhora();
  useTitulo('Reservar clases');
  const { user } = useAuth();
  const [clases, setClases] = useState<Clase[]>([]);
  const [ocurrenciasPorClase, setOcurrenciasPorClase] = useState<Record<string, ClaseOcurrencia[]>>({});
  const [misReservas, setMisReservas] = useState<MiReservaClase[]>([]);
  const [sedeFiltro, setSedeFiltro] = useState<string>('');
  const [tipoFiltro, setTipoFiltro] = useState<string>('');
  const [diaFiltro, setDiaFiltro] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);

  const sedes = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of clases) mapa.set(c.sede.id, c.sede.nombre);
    return Array.from(mapa.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [clases]);

  const tipos = useMemo(() => Array.from(new Set(clases.map((c) => c.tipoClase))), [clases]);

  const dias = useMemo(() => {
    const out: string[] = [];
    const hoy = new Date();
    for (let i = 0; i < DIAS_A_FUTURO; i++) {
      const d = new Date(hoy);
      d.setDate(d.getDate() + i);
      out.push(fechaLocalYMD(d));
    }
    return out;
  }, []);

  // silencioso: refresca después de reservar/cancelar sin volver al spinner.
  async function cargar(silencioso = false) {
    if (!silencioso) setLoading(true);
    setError(null);
    try {
      // Cupos: conteo agregado por ocurrencia. Mis reservas: endpoint propio
      // (el backend toma el usuario del token y no expone reservas ajenas).
      const [mapa, mias] = await Promise.all([
        fetchMapaClases(DIAS_A_FUTURO),
        clasesApi.getMisReservas(fechaLocalYMD(new Date())),
      ]);
      setClases(mapa.clases);
      setOcurrenciasPorClase(mapa.occMap);
      setMisReservas(mias.data);
    } catch {
      setError('No se pudieron cargar las clases.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limiteReserva = ahora + 48 * 60 * 60 * 1000;
  const filtradas = clases.filter(
    (c) =>
      (sedeFiltro === '' || c.sede.id === sedeFiltro) &&
      (tipoFiltro === '' || c.tipoClase === tipoFiltro),
  );

  function mensajeError(e: unknown, porDefecto: string): string {
    const ax = e as { response?: { data?: { message?: string | string[] } } };
    const raw = ax.response?.data?.message;
    return Array.isArray(raw) ? raw.join(', ') : (raw ?? porDefecto);
  }

  async function handleReservar(ocurrenciaId: string) {
    if (!user) return;
    setAccionId(ocurrenciaId);
    setError(null);
    try {
      await clasesApi.reservar(ocurrenciaId, user.id);
      await cargar(true);
    } catch (e: unknown) {
      setError(mensajeError(e, 'No se pudo reservar.'));
    } finally {
      setAccionId(null);
    }
  }

  async function handleCancelar(reservaId: string) {
    setAccionId(reservaId);
    setError(null);
    try {
      await clasesApi.cancelarReserva(reservaId);
      await cargar(true);
    } catch (e: unknown) {
      setError(mensajeError(e, 'No se pudo cancelar.'));
    } finally {
      setAccionId(null);
    }
  }

  function limpiarFiltros() {
    setSedeFiltro('');
    setTipoFiltro('');
    setDiaFiltro('');
  }

  // Los Externos no tienen ni pueden tener membresía: no se les muestra
  // el catálogo (el backend igual lo rechaza si se fuerza la petición).
  if (user?.tipoActor === TipoActor.EXTERNO) {
    return (
      <>
        <div className="welcome-line">
          <div>
            <h2>Reservar clase</h2>
            <p>Las clases grupales son exclusivas para socios.</p>
          </div>
        </div>
        <EmptyState
          title="Solo para socios"
          description="Como Cliente Externo, podés alquilar canchas."
          icon={CalendarDays}
          action={
            <Link to="/reservar-canchas" className="btn btn-secondary">
              Alquilar una cancha
            </Link>
          }
        />
      </>
    );
  }

  // Protección: una reserva sin ocurrencia/clase no debe tumbar la pantalla.
  // Se omite del listado y se avisa en consola para no ocultar el problema.
  const reservasMostrables = misReservas.filter((r) => {
    const completa = Boolean(r.ocurrencia?.clase);
    if (!completa) console.error('Reserva de clase incompleta (falta ocurrencia/clase):', r.id);
    return completa;
  });

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Reservar clase</h2>
          <p>Elegí sede, actividad y día. El cupo se actualiza en tiempo real.</p>
        </div>
      </div>

      {error && (
        <p role="alert" style={{ borderRadius: 12, border: '1px solid rgba(255,130,108,.3)', background: 'rgba(255,130,108,.08)', padding: '12px 16px', fontSize: 12, marginBottom: 13 }}>
          {error}
        </p>
      )}

      {loading ? (
        <LoadingState rows={4} label="Cargando clases" />
      ) : (
        <section aria-label="Clases disponibles">
          <div className="filters glass">
            <div className="select-field">
              <span id="filtro-sede-clases">SEDE</span>
              <Select
                value={sedeFiltro}
                onChange={setSedeFiltro}
                ariaLabel="Filtrar por sede"
                opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
                placeholder="Todas las sedes"
              />
            </div>
            <div className="select-field">
              <span id="filtro-tipo-clases">ACTIVIDAD</span>
              <Select
                value={tipoFiltro}
                onChange={setTipoFiltro}
                ariaLabel="Filtrar por actividad"
                opciones={tipos.map((t) => ({ value: t, label: t }))}
                placeholder="Todas las clases"
              />
            </div>
            <div className="select-field">
              <span id="filtro-dia-clases">DÍA</span>
              <Select
                value={diaFiltro}
                onChange={setDiaFiltro}
                ariaLabel="Filtrar por día"
                opciones={dias.map((d) => ({ value: d, label: etiquetaDia(d) }))}
                placeholder="Próximos 14 días"
              />
            </div>
          </div>

          {filtradas.length === 0 ? (
            <EmptyState
              title="No hay clases para estos filtros"
              description="Probá cambiando de día, actividad o sede para encontrar más opciones."
              icon={CalendarDays}
              action={
                <button className="btn btn-secondary" onClick={limpiarFiltros}>
                  Limpiar filtros
                </button>
              }
            />
          ) : (
            <div className="class-list">
              {filtradas.map((clase) => {
                const proximas = (ocurrenciasPorClase[clase.id] ?? [])
                  .filter((o) => o.estado === 'PROGRAMADA' && inicioOcurrencia(o) >= limiteReserva)
                  .filter((o) => diaFiltro === '' || o.fecha === diaFiltro)
                  .sort((a, b) => inicioOcurrencia(a) - inicioOcurrencia(b));
                if (proximas.length === 0) return null;
                return (
                  <article className="glass class-card" key={clase.id}>
                    <div className="class-time">
                      <strong>{proximas[0].horaInicio.slice(0, 5)}</strong>
                      <span>
                        {formatearFecha(proximas[0].fecha)}
                        {proximas.length > 1 && ` · +${proximas.length - 1} turnos`}
                      </span>
                    </div>
                    <div className="class-info">
                      <span className="eyebrow">{clase.sede.nombre}</span>
                      <h3>{clase.tipoClase}</h3>
                      <p>Con {clase.instructor.nombre}</p>
                    </div>
                    <TurnoBoton
                      clase={clase}
                      ocurrencias={proximas}
                      misReservas={misReservas}
                      accionId={accionId}
                      onReservar={handleReservar}
                    />
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="glass panel" style={{ marginTop: 14 }} aria-label="Mis reservas de clases">
        <SectionHeader title="Mis reservas" description="Cancelá sin cargo hasta 6 h antes." />
        {reservasMostrables.length === 0 ? (
          <EmptyState
            title="Todavía no tenés reservas"
            description="Elegí un turno de la lista para empezar."
            icon={CalendarDays}
          />
        ) : (
          <div className="stack-list">
            {reservasMostrables.map((r) => (
              <div className="list-row" key={r.id}>
                <div className="row-main">
                  <strong>{r.ocurrencia.clase.tipoClase}</strong>
                  <span>
                    {formatearFecha(r.ocurrencia.fecha)} · {r.ocurrencia.horaInicio.slice(0, 5)}
                  </span>
                </div>
                <Badge variant={r.estado === "LISTA_ESPERA" ? "warning" : "success"}>
                  {r.estado === 'LISTA_ESPERA' ? 'En espera' : 'Confirmada'}
                </Badge>
                <button
                  className="btn btn-secondary"
                  onClick={() => void handleCancelar(r.id)}
                  disabled={accionId === r.id}
                  style={{ minHeight: 44 }}
                >
                  {accionId === r.id ? '...' : 'Cancelar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function TurnoBoton({
  clase,
  ocurrencias,
  misReservas,
  accionId,
  onReservar,
}: {
  clase: Clase;
  ocurrencias: ClaseOcurrencia[];
  misReservas: MiReservaClase[];
  accionId: string | null;
  onReservar: (ocurrenciaId: string) => void;
}) {
  // Muestra el primer turno con lugar (o el primero si todos están llenos).
  // El cupo ocupado viene como conteo agregado de la ocurrencia.
  const conLugar = ocurrencias.find((o) => (o.cupoOcupado ?? 0) < clase.capacidad) ?? ocurrencias[0];
  const ocupadas = conLugar.cupoOcupado ?? 0;
  const llena = ocupadas >= clase.capacidad;
  const yaReservada = misReservas.some((r) => r.ocurrencia.id === conLugar.id);
  const lugares = llena
    ? 'Completa'
    : ocupadas + 1 >= clase.capacidad
      ? 'Último lugar'
      : `${clase.capacidad - ocupadas} lugares`;

  if (yaReservada) return <Badge variant="success">Ya reservada</Badge>;
  return (
    <>
      <Badge variant={llena ? "danger" : ocupadas + 1 >= clase.capacidad ? "warning" : "success"}>{lugares}</Badge>
      <button
        className="btn btn-primary"
        disabled={llena || accionId === conLugar.id}
        onClick={() => onReservar(conLugar.id)}
        aria-label={llena ? `Sin cupo en ${clase.tipoClase}` : `Reservar ${clase.tipoClase} el ${formatearFecha(conLugar.fecha)} a las ${conLugar.horaInicio.slice(0, 5)}`}
      >
        {accionId === conLugar.id ? '...' : llena ? 'Sin cupo' : 'Reservar'}
      </button>
    </>
  );
}
