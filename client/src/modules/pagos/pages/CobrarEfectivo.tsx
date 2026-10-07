import { useEffect, useState, type FormEvent } from 'react';
import { Banknote, Search, UserRound } from 'lucide-react';
import { pagosApi, type OpcionesCobroEfectivo } from '../pagos.api';
import type { Pago } from '../pagos.types';
import { usuariosApi, type ClienteBuscado } from '../../usuarios/usuarios.api';
import { membresiasApi } from '../../membresias/membresias.api';
import type { Membresia } from '../../membresias/membresias.types';
import { preciosApi } from '../../precios/precios.api';
import type { PrecioPlan } from '../../precios/precios.types';
import { Select } from '../../../shared/components/Select';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { EmptyState } from '../../../shared/components/EmptyState';
import { LoadingState } from '../../../shared/components/LoadingState';
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

type Tipo = 'plan' | 'cancha';
type ReservaCancha = OpcionesCobroEfectivo['reservasCancha'][number];

const MIN_BUSQUEDA = 3;

function fechaCorta(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function tonoEstado(estado: Membresia['estado']): 'success' | 'warning' | 'danger' {
  return estado === 'ACTIVO' ? 'success' : estado === 'SUSPENDIDO' ? 'warning' : 'danger';
}

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

export function CobrarEfectivo() {
  useTitulo('Cobrar en efectivo');

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ClienteBuscado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [cliente, setCliente] = useState<ClienteBuscado | null>(null);

  const [membresia, setMembresia] = useState<Membresia | null>(null);
  const [cargandoMembresia, setCargandoMembresia] = useState(false);

  const [tipo, setTipo] = useState<Tipo>('plan');
  const [precios, setPrecios] = useState<PrecioPlan[]>([]);
  const [errorPrecios, setErrorPrecios] = useState(false);
  const [plan, setPlan] = useState('');
  const [reservas, setReservas] = useState<ReservaCancha[] | null>(null);
  const [cargandoReservas, setCargandoReservas] = useState(false);
  const [reservaId, setReservaId] = useState('');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pago, setPago] = useState<Pago | null>(null);

  // Planes reales con su precio (el backend vuelve a calcular el monto al cobrar).
  useEffect(() => {
    preciosApi.getMembresiasPublico().then(setPrecios).catch(() => setErrorPrecios(true));
  }, []);

  // Búsqueda con espera corta: GET /usuarios/buscar-clientes pide mínimo 3 caracteres.
  useEffect(() => {
    const q = busqueda.trim();
    if (cliente || q.length < MIN_BUSQUEDA) {
      setResultados([]);
      setErrorBusqueda('');
      return;
    }
    let viva = true;
    setBuscando(true);
    const t = window.setTimeout(() => {
      usuariosApi
        .buscarClientes(q)
        .then((r) => {
          if (!viva) return;
          setResultados(r);
          setErrorBusqueda('');
        })
        .catch(() => viva && setErrorBusqueda('No se pudo buscar. Intentá de nuevo.'))
        .finally(() => viva && setBuscando(false));
    }, 300);
    return () => {
      viva = false;
      window.clearTimeout(t);
      setBuscando(false);
    };
  }, [busqueda, cliente]);

  // Estado de membresía del cliente elegido (solo lectura).
  useEffect(() => {
    if (!cliente) {
      setMembresia(null);
      return;
    }
    let viva = true;
    setCargandoMembresia(true);
    membresiasApi
      .getVigente(cliente.id)
      .then((m) => viva && setMembresia(m))
      .catch(() => viva && setMembresia(null))
      .finally(() => viva && setCargandoMembresia(false));
    return () => {
      viva = false;
    };
  }, [cliente]);

  // Reservas de cancha pendientes de cobro: solo se piden al elegir "cancha".
  useEffect(() => {
    if (!cliente || tipo !== 'cancha') return;
    let viva = true;
    setCargandoReservas(true);
    pagosApi
      .getOpcionesEfectivo()
      .then((o) => viva && setReservas(o.reservasCancha.filter((r) => r.usuario.id === cliente.id)))
      .catch(() => viva && setReservas([]))
      .finally(() => viva && setCargandoReservas(false));
    return () => {
      viva = false;
    };
  }, [cliente, tipo]);

  function elegirCliente(c: ClienteBuscado) {
    setCliente(c);
    setBusqueda('');
    setResultados([]);
    setPlan('');
    setReservaId('');
    setReservas(null);
    setMsg(null);
    setPago(null);
  }

  function cambiarCliente() {
    setCliente(null);
    setMsg(null);
    setPago(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cliente) {
      setMsg({ type: 'err', text: 'Elegí un cliente.' });
      return;
    }
    if (tipo === 'plan' && !plan) {
      setMsg({ type: 'err', text: 'Elegí un plan.' });
      return;
    }
    if (tipo === 'cancha' && !reservaId) {
      setMsg({ type: 'err', text: 'Elegí una reserva de cancha.' });
      return;
    }
    setLoading(true);
    setMsg(null);
    setPago(null);
    try {
      const res = await pagosApi.registrarEfectivo(
        tipo === 'plan'
          ? { usuarioId: cliente.id, plan: plan as 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL' }
          : { usuarioId: cliente.id, reservaCanchaId: reservaId },
      );
      setPago(res);
      setMsg({ type: 'ok', text: `Pago registrado: $${res.monto} — ${res.estado}` });
      if (tipo === 'plan') {
        // Refresca el estado de membresía y, si era Externo, ahora figura como Socio.
        membresiasApi.getVigente(cliente.id).then(setMembresia).catch(() => undefined);
        if (cliente.tipoActor === TipoActor.EXTERNO) setCliente({ ...cliente, tipoActor: TipoActor.SOCIO });
      } else {
        setReservas((prev) => prev?.filter((r) => r.id !== reservaId) ?? null);
        setReservaId('');
      }
    } catch (err: unknown) {
      setMsg({ type: 'err', text: mensajeDe(err, 'No se pudo registrar el pago.') });
    } finally {
      setLoading(false);
    }
  }

  const planElegido = precios.find((p) => p.plan === plan);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Cobrar en efectivo</h2>
          <p>Registrá el pago de una membresía o de una reserva de cancha. Las clases no se cobran por separado.</p>
        </div>
      </div>

      <div className="ops-grid">
        <section className="glass panel" aria-label="Datos del cobro">
          <form onSubmit={(e) => void handleSubmit(e)} className="stack-gap">
            {/* 1. Cliente */}
            <div>
              <span className="field-label">CLIENTE</span>
              {cliente ? (
                <div className="list-row" style={{ borderTop: 0, padding: 0 }}>
                  <span className="avatar" aria-hidden>
                    {`${cliente.nombre[0] ?? ''}${cliente.apellido[0] ?? ''}`.toUpperCase()}
                  </span>
                  <div className="row-main">
                    <strong>
                      {cliente.nombre} {cliente.apellido}
                    </strong>
                    <span>
                      DNI {cliente.dni ?? 'sin DNI'} · {cliente.tipoActor === TipoActor.EXTERNO ? 'Cliente externo' : 'Socio'}
                    </span>
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={cambiarCliente}>
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <label className="search search-wide">
                    <Search size={15} aria-hidden />
                    <input
                      type="search"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre, apellido o DNI (mínimo 3 letras)"
                      aria-label="Buscar cliente"
                    />
                  </label>
                  {busqueda.trim().length > 0 && busqueda.trim().length < MIN_BUSQUEDA && (
                    <p style={{ fontSize: 11, marginTop: 8 }}>Escribí al menos {MIN_BUSQUEDA} caracteres.</p>
                  )}
                  {buscando && <LoadingState rows={1} label="Buscando" />}
                  {errorBusqueda && (
                    <p role="alert" className="notice notice-err" style={{ marginTop: 8 }}>
                      {errorBusqueda}
                    </p>
                  )}
                  {!buscando && !errorBusqueda && busqueda.trim().length >= MIN_BUSQUEDA && resultados.length === 0 && (
                    <p style={{ fontSize: 11, marginTop: 8 }}>No encontramos clientes con esa búsqueda.</p>
                  )}
                  {resultados.length > 0 && (
                    <div className="pick-list" style={{ marginTop: 8 }}>
                      {resultados.map((c) => (
                        <button key={c.id} type="button" className="pick-item" onClick={() => elegirCliente(c)}>
                          <span>
                            {c.nombre} {c.apellido}
                            <br />
                            <small>DNI {c.dni ?? 'sin DNI'}</small>
                          </span>
                          <small>{c.tipoActor === TipoActor.EXTERNO ? 'Externo' : 'Socio'}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {cliente && (
              <>
                {/* 2. Qué se cobra */}
                <div>
                  <span className="field-label">QUÉ SE COBRA</span>
                  <div className="segmented" style={{ marginBottom: 0 }}>
                    <button type="button" className={tipo === 'plan' ? 'active' : ''} onClick={() => { setTipo('plan'); setMsg(null); }}>
                      Plan de membresía
                    </button>
                    <button type="button" className={tipo === 'cancha' ? 'active' : ''} onClick={() => { setTipo('cancha'); setMsg(null); }}>
                      Reserva de cancha
                    </button>
                  </div>
                </div>

                {tipo === 'plan' ? (
                  <div>
                    <span className="field-label">PLAN</span>
                    {errorPrecios ? (
                      <p role="alert" className="notice notice-err">
                        No se pudieron cargar los planes.
                      </p>
                    ) : (
                      <Select
                        value={plan}
                        onChange={setPlan}
                        placeholder="Seleccionar plan..."
                        ariaLabel="Plan a cobrar"
                        opciones={precios.map((p) => ({
                          value: p.plan,
                          label: `${p.plan.charAt(0)}${p.plan.slice(1).toLowerCase()} — $${Number(p.precio).toLocaleString('es-AR')}`,
                        }))}
                      />
                    )}
                    {cliente.tipoActor === TipoActor.EXTERNO && (
                      <p style={{ fontSize: 11, marginTop: 8 }}>Al cobrar una membresía, el cliente externo pasa a ser socio.</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="field-label">RESERVA DE CANCHA</span>
                    {cargandoReservas ? (
                      <LoadingState rows={2} label="Cargando reservas" />
                    ) : !reservas || reservas.length === 0 ? (
                      <p style={{ fontSize: 12 }}>Este cliente no tiene reservas de cancha pendientes de cobro.</p>
                    ) : (
                      <div className="pick-list">
                        {reservas.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            className={`pick-item ${reservaId === r.id ? 'active' : ''}`}
                            aria-pressed={reservaId === r.id}
                            onClick={() => setReservaId(r.id)}
                          >
                            <span>
                              {r.cancha.nombre}
                              <br />
                              <small>
                                {fechaCorta(r.fecha)} · {r.horaInicio.slice(0, 5)}
                              </small>
                            </span>
                            <strong>${Number(r.precioFinal).toLocaleString('es-AR')}</strong>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {msg && (
                  <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`}>
                    {msg.text}
                  </p>
                )}

                <button type="submit" className="btn btn-primary" disabled={loading || (tipo === 'plan' ? !plan : !reservaId)}>
                  <Banknote size={16} aria-hidden />
                  {loading
                    ? 'Registrando...'
                    : tipo === 'plan' && planElegido
                      ? `Confirmar cobro de $${Number(planElegido.precio).toLocaleString('es-AR')}`
                      : 'Confirmar cobro en efectivo'}
                </button>
              </>
            )}
          </form>

          {pago && (
            <div className="notice notice-ok" style={{ marginTop: 14 }}>
              <strong>Comprobante generado</strong>
              <p style={{ fontSize: 11, marginTop: 6 }}>
                Monto ${pago.monto} · {pago.estado}
              </p>
              {pago.comprobante?.pdfPath && (
                <a className="btn btn-secondary" style={{ marginTop: 10 }} href={pago.comprobante.pdfPath} target="_blank" rel="noreferrer">
                  Ver comprobante PDF
                </a>
              )}
            </div>
          )}
        </section>

        <section className="glass panel" aria-label="Estado de membresía">
          <SectionHeader title="Membresía del cliente" description="Solo lectura" />
          {!cliente ? (
            <EmptyState icon={UserRound} title="Elegí un cliente" description="Acá ves el estado de su membresía antes de cobrar." />
          ) : cargandoMembresia ? (
            <LoadingState rows={2} label="Cargando membresía" />
          ) : !membresia ? (
            <p style={{ fontSize: 12 }}>Este cliente no tiene membresía.</p>
          ) : (
            <div className="stack-list">
              <div className="list-row">
                <div className="row-main">
                  <strong>Plan {membresia.plan}</strong>
                  <span>
                    {fechaCorta(membresia.fechaInicio)} → {fechaCorta(membresia.fechaFin)}
                  </span>
                </div>
                <span className={`badge badge-${tonoEstado(membresia.estado)}`}>
                  <i />
                  {membresia.estado === 'ACTIVO' ? 'Activo' : membresia.estado === 'SUSPENDIDO' ? 'Suspendido' : 'Vencido'}
                </span>
              </div>
              <div className="list-row">
                <div className="row-main">
                  <strong>Sede de alta</strong>
                  <span>{membresia.sedeAlta.nombre}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
