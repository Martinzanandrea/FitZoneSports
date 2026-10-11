import { useCallback, useEffect, useState } from 'react';
import { BellOff, CheckCheck } from 'lucide-react';
import { notificacionesApi, type Notificacion } from '../notificaciones.api';
import { Pagination } from '../../../shared/components/molecules';
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { useTitulo } from '../../../shared/hooks/useTitulo';
import { formatearFechaHora } from '../utils';

const POR_PAGINA = 20;

export function MisNotificaciones() {
  useTitulo('Notificaciones');
  const [items, setItems] = useState<Notificacion[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError(false);
    notificacionesApi
      .listar(page, POR_PAGINA)
      .then((r) => {
        if (!viva) return;
        setItems(r.data);
        setTotalPages(r.totalPages);
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setCargando(false));
    return () => {
      viva = false;
    };
  }, [page, recarga]);

  const marcar = useCallback((n: Notificacion) => {
    if (n.leidaEn) return;
    const ahora = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leidaEn: ahora } : x)));
    notificacionesApi.marcarLeida(n.id).catch(() => setRecarga((v) => v + 1));
  }, []);

  function marcarTodas() {
    const ahora = new Date().toISOString();
    setItems((prev) => prev.map((x) => ({ ...x, leidaEn: x.leidaEn ?? ahora })));
    notificacionesApi.leerTodas().catch(() => setRecarga((v) => v + 1));
  }

  const hayNoLeidas = items.some((n) => !n.leidaEn);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Notificaciones</h2>
          <p>Novedades de tus clases y avisos de FitZone.</p>
        </div>
        <div className="inline-actions">
          <button className="btn btn-secondary" onClick={marcarTodas} disabled={!hayNoLeidas}>
            <CheckCheck size={15} aria-hidden /> Marcar todas como leídas
          </button>
        </div>
      </div>

      <section className="glass panel" aria-label="Lista de notificaciones">
        {cargando ? (
          <LoadingState rows={4} label="Cargando notificaciones" />
        ) : error ? (
          <ErrorState title="No pudimos cargar tus notificaciones" onRetry={() => setRecarga((n) => n + 1)} />
        ) : items.length === 0 ? (
          <EmptyState icon={BellOff} title="No tenés notificaciones" description="Cuando haya novedades de tus clases o avisos, aparecen acá." />
        ) : (
          <>
            <SectionHeader title="Más recientes primero" />
            <ul className="notif-list notif-list-page">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" className={`notif-item${n.leidaEn ? '' : ' unread'}`} onClick={() => marcar(n)}>
                    <span className="notif-title">
                      {!n.leidaEn && <i className="notif-dot" aria-label="Sin leer" />}
                      {n.titulo}
                    </span>
                    {/* Texto plano: nunca se interpreta como HTML. */}
                    <span className="notif-msg open">{n.mensaje}</span>
                    <small>{formatearFechaHora(n.creadaEn)}</small>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>
    </>
  );
}
