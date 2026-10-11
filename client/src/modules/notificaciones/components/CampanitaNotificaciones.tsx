import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { notificacionesApi, type Notificacion } from '../notificaciones.api';
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { formatearFechaHora } from '../utils';
import '../../../styles/notificaciones.css';

// Sin websockets: se refresca al montar, al volver a la pestaña y cada tanto.
const INTERVALO_REFRESCO_MS = 60_000;
const ITEMS_EN_PANEL = 8;
const ANCHO_PANEL = 360;
const MARGEN = 8;

export function CampanitaNotificaciones() {
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; ancho: number } | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refrescarConteo = useCallback(() => {
    notificacionesApi
      .contarNoLeidas()
      .then(setNoLeidas)
      .catch(() => undefined); // si falla se conserva el último valor
  }, []);

  useEffect(() => {
    refrescarConteo();
    const alVolver = () => {
      if (document.visibilityState === 'visible') refrescarConteo();
    };
    document.addEventListener('visibilitychange', alVolver);
    const t = window.setInterval(alVolver, INTERVALO_REFRESCO_MS);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.clearInterval(t);
    };
  }, [refrescarConteo]);

  const cargarLista = useCallback(() => {
    setCargando(true);
    setError(false);
    notificacionesApi
      .listar(1, ITEMS_EN_PANEL)
      .then((r) => setItems(r.data))
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, []);

  // Al abrir se trae la lista y se actualiza el conteo.
  useEffect(() => {
    if (!abierto) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarLista();
    refrescarConteo();
  }, [abierto, cargarLista, refrescarConteo]);

  // Posición fija junto al botón (portal sobre body, z-index de la escala).
  useLayoutEffect(() => {
    if (!abierto) return;
    function calcular() {
      const r = botonRef.current?.getBoundingClientRect();
      if (!r) return;
      const ancho = Math.min(ANCHO_PANEL, window.innerWidth - MARGEN * 2);
      const left = Math.max(MARGEN, Math.min(r.right - ancho, window.innerWidth - ancho - MARGEN));
      setPos({ top: r.bottom + MARGEN, left, ancho });
    }
    calcular();
    window.addEventListener('resize', calcular);
    window.addEventListener('scroll', calcular, true);
    return () => {
      window.removeEventListener('resize', calcular);
      window.removeEventListener('scroll', calcular, true);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function alClickAfuera(e: MouseEvent) {
      const o = e.target as Node;
      if (!botonRef.current?.contains(o) && !panelRef.current?.contains(o)) setAbierto(false);
    }
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAbierto(false);
        botonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', alClickAfuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClickAfuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, [abierto]);

  // Abrir una notificación la expande y la marca como leída.
  function abrirNotificacion(n: Notificacion) {
    setExpandida((actual) => (actual === n.id ? null : n.id));
    if (n.leidaEn) return;
    const ahora = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leidaEn: ahora } : x)));
    setNoLeidas((c) => Math.max(0, c - 1));
    notificacionesApi.marcarLeida(n.id).catch(() => {
      // Se revierte si el servidor no la pudo marcar.
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leidaEn: null } : x)));
      refrescarConteo();
    });
  }

  function marcarTodas() {
    const ahora = new Date().toISOString();
    setItems((prev) => prev.map((x) => ({ ...x, leidaEn: x.leidaEn ?? ahora })));
    setNoLeidas(0);
    notificacionesApi.leerTodas().catch(() => {
      cargarLista();
      refrescarConteo();
    });
  }

  const etiquetaConteo = noLeidas > 9 ? '9+' : String(noLeidas);

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className="icon-button notif-bell"
        aria-label={noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <Bell size={20} aria-hidden />
        {noLeidas > 0 && (
          <span className="notif-count" aria-hidden>
            {etiquetaConteo}
          </span>
        )}
      </button>

      {abierto &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notificaciones"
            className="notif-panel"
            style={{
              position: 'fixed',
              zIndex: 'var(--z-popover)',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              width: pos?.ancho ?? ANCHO_PANEL,
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            <div className="notif-head">
              <strong>Notificaciones</strong>
              <button type="button" className="btn btn-ghost" onClick={marcarTodas} disabled={noLeidas === 0}>
                <CheckCheck size={14} aria-hidden /> Marcar todas
              </button>
            </div>

            <div className="notif-body">
              {cargando && items.length === 0 ? (
                <LoadingState rows={2} label="Cargando notificaciones" />
              ) : error ? (
                <ErrorState title="No pudimos cargar tus notificaciones" onRetry={cargarLista} />
              ) : items.length === 0 ? (
                <EmptyState icon={BellOff} title="No tenés notificaciones" description="Cuando haya novedades de tus clases o avisos, aparecen acá." />
              ) : (
                <ul className="notif-list">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`notif-item${n.leidaEn ? '' : ' unread'}`}
                        aria-expanded={expandida === n.id}
                        onClick={() => abrirNotificacion(n)}
                      >
                        <span className="notif-title">
                          {!n.leidaEn && <i className="notif-dot" aria-label="Sin leer" />}
                          {n.titulo}
                        </span>
                        {/* Siempre texto plano: React escapa el contenido, nunca HTML. */}
                        <span className={`notif-msg${expandida === n.id ? ' open' : ''}`}>{n.mensaje}</span>
                        <small>{formatearFechaHora(n.creadaEn)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="notif-foot">
              <Link to="/notificaciones" onClick={() => setAbierto(false)}>
                Ver todas las notificaciones
              </Link>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
