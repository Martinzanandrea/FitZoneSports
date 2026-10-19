import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Bell, Search, Send } from 'lucide-react';
import {
  notificacionesApi,
  type AudienciaEnvio,
  type CanalNotificacion,
  type EnvioNotificacion,
  type FiltroAudiencia,
} from '../notificaciones.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { usuariosApi, type ClienteBuscado } from '../../usuarios/usuarios.api';
import { Select } from '../../../shared/components/atoms';;
import { Pagination } from '../../../shared/components/molecules';
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';
import { formatearFechaHora, mensajeDe } from '../utils';

const MAX_TITULO = 120;
const MAX_MENSAJE = 1000;
const MIN_BUSQUEDA = 3;
// Los totales de mails se completan en segundo plano: se vuelve a consultar una vez.
const REFRESCO_TOTALES_MS = 8000;

const AUDIENCIAS: Array<{ value: AudienciaEnvio; label: string }> = [
  { value: 'TODOS_LOS_SOCIOS', label: 'Todos los socios' },
  { value: 'SOCIOS_DE_SEDE', label: 'Socios de una sede' },
  { value: 'SOCIO', label: 'Un socio puntual' },
];

function etiquetaAudiencia(e: EnvioNotificacion): string {
  if (e.audiencia === 'TODOS_LOS_SOCIOS') return 'Todos los socios';
  if (e.audiencia === 'SOCIOS_DE_SEDE') return `Sede ${e.sede?.nombre ?? ''}`.trim();
  return e.destinatario ? `${e.destinatario.nombre} ${e.destinatario.apellido}` : 'Un socio';
}

