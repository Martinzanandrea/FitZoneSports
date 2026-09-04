import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, User } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { clasesApi } from '../clases.api';
import type { Clase, ReservaClase } from '../clases.types';
import { Badge, Button, Card, Chip, SectionTitle } from '../../../shared/components/ui';

export function ReservarClases() {
  const { user } = useAuth();
  const [clases, setClases] = useState<Clase[]>([]);
  const [reservasPorClase, setReservasPorClase] = useState<Record<string, ReservaClase[]>>({});
  const [misReservas, setMisReservas] = useState<ReservaClase[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState<string>('TODOS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);

  const tipos = useMemo(() => {
    const set = new Set(clases.map((c) => c.tipoClase));
    return ['TODOS', ...Array.from(set)];
  }, [clases]);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const data = await clasesApi.getAll();
      setClases(data);
      const map: Record<string, ReservaClase[]> = {};
      await Promise.all(
        data.map(async (c) => {
          try {
            const r = await clasesApi.getReservasPorClase(c.id);
            map[c.id] = r;
          } catch {
            map[c.id] = [];
          }
        }),
      );
      setReservasPorClase(map);
      if (user) {
        const todas = Object.values(map).flat();
        setMisReservas(todas.filter((r) => r.usuario.id === user.id && r.estado !== 'CANCELADA'));
      }
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

  const limiteReserva = Date.now() + 48 * 60 * 60 * 1000;
  const filtradas = clases.filter((c) => {
    const cumpleHorario = new Date(c.horarioInicio).getTime() >= limiteReserva;
    return cumpleHorario && (tipoFiltro === 'TODOS' || c.tipoClase === tipoFiltro);
  });

  async function handleReservar(claseId: string) {
    if (!user) return;
    setAccionId(claseId);
    setError(null);
    try {
      const reserva = await clasesApi.reservar(claseId, user.id);
      setReservasPorClase((prev) => ({ ...prev, [claseId]: [...(prev[claseId] ?? []), reserva] }));
      setMisReservas((prev) => [...prev, reserva]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo reservar.';
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      setError(Array.isArray(raw) ? raw.join(', ') : (raw ?? msg));
    } finally {
      setAccionId(null);
    }
  }

  async function handleCancelar(reservaId: string) {
    setAccionId(reservaId);
    setError(null);
    try {
      await clasesApi.cancelar(reservaId);
      setMisReservas((prev) => prev.filter((r) => r.id !== reservaId));
      setReservasPorClase((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) next[k] = next[k].filter((r) => r.id !== reservaId);
        return next;
      });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      setError(Array.isArray(raw) ? raw.join(', ') : (raw ?? 'No se pudo cancelar.'));
    } finally {
      setAccionId(null);
    }
  }

  if (loading) return <div className="max-w-lg mx-auto px-4 py-6 text-sm text-[#6B7280]">Cargando clases...</div>;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#111111]">Reservar clases</h1>
        <p className="text-sm text-[#6B7280] mt-1">Elegí tu clase y reservá tu lugar.</p>
      </div>

      {error && <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tipos.map((t) => (
          <Chip key={t} label={t} active={tipoFiltro === t} onClick={() => setTipoFiltro(t)} />
        ))}
      </div>

      <div className="space-y-3">
        {filtradas.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-sm text-[#6B7280]">No hay clases para ese filtro.</p>
          </Card>
        ) : (
          filtradas.map((clase) => {
            const reservas = reservasPorClase[clase.id] ?? [];
            const ocupadas = reservas.filter((r) => r.estado === 'RESERVADA').length;
            const llena = ocupadas >= clase.capacidad;
            const yaReservada = misReservas.some((r) => r.clase.id === clase.id);
            return (
              <Card key={clase.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#111111]">{clase.tipoClase}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{clase.sede.nombre}</p>
                  </div>
                  {llena ? <Badge variant="amber">Llena</Badge> : <Badge variant="green">{ocupadas}/{clase.capacidad}</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#6B7280]">
                  <span className="inline-flex items-center gap-1"><User size={14} />{clase.instructor.nombre}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={14} />{new Date(clase.horarioInicio).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} - {new Date(clase.horarioFin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays size={14} />Cupo {ocupadas}/{clase.capacidad}</span>
                </div>
                <div className="mt-4">
                  {yaReservada ? (
                    <Badge variant="violet">Ya reservada</Badge>
                  ) : (
                    <Button onClick={() => handleReservar(clase.id)} disabled={accionId === clase.id} fullWidth>
                      {accionId === clase.id ? 'Reservando...' : llena ? 'Anotarme en lista de espera' : 'Reservar'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div>
        <SectionTitle>Mis reservas</SectionTitle>
        {misReservas.length === 0 ? (
          <Card className="text-center py-6">
            <p className="text-sm text-[#6B7280]">Todavía no tenés reservas.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {misReservas.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{r.clase.tipoClase}</p>
                  <p className="text-xs text-[#6B7280]">{new Date(r.clase.horarioInicio).toLocaleString('es-AR')}</p>
                  <div className="mt-1"><Badge variant={r.estado === 'LISTA_ESPERA' ? 'amber' : 'green'}>{r.estado}</Badge></div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleCancelar(r.id)} disabled={accionId === r.id}>
                  {accionId === r.id ? '...' : 'Cancelar'}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
