import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { pagosApi } from '../pagos.api';
import type { Pago } from '../pagos.types';
import { Badge, Card } from '../../../shared/components/ui';

function concepto(p: Pago) {
  if (p.membresia) return 'Membresía';
  if (p.reservaClase) return 'Reserva de clase';
  if (p.reservaCancha) return 'Reserva de cancha';
  return 'Pago';
}

export function MisPagos() {
  const { user } = useAuth();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    pagosApi.getPorUsuario(user.id).then(setPagos).catch(() => setError('No se pudieron cargar los pagos.')).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="max-w-lg mx-auto px-4 py-6 text-sm text-[#6B7280]">Cargando pagos...</div>;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-[#111111]">Mis pagos</h1>
      {error && <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}
      {pagos.length === 0 ? (
        <Card className="text-center py-8"><p className="text-sm text-[#6B7280]">Todavía no tenés pagos.</p></Card>
      ) : (
        pagos.map((p) => {
          const variant = p.estado === 'APROBADO' ? 'green' : p.estado === 'RECHAZADO' ? 'red' : 'amber';
          return (
            <Card key={p.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#111111]">{concepto(p)}</p>
                <Badge variant={variant}>{p.estado}</Badge>
              </div>
              <p className="text-xs text-[#6B7280]">{new Date(p.creadoEn).toLocaleString('es-AR')} · {p.metodo}</p>
              <p className="text-sm font-bold text-[#111111]">${p.monto}</p>
              {p.comprobante?.pdfPath && (
                <a href={p.comprobante.pdfPath} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#8B2EFF] underline">Ver comprobante</a>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