export function EnviarNotificaciones() {
  useTitulo('Notificaciones');

  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [audiencia, setAudiencia] = useState<AudienciaEnvio>('TODOS_LOS_SOCIOS');
  const [sedeId, setSedeId] = useState('');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<ClienteBuscado[]>([]);
  const [socio, setSocio] = useState<ClienteBuscado | null>(null);
  const [panel, setPanel] = useState(true);
  const [email, setEmail] = useState(false);
  const [push, setPush] = useState(false);

  const [preview, setPreview] = useState<{ cantidad: number; conEmailVerificado: number } | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [errorPreview, setErrorPreview] = useState('');

  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [envios, setEnvios] = useState<EnvioNotificacion[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    sedesApi.getAll(1, 100).then((r) => setSedes(r.data)).catch(() => setSedes([]));
  }, []);

  // Búsqueda de socio con espera de 300 ms; el servidor pide mínimo 3 letras.
  useEffect(() => {
    const t = window.setTimeout(() => setQ(busqueda.trim()), 300);
    return () => window.clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    if (audiencia !== 'SOCIO' || socio || q.length < MIN_BUSQUEDA) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResultados([]);
      return;
    }
    let viva = true;
    usuariosApi
      .buscarClientes(q)
      .then((r) => viva && setResultados(r.filter((c) => c.tipoActor === TipoActor.SOCIO)))
      .catch(() => viva && setResultados([]));
    return () => {
      viva = false;
    };
  }, [q, audiencia, socio]);

  const filtro: FiltroAudiencia | null =
    audiencia === 'TODOS_LOS_SOCIOS'
      ? { audiencia }
      : audiencia === 'SOCIOS_DE_SEDE'
        ? sedeId
          ? { audiencia, sedeId }
          : null
        : socio
          ? { audiencia, usuarioId: socio.id }
          : null;
  const filtroClave = filtro ? JSON.stringify(filtro) : '';

  // Vista previa: cuántos socios recibirían el aviso.
  useEffect(() => {
    if (!filtroClave) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(null);
      setErrorPreview('');
      return;
    }
    let viva = true;
    setCargandoPreview(true);
    setErrorPreview('');
    notificacionesApi
      .previsualizar(JSON.parse(filtroClave) as FiltroAudiencia)
      .then((r) => viva && setPreview(r))
      .catch((e) => {
        if (!viva) return;
        setPreview(null);
        setErrorPreview(mensajeDe(e, 'No se pudo calcular la cantidad de destinatarios.'));
      })
      .finally(() => viva && setCargandoPreview(false));
    return () => {
      viva = false;
    };
  }, [filtroClave]);

  const cargarHistorial = useCallback(
    (silencioso = false) => {
      if (!silencioso) {
        setCargandoHistorial(true);
        setErrorHistorial(false);
      }
      return notificacionesApi
        .historial(page)
        .then((r) => {
          setEnvios(r.data);
          setTotalPages(r.totalPages);
        })
        .catch(() => !silencioso && setErrorHistorial(true))
        .finally(() => !silencioso && setCargandoHistorial(false));
    },
    [page],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarHistorial();
  }, [cargarHistorial, recarga]);

  const canales: CanalNotificacion[] = [...(panel ? (['PANEL'] as const) : []), ...(email ? (['EMAIL'] as const) : []), ...(push ? (['PUSH'] as const) : [])];
  const formularioCompleto = titulo.trim().length > 0 && mensaje.trim().length > 0 && canales.length > 0 && !!filtro;
  const sinDestinatarios = preview !== null && preview.cantidad === 0;

  function pedirConfirmacion(e: FormEvent) {
    e.preventDefault();
    if (!formularioCompleto || !preview || sinDestinatarios) return;
    setMsg(null);
    setConfirmando(true);
  }

  async function enviar() {
    if (!filtro) return;
    setEnviando(true);
    try {
      await notificacionesApi.crearEnvio({ ...filtro, titulo: titulo.trim(), mensaje: mensaje.trim(), canales });
      setMsg({ type: 'ok', text: 'Aviso enviado. Los mails se envían de a uno; el historial muestra los totales.' });
      setConfirmando(false);
      setTitulo('');
      setMensaje('');
      setPage(1);
      setRecarga((n) => n + 1);
      window.setTimeout(() => void cargarHistorial(true), REFRESCO_TOTALES_MS);
    } catch (e) {
      setConfirmando(false);
      setMsg({ type: 'err', text: mensajeDe(e, 'No se pudo enviar el aviso.') });
    } finally {
      setEnviando(false);
    }
  }

  const resumenCanales = canales.map((c) => (c === 'PANEL' ? 'la campanita' : c === 'EMAIL' ? 'mail' : 'notificación push')).join(' y ');

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Notificaciones</h2>
          <p>Enviá avisos a los socios. Llegan a su campanita y, si querés, por mail (solo a emails verificados).</p>
        </div>
      </div>

      <div className="ops-grid">
        <section className="glass panel" aria-label="Nuevo aviso">
          <SectionHeader title="Nuevo aviso" />
          <form onSubmit={pedirConfirmacion} className="stack-gap">
            <div>
              <label className="field-label" htmlFor="notif-titulo">
                TÍTULO
              </label>
              <input
                id="notif-titulo"
                className="field-input"
                value={titulo}
                maxLength={MAX_TITULO}
                onChange={(e) => setTitulo(e.target.value)}
                required
              />
              <small style={{ fontSize: 10 }}>
                {titulo.length}/{MAX_TITULO}
              </small>
            </div>

            <div>
              <label className="field-label" htmlFor="notif-mensaje">
                MENSAJE
              </label>
              <textarea
                id="notif-mensaje"
                className="field-input"
                style={{ height: 120, padding: 12, resize: 'vertical' }}
                value={mensaje}
                maxLength={MAX_MENSAJE}
                onChange={(e) => setMensaje(e.target.value)}
                required
              />
              <small style={{ fontSize: 10 }}>
                {mensaje.length}/{MAX_MENSAJE} · texto plano
              </small>
            </div>

            <div>
              <span className="field-label">AUDIENCIA</span>
              <Select
                value={audiencia}
                onChange={(v) => {
                  setAudiencia(v as AudienciaEnvio);
                  setSocio(null);
                  setBusqueda('');
                }}
                ariaLabel="Audiencia"
                opciones={AUDIENCIAS}
              />
            </div>

            {audiencia === 'SOCIOS_DE_SEDE' && (
              <div>
                <span className="field-label">SEDE</span>
                <Select
                  value={sedeId}
                  onChange={setSedeId}
                  ariaLabel="Sede"
                  placeholder="Elegí una sede..."
                  opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
                />
              </div>
            )}

            {audiencia === 'SOCIO' && (
              <div>
                <span className="field-label">SOCIO</span>
                {socio ? (
                  <div className="list-row" style={{ borderTop: 0, padding: 0 }}>
                    <div className="row-main">
                      <strong>
                        {socio.nombre} {socio.apellido}
                      </strong>
                      <span>DNI {socio.dni ?? 'sin DNI'}</span>
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={() => setSocio(null)}>
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
                        placeholder="Nombre, apellido o DNI (mínimo 3 letras)"
                        aria-label="Buscar socio"
                      />
                    </label>
                    {resultados.length > 0 && (
                      <div className="pick-list" style={{ marginTop: 6 }}>
                        {resultados.map((c) => (
                          <button key={c.id} type="button" className="pick-item" onClick={() => setSocio(c)}>
                            <span>
                              {c.apellido}, {c.nombre}
                              <br />
                              <small>DNI {c.dni ?? 'sin DNI'}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field-label">CANALES</legend>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, fontSize: 12 }}>
                <input type="checkbox" checked={panel} onChange={(e) => setPanel(e.target.checked)} /> Campanita del panel
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, fontSize: 12 }}>
                <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Mail
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, fontSize: 12 }}>
                <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} /> Notificación push
              </label>
              {push && (
                <p style={{ fontSize: 11, marginTop: 2 }}>Solo llega a quienes activaron las notificaciones en su dispositivo.</p>
              )}
              {canales.length === 0 && (
                <p role="alert" className="notice notice-err" style={{ marginTop: 6 }}>
                  Elegí al menos un canal.
                </p>
              )}
            </fieldset>

            <div aria-live="polite" style={{ minHeight: 20, fontSize: 12 }}>
              {cargandoPreview ? (
                'Calculando destinatarios...'
              ) : errorPreview ? (
                <span className="notice notice-err">{errorPreview}</span>
              ) : preview ? (
                <span>
                  Llegará a <strong style={{ color: 'var(--text)' }}>{preview.cantidad}</strong> socio{preview.cantidad === 1 ? '' : 's'}
                  {email ? ` (${preview.conEmailVerificado} con email verificado)` : ''}.
                </span>
              ) : (
                'Elegí la audiencia para ver cuántos socios lo reciben.'
              )}
            </div>

            {msg && (
              <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`}>
                {msg.text}
              </p>
            )}

            <button type="submit" className="btn btn-primary" disabled={!formularioCompleto || !preview || sinDestinatarios}>
              <Send size={16} aria-hidden /> Revisar y enviar
            </button>
          </form>
        </section>

        <section className="glass panel" aria-label="Historial de envíos">
          <SectionHeader title="Historial de envíos" />
          {cargandoHistorial ? (
            <LoadingState rows={3} label="Cargando historial" />
          ) : errorHistorial ? (
            <ErrorState title="No pudimos cargar el historial" onRetry={() => setRecarga((n) => n + 1)} />
          ) : envios.length === 0 ? (
            <EmptyState icon={Bell} title="Todavía no enviaste avisos" description="Cuando envíes uno, queda registrado acá con sus totales." />
          ) : (
            <div className="ops-table" style={{ ['--cols' as string]: '1.6fr 1.2fr 0.8fr 0.9fr' }}>
              <div className="ops-row ops-head">
                <span>AVISO</span>
                <span>AUDIENCIA</span>
                <span>SOCIOS</span>
                <span>MAILS</span>
              </div>
              {envios.map((e) => (
                <div className="ops-row" key={e.id}>
                  <span data-label="AVISO">
                    <strong style={{ color: 'var(--text)' }}>{e.titulo}</strong>
                    <small style={{ display: 'block' }}>{formatearFechaHora(e.creadaEn)}</small>
                  </span>
                  <span data-label="AUDIENCIA">{etiquetaAudiencia(e)}</span>
                  <span data-label="SOCIOS">{e.totalDestinatarios}</span>
                  <span data-label="MAILS">
                    {e.canales.includes('EMAIL') ? (
                      <>
                        {e.emailsEnviados} enviados
                        <small style={{ display: 'block', color: e.emailsFallidos > 0 ? 'var(--coral)' : undefined }}>{e.emailsFallidos} fallidos</small>
                      </>
                    ) : (
                      'Sin mail'
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </section>
      </div>

      {confirmando && preview && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !enviando && setConfirmando(false)}>
          <div className="glass panel modal-card" role="alertdialog" aria-modal="true" aria-label="Confirmar envío">
            <SectionHeader title="Confirmar envío" />
            <p style={{ marginBottom: 10, fontSize: 13 }}>
              Vas a enviar <strong style={{ color: 'var(--text)' }}>«{titulo.trim()}»</strong> a{' '}
              <strong style={{ color: 'var(--text)' }}>
                {preview.cantidad} socio{preview.cantidad === 1 ? '' : 's'}
              </strong>{' '}
              por {resumenCanales}.
            </p>
            <p style={{ marginBottom: 14, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{mensaje.trim()}</p>
            <p style={{ marginBottom: 14, fontSize: 11 }}>No se puede deshacer.</p>
            <div className="inline-actions">
              <button className="btn btn-primary" disabled={enviando} onClick={() => void enviar()}>
                {enviando ? 'Enviando...' : 'Sí, enviar'}
              </button>
              <button className="btn btn-secondary" disabled={enviando} onClick={() => setConfirmando(false)}>
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
