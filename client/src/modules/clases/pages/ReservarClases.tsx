import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, User } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { clasesApi } from '../clases.api';
import type { Clase, ClaseOcurrencia, ReservaClase } from '../clases.types';
import { Badge, Button, Card, Chip, SectionTitle } from '../../../shared/components/ui';

const DIAS_A_FUTURO = 14;

function aYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatearFecha(fechaYMD: string): string {
  const [y, m, d] = fechaYMD.split('-');
  return `${d}/${m}/${y}`;
}

function inicioOcurrencia(o: ClaseOcurrencia): number {
  return new Date(`${o.fecha}T${o.horaInicio}`).getTime();
}

export function ReservarClases() {
  const { user } = useAuth();
  const [clases, setClases] = useState<Clase[]>([]);
  const [ocurrenciasPorClase, setOcurrenciasPorClase] = useState<Record<string, ClaseOcurrencia[]>>({});
  const [reservasPorOcurrencia, setReservasPorOcurrencia] = useState<Record<string, ReservaClase[]>>({});
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
      const hoy = aYMD(new Date());
      const hasta = aYMD(new Date(Date.now() + DIAS_A_FUTURO * 24 * 60 * 60 * 1000));
      const occMap: Record<string, ClaseOcurrencia[]> = {};
      await Promise.all(
        data.map(async (c) => {
          try {
            occMap[c.id] = await clasesApi.getOcurrencias(c.id, hoy, hasta);
          } catch {
            occMap[c.id] = [];
          }
        }),
      );
      setOcurrenciasPorClase(occMap);
      const resMap: Record<string, ReservaClase[]> = {};
      await Promise.all(
        Object.values(occMap)
          .flat()
          .map(async (o) => {
            try {
              resMap[o.id] = await clasesApi.getReservasPorOcurrencia(o.id);
            } catch {
              resMap[o.id] = [];
            }
          }),
      );
      setReservasPorOcurrencia(resMap);
      if (user) {
        const todas = Object.values(resMap).flat();
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
  const filtradas = clases.filter((c) => tipoFiltro === 'TODOS' || c.tipoClase === tipoFiltro);

  async function handleReservar(ocurrenciaId: string) {
    if (!user) return;
    setAccionId(ocurrenciaId);
    setError(null);
    try {
      const reserva = await clasesApi.reservar(ocurrenciaId, user.id);
      setReservasPorOcurrencia((prev) => ({ ...prev, [ocurrenciaId]: [...(prev[ocurrenciaId] ?? []), reserva] }));
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
      await clasesApi.cancelarReserva(reservaId);
      setMisReservas((prev) => prev.filter((r) => r.id !== reservaId));
      setReservasPorOcurrencia((prev) => {
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
            const proximas = (ocurrenciasPorClase[clase.id] ?? [])
              .filter((o) => o.estado === 'PROGRAMADA' && inicioOcurrencia(o) >= limiteReserva)
              .sort((a, b) => inicioOcurrencia(a) - inicioOcurrencia(b));
            return (
              <Card key={clase.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#111111]">{clase.tipoClase}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{clase.sede.nombre}</p>
                  </div>
                  <Badge variant="green">Cupo {clase.capacidad}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#6B7280]">
                  <span className="inline-flex items-center gap-1"><User size={14} />{clase.instructor.nombre}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays size={14} />{proximas.length} fecha(s) disponible(s)</span>
                </div>
                <div className="mt-4 space-y-2">
                  {proximas.length === 0 ? (
                    <p className="text-xs text-[#6B7280]">Sin fechas próximas por ahora.</p>
                  ) : (
                    proximas.map((o) => {
                      const reservas = reservasPorOcurrencia[o.id] ?? [];
                      const ocupadas = reservas.filter((r) => r.estado === 'RESERVADA').length;
                      const llena = ocupadas >= clase.capacidad;
                      const yaReservada = misReservas.some((r) => r.ocurrencia.id === o.id);
                      return (
                        <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] p-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#111111]">
                              {formatearFecha(o.fecha)} · {o.horaInicio.slice(0, 5)} - {o.horaFin.slice(0, 5)}
                            </p>
                            <p className="text-xs text-[#6B7280] inline-flex items-center gap-1 mt-0.5">
                              <Clock size={12} />{ocupadas}/{clase.capacidad}{llena ? ' · Llena' : ''}
                            </p>
                          </div>
                          {yaReservada ? (
                            <Badge variant="violet">Ya reservada</Badge>
                          ) : (
                            <Button size="sm" onClick={() => handleReservar(o.id)} disabled={accionId === o.id}>
                              {accionId === o.id ? '...' : llena ? 'Espera' : 'Reservar'}
                            </Button>
                          )}
                        </div>
                      );
                    })
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
                  <p className="text-sm font-semibold text-[#111111]">{r.ocurrencia.clase.tipoClase}</p>
                  <p className="text-xs text-[#6B7280]">{formatearFecha(r.ocurrencia.fecha)} · {r.ocurrencia.horaInicio.slice(0, 5)}</p>
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
