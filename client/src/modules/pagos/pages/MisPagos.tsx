import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Smartphone, type LucideIcon } from 'lucide-react';
import { pagosApi } from '../pagos.api';
import type { PagoPropio } from '../pagos.types';
import { Badge } from '../../../shared/components/atoms';
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { useTitulo } from '../../../shared/hooks/useTitulo';
import { motivoDeError, useAlVolverConexion } from '../../../shared/hooks/useEstadoConexion';
import { BotonComprobante } from '../components/BotonComprobante';

const metodoIcono: Record<string, { icon: LucideIcon; color: string }> = {
  EFECTIVO: { icon: Banknote, color: '#8cf2a6' },
  MERCADOPAGO: { icon: CreditCard, color: '#54e6d8' },
  MODO: { icon: Smartphone, color: '#ffd071' },
};

const NOMBRE_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo en mostrador',
  MERCADOPAGO: 'Mercado Pago',
  MODO: 'Modo',
};

function variantePorEstado(estado: string): 'success' | 'danger' | 'warning' {
  return estado === 'APROBADO' ? 'success' : estado === 'RECHAZADO' ? 'danger' : 'warning';
}

function etiquetaEstado(estado: string) {
  return estado === 'APROBADO' ? 'Aprobado' : estado === 'RECHAZADO' ? 'Rechazado' : 'Pendiente';
}

export function MisPagos() {
  useTitulo('Mis pagos');
  const [pagos, setPagos] = useState<PagoPropio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    // El servidor devuelve los pagos de la sesión (online y de mostrador).
    pagosApi
      .getMios(page)
      .then((res) => {
        if (!viva) return;
        setPagos(res.data);
        setTotalPages(res.totalPages);
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setLoading(false));
    return () => {
      viva = false;
    };
  }, [page, recarga]);

  useAlVolverConexion(() => {
    if (error) setRecarga((n) => n + 1);
  });

  const aprobados = pagos.filter((p) => p.estado === 'APROBADO');
  const total = aprobados.reduce((s, p) => s + Number(p.monto), 0);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Mis pagos</h2>
          <p>Historial de transacciones y comprobantes.</p>
        </div>
      </div>

      {loading ? (
        <LoadingState rows={4} label="Cargando pagos" />
      ) : error ? (
        <ErrorState
          title="No pudimos cargar los pagos"
          description={motivoDeError()}
          retryLabel="Reintentar"
          onRetry={() => setRecarga((n) => n + 1)}
        />
      ) : (
        <>
          <div className="glass panel" style={{ marginBottom: 14 }}>
            <div className="chart-value">
              <strong>${total.toLocaleString('es-AR')}</strong>
              <span>total abonado en esta página</span>
            </div>
            <p style={{ fontSize: 11, marginTop: 4 }}>{aprobados.length} pagos aprobados</p>
          </div>

          {pagos.length === 0 ? (
            <EmptyState
              title="Todavía no tenés pagos"
              description="Cuando realices un pago aparece acá con su comprobante."
              icon={CreditCard}
            />
          ) : (
            <section className="glass table-panel" aria-label="Historial de pagos">
              <SectionHeader title="Historial" description="Últimas transacciones." />
              <div className="data-table">
                <div className="table-head">
                  <span>Concepto</span>
                  <span>Estado</span>
                  <span>Fecha</span>
                  <span>Monto</span>
                </div>
                {pagos.map((p) => {
                  const { icon: IconoMetodo, color: colorMetodo } = metodoIcono[p.metodo] ?? {
                    icon: CreditCard,
                    color: 'var(--muted)',
                  };
                  return (
                    <div className="table-row" key={p.id}>
                      <div className="person-cell">
                        <span
                          className="avatar"
                          style={{ background: `${colorMetodo}1A`, color: colorMetodo, fontSize: 14 }}
                          aria-hidden
                        >
                          <IconoMetodo size={16} />
                        </span>
                        <span>
                          <strong>{p.concepto}</strong>
                          <small>{NOMBRE_METODO[p.metodo] ?? p.metodo}</small>
                        </span>
                      </div>
                      <span>
                        <Badge variant={variantePorEstado(p.estado)}>{etiquetaEstado(p.estado)}</Badge>
                      </span>
                      <span className="cell-value">
                        {new Date(p.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="row-actions">
                        <span className="cell-value" style={{ fontWeight: 700, color: 'var(--text)' }}>
                          ${Number(p.monto).toLocaleString('es-AR')}
                        </span>
                        {p.comprobanteId && (
                          <BotonComprobante comprobanteId={p.comprobanteId} ariaLabel={`Ver comprobante de ${p.concepto}`} />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="pagination-shell">
                  <span>
                    Página {page} de {totalPages}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn btn-secondary"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      style={{ minHeight: 44, padding: '0 12px' }}
                    >
                      Anterior
                    </button>
                    <button
                      className="btn btn-secondary"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                      style={{ minHeight: 44, padding: '0 12px' }}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
