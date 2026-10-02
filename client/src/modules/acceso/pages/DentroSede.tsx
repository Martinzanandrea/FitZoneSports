import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { accesoApi } from '../acceso.api';
import type { SesionAbierta } from '../acceso.types';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { TipoActor } from '../../../shared/types/enums';
import { Button, Card, PageHeader, Pagination } from '../../../shared/components/ui';
import { Select } from '../../../shared/components/Select';
import { useTitulo } from '../../../shared/hooks/useTitulo';

function haceCuanto(horaIngreso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(horaIngreso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `hace ${h} h` : `hace ${h} h ${m} min`;
}

export function DentroSede() {
  useTitulo('Personas en sede');
  const { user } = useAuth();
  const esGerente = user?.tipoActor === TipoActor.GERENTE;
  const [sedeId, setSedeId] = useState<string | null>(user?.sedeId ?? null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sesiones, setSesiones] = useState<SesionAbierta[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [egresandoId, setEgresandoId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.sedeId) {
      setSedeId(user.sedeId);
    } else if (esGerente) {
      sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
    }
  }, [user, esGerente]);

  useEffect(() => {
    if (!sedeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    accesoApi
      .listarDentro(sedeId, page)
      .then((res) => {
        setSesiones(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .catch(() => {
        setSesiones([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [sedeId, page]);

  // TODO: la búsqueda solo aplica a la página actual, no al total — filtrar server-side en el futuro.
  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return sesiones;
    return sesiones.filter((s) =>
      `${s.usuario.nombre} ${s.usuario.apellido}`.toLowerCase().includes(texto),
    );
  }, [sesiones, busqueda]);

  async function handleEgreso(usuarioId: string, nombre: string) {
    setEgresandoId(usuarioId);
    setMsg(null);
    try {
      await accesoApi.registrarEgreso({ usuarioId });
      setMsg({ type: 'ok', text: `Egreso registrado: ${nombre}` });
      if (!sedeId) return;
      const res = await accesoApi.listarDentro(sedeId, page);
      if (res.data.length === 0 && page > 1) {
        setPage(page - 1);
      } else {
        setSesiones(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      }
    } catch {
      setMsg({ type: 'err', text: 'No se pudo registrar el egreso.' });
    } finally {
      setEgresandoId(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title={`Quién está dentro${total > 0 ? ` (${total})` : ''}`} onBack={() => window.history.back()} />

      {esGerente && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#374151]">
            Sede
            <div className="mt-1.5">
              <Select
                value={sedeId ?? ''}
                onChange={(v) => {
                  setSedeId(v || null);
                  setPage(1);
                }}
                placeholder="Seleccionar sede..."
                opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
              />
            </div>
          </label>
        </div>
      )}

      {msg && (
        <p className={`mb-4 rounded-lg border p-3 text-sm ${msg.type === 'ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>
          {msg.text}
        </p>
      )}

      <div className="mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre..."
          className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]"
          style={{ minHeight: 44 }}
        />
      </div>

      {loading ? (
        <p className="text-sm text-[#6B7280]">Cargando...</p>
      ) : !sedeId ? (
        <Card className="text-center py-8">
          <p className="text-sm text-[#6B7280]">Seleccioná una sede para ver quién está dentro.</p>
        </Card>
      ) : filtradas.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-sm text-[#6B7280]">
            {busqueda ? 'Nadie coincide con la búsqueda.' : 'No hay nadie registrado dentro en este momento.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtradas.map((s) => {
            const nombre = `${s.usuario.nombre} ${s.usuario.apellido}`;
            const ocupado = egresandoId === s.usuario.id;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111111] truncate">{nombre}</p>
                  <p className="text-xs text-[#6B7280]">
                    Ingresó {s.horaIngreso.slice(0, 5)} · {haceCuanto(s.horaIngreso)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEgreso(s.usuario.id, nombre)}
                  disabled={ocupado}
                >
                  {ocupado ? 'Registrando...' : 'Registrar egreso'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
