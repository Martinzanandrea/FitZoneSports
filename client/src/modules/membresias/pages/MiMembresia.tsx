import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { membresiasApi } from '../membresias.api';
import type { Membresia } from '../membresias.types';
import { Badge, Button, Card } from '../../../shared/components/ui';

export function MiMembresia() {
  const { user } = useAuth();
  const [membresia, setMembresia] = useState<Membresia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    membresiasApi.getVigente(user.id).then(setMembresia).catch(() => setError('No se pudo cargar la membresía.')).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="max-w-lg mx-auto px-4 py-6 text-sm text-[#6B7280]">Cargando membresía...</div>;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-[#111111]">Mi membresía</h1>
      {error && <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}
      {!membresia ? (
        <Card className="text-center py-8 space-y-3">
          <p className="text-sm text-[#6B7280]">No tenés una membresía activa.</p>
          <Link to="/completar-membresia"><Button>Contratar membresía</Button></Link>
        </Card>
      ) : (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[#111111]">Plan {membresia.plan}</p>
            <Badge variant={membresia.estado==='ACTIVO' ? 'green' : membresia.estado==='VENCIDO' ? 'red' : 'amber'}>{membresia.estado}</Badge>
          </div>
          <p className="text-sm text-[#6B7280]">Vigencia: {new Date(membresia.fechaInicio).toLocaleDateString('es-AR')} — {new Date(membresia.fechaFin).toLocaleDateString('es-AR')}</p>
          <p className="text-xs text-[#6B7280]">Sede alta: {membresia.sedeAlta.nombre}</p>
          <Link to="/completar-membresia"><Button fullWidth>Renovar</Button></Link>
        </Card>
      )}
    </div>
  );
}
