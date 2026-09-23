import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Smartphone, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { pagosApi } from '../pagos.api';
import type { Pago } from '../pagos.types';
import { Badge, Card, Pagination } from '../../../shared/components/ui';

function concepto(p: Pago) {
  if (p.membresia) return 'Membresía';
  if (p.reservaClase) return 'Reserva de clase';
  if (p.reservaCancha) return 'Reserva de cancha';
  return 'Pago';
}

const metodoIcono: Record<string, { icon: LucideIcon; color: string }> = {
  EFECTIVO: { icon: Banknote, color: '#16A34A' },
  MERCADOPAGO: { icon: CreditCard, color: '#3B82F6' },
  MODO: { icon: Smartphone, color: '#8B2EFF' },
};

function variantPorEstado(estado: string): 'green' | 'red' | 'amber' {
  return estado === 'APROBADO' ? 'green' : estado === 'RECHAZADO' ? 'red' : 'amber';
}

function etiquetaEstado(estado: string) {
  return estado === 'APROBADO' ? '● Aprobado' : estado === 'RECHAZADO' ? '✕ Rechazado' : `◌ ${estado}`;
}

export function MisPagos() {
  const { user } = useAuth();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!user) return;
    pagosApi.getPorUsuario(user.id, page).then((res) => { setPagos(res.data); setTotalPages(res.totalPages); }).catch(() => setError('No se pudieron cargar los pagos.')).finally(() => setLoading(false));
  }, [user, page]);

  if (loading) return <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-[#6B7280]">Cargando pagos...</div>;

  const aprobados = pagos.filter((p) => p.estado === 'APROBADO');
  const total = aprobados.reduce((s, p) => s + Number(p.monto), 0);

  return (
    <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-gray-900">Mis pagos</h2>
        <p className="text-sm text-gray-400 mb-5">Historial de transacciones</p>
      </div>
      {error && <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}

      <div className="rounded-[1.75rem] p-5 mb-5 text-white" style={{ background: 'linear-gradient(135deg, #8B2EFF 0%, #A855F7 100%)' }}>
        <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">Total abonado</p>
        <p className="text-4xl font-black tracking-tight">${total.toLocaleString('es-AR')}</p>
        <p className="text-xs text-white/70 mt-1">{aprobados.length} pagos aprobados en esta página</p>
      </div>

      {pagos.length === 0 ? (
        <Card className="text-center py-8"><p className="text-sm text-[#6B7280]">Todavía no tenés pagos.</p></Card>
      ) : (
        <div className="space-y-3">
          {pagos.map((p) => {
            const { icon: IconoMetodo, color: colorMetodo } = metodoIcono[p.metodo] ?? { icon: CreditCard, color: '#6B7280' };
            return (
              <div key={p.id} className="bg-white rounded-[1.75rem] border border-gray-100 shadow-sm p-5">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${colorMetodo}1A` }}>
                    <IconoMetodo size={22} style={{ color: colorMetodo }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-black text-gray-900 leading-tight">{concepto(p)}</p>
                      <p className="text-base font-black text-gray-900 flex-shrink-0">${p.monto}</p>
                    </div>
                    <p className="text-xs text-gray-400">{new Date(p.creadoEn).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })} · {p.metodo}</p>
                    <div className="flex items-center justify-between mt-3">
                      <Badge variant={variantPorEstado(p.estado)}>{etiquetaEstado(p.estado)}</Badge>
                      {p.comprobante?.pdfPath && (
                        <a href={p.comprobante.pdfPath} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#8B2EFF] hover:underline">🧾 Comprobante</a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
