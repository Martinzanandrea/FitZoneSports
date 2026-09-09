import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { clasesApi } from '../clases.api';
import type { Clase, ClaseOcurrencia, ReservaClase } from '../clases.types';
import { usuariosApi } from '../../usuarios/usuarios.api';
import type { Usuario } from '../../usuarios/usuarios.types';
import { Badge, Button, Card, SectionTitle } from '../../../shared/components/ui';

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

function etiquetaOcurrencia(o: ClaseOcurrencia): string {
  return `${formatearFecha(o.fecha)} · ${o.horaInicio.slice(0, 5)} - ${o.horaFin.slice(0, 5)}`;
}

export function GestionReservasClases() {
  const { user } = useAuth();
  const sedeId = user?.sedeId ?? null;

  const [clases, setClases] = useState<Clase[]>([]);
  const [ocurrenciasPorClase, setOcurrenciasPorClase] = useState<Record<string, ClaseOcurrencia[]>>({});
  const [reservasPorOcurrencia, setReservasPorOcurrencia] = useState<Record<string, ReservaClase[]>>({});
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [claseIdSel, setClaseIdSel] = useState('');
  const [ocurrenciaIdSel, setOcurrenciaIdSel] = useState('');
  const [usuarioIdSel, setUsuarioIdSel] = useState('');
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [accionId, setAccionId] = useState<string | null>(null);

  const clasesDeSede = useMemo(() => {
    if (!sedeId) return [];
    return clases.filter((c) => c.sede.id === sedeId && c.activa);
  }, [clases, sedeId]);

  const ocurrenciasAnotables = useMemo(() => {
    const limite = Date.now() + 30 * 60 * 1000;
    const todas = Object.entries(ocurrenciasPorClase)
      .filter(([claseId]) => clasesDeSede.some((c) => c.id === claseId))
      .flatMap(([claseId, occs]) => occs.map((o) => ({ ...o, claseId })));
    return todas
      .filter((o) => o.estado === 'PROGRAMADA' && inicioOcurrencia(o) >= limite)
      .sort((a, b) => inicioOcurrencia(a) - inicioOcurrencia(b));
  }, [ocurrenciasPorClase, clasesDeSede]);

  const clasePorId = useMemo(() => new Map(clases.map((c) => [c.id, c])), [clases]);

  const usuariosFiltrados = useMemo(() => {
    const q = busquedaUsuario.trim().toLowerCase();
    const base = usuarios.filter((u) => u.tipoActor === 'SOCIO' || u.tipoActor === 'EXTERNO');
    if (!q) return base.slice(0, 50);
    return base.filter((u) =>
      `${u.nombre} ${u.apellido} ${u.email} ${u.dni ?? ''}`.toLowerCase().includes(q),
    ).slice(0, 50);
  }, [usuarios, busquedaUsuario]);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [allClases, allUsuarios] = await Promise.all([clasesApi.getAll(), usuariosApi.getAll()]);
      setClases(allClases);
      setUsuarios(allUsuarios);
      const deSede = sedeId ? allClases.filter((c) => c.sede.id === sedeId && c.activa) : [];
      if (deSede.length && !claseIdSel) setClaseIdSel(deSede[0].id);
      const hoy = aYMD(new Date());
      const hasta = aYMD(new Date(Date.now() + DIAS_A_FUTURO * 24 * 60 * 60 * 1000));
      const occMap: Record<string, ClaseOcurrencia[]> = {};
      await Promise.all(
        deSede.map(async (c) => {
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
    } catch {
      setError('No se pudieron cargar las clases.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId]);

  useEffect(() => {
    if (ocurrenciaIdSel && !ocurrenciasAnotables.some((o) => o.id === ocurrenciaIdSel)) {
      setOcurrenciaIdSel('');
    }
  }, [ocurrenciaIdSel, ocurrenciasAnotables]);

  async function handleReservar() {
    if (!ocurrenciaIdSel) { setMsg({ type: 'err', text: 'Seleccioná una fecha.' }); return; }
    if (!usuarioIdSel) { setMsg({ type: 'err', text: 'Seleccioná un usuario.' }); return; }
    setAccionId('reservar');
    setMsg(null);
    try {
      const reserva = await clasesApi.reservar(ocurrenciaIdSel, usuarioIdSel);
      setReservasPorOcurrencia((prev) => ({ ...prev, [ocurrenciaIdSel]: [...(prev[ocurrenciaIdSel] ?? []), reserva] }));
      setMsg({ type: 'ok', text: `Reserva creada: ${reserva.usuario.nombre} ${reserva.usuario.apellido} — ${reserva.estado}` });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const text = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo reservar.';
      setMsg({ type: 'err', text });
    } finally {
      setAccionId(null);
    }
  }

  async function handleCancelar(reservaId: string) {
    setAccionId(reservaId);
    setMsg(null);
    try {
      await clasesApi.cancelarReserva(reservaId);
      setReservasPorOcurrencia((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) next[k] = next[k].filter((r) => r.id !== reservaId);
        return next;
      });
      setMsg({ type: 'ok', text: 'Reserva cancelada.' });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const text = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo cancelar.';
      setMsg({ type: 'err', text });
    } finally {
      setAccionId(null);
    }
  }

  if (!sedeId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-[#111111]">Reservas de clases</h1>
        <div className="mt-4 p-4 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-sm text-[#92400E]">
          Tu usuario no tiene una sede asignada.
        </div>
      </div>
    );
  }

  if (loading) return <div className="max-w-lg mx-auto px-4 py-6 text-sm text-[#6B7280]">Cargando clases...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#111111]">Reservas de clases</h1>
        <p className="text-sm text-[#6B7280] mt-1">Gestioná reservas de tu sede. Solo se muestran clases de tu sede.</p>
      </div>

      {error && <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{error}</p>}
      {msg && <p className={`rounded-lg border p-3 text-sm ${msg.type==='ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>{msg.text}</p>}

      {/* Formulario anotar */}
      <Card>
        <SectionTitle>Anotar socio a clase</SectionTitle>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-[#374151]">Clase</span>
            <select
              value={claseIdSel}
              onChange={(e) => { setClaseIdSel(e.target.value); setOcurrenciaIdSel(''); }}
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none bg-white"
              style={{ minHeight: 44 }}
            >
              <option value="">Seleccionar clase…</option>
              {clasesDeSede.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.tipoClase} — {c.sede.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#374151]">Fecha</span>
            <select
              value={ocurrenciaIdSel}
              onChange={(e) => setOcurrenciaIdSel(e.target.value)}
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none bg-white"
              style={{ minHeight: 44 }}
            >
              <option value="">Seleccionar fecha…</option>
              {ocurrenciasAnotables
                .filter((o) => !claseIdSel || o.claseId === claseIdSel)
                .map((o) => {
                  const clase = clasePorId.get(o.claseId);
                  const ocupadas = (reservasPorOcurrencia[o.id] ?? []).filter((r) => r.estado === 'RESERVADA').length;
                  return (
                    <option key={o.id} value={o.id}>
                      {clase?.tipoClase ?? ''} — {etiquetaOcurrencia(o)} ({ocupadas}/{clase?.capacidad ?? '?'})
                    </option>
                  );
                })}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#374151]">Buscar usuario (nombre, email o DNI)</span>
            <input
              type="text"
              value={busquedaUsuario}
              onChange={(e) => setBusquedaUsuario(e.target.value)}
              placeholder="Ej: juan, juan@mail.com, 12345678"
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
              style={{ minHeight: 44 }}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#374151]">Usuario (SOCIO / EXTERNO)</span>
            <select
              value={usuarioIdSel}
              onChange={(e) => setUsuarioIdSel(e.target.value)}
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none bg-white"
              style={{ minHeight: 44 }}
            >
              <option value="">Seleccionar usuario…</option>
              {usuariosFiltrados.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido} — {u.email} — {u.tipoActor}{u.dni ? ` — DNI ${u.dni}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#6B7280] mt-1">Se listan hasta 50 resultados. Usá la búsqueda para filtrar.</p>
          </label>

          <Button onClick={handleReservar} disabled={accionId === 'reservar'} fullWidth>
            {accionId === 'reservar' ? 'Anotando...' : 'Anotar'}
          </Button>
        </div>
      </Card>

      {/* Listado por clase */}
      <div className="space-y-3">
        <SectionTitle>Clases de tu sede</SectionTitle>
        {clasesDeSede.length === 0 ? (
          <Card className="text-center py-8"><p className="text-sm text-[#6B7280]">No hay clases en tu sede.</p></Card>
        ) : (
          clasesDeSede.map((clase) => {
            const ocurrencias = (ocurrenciasPorClase[clase.id] ?? [])
              .filter((o) => o.estado === 'PROGRAMADA')
              .sort((a, b) => inicioOcurrencia(a) - inicioOcurrencia(b));
            return (
              <Card key={clase.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#111111]">{clase.tipoClase}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{clase.sede.nombre} · {clase.instructor.nombre} · Cupo {clase.capacidad}</p>
                  </div>
                  <Badge variant="green">{ocurrencias.length} fecha(s)</Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {ocurrencias.length === 0 ? (
                    <p className="text-xs text-[#6B7280]">Sin fechas próximas.</p>
                  ) : (
                    ocurrencias.map((o) => {
                      const reservas = reservasPorOcurrencia[o.id] ?? [];
                      const ocupadas = reservas.filter((r) => r.estado === 'RESERVADA').length;
                      const llena = ocupadas >= clase.capacidad;
                      return (
                        <div key={o.id} className="rounded-lg border border-[#E5E7EB] p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-[#374151]">{etiquetaOcurrencia(o)}</p>
                            {llena ? <Badge variant="amber">Llena</Badge> : <Badge variant="green">{ocupadas}/{clase.capacidad}</Badge>}
                          </div>
                          <p className="text-xs font-semibold text-[#374151] mt-2 mb-1">Reservas ({reservas.length})</p>
                          {reservas.length === 0 ? (
                            <p className="text-xs text-[#6B7280]">Sin reservas.</p>
                          ) : (
                            <div className="space-y-2">
                              {reservas.map((r) => (
                                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] p-2.5">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-[#111111] truncate">{r.usuario.nombre} {r.usuario.apellido}</p>
                                    <div className="mt-1 flex gap-1 flex-wrap">
                                      <Badge variant={r.estado === 'RESERVADA' ? 'green' : r.estado === 'LISTA_ESPERA' ? 'amber' : r.estado === 'CANCELADA' ? 'gray' : 'violet'}>{r.estado}</Badge>
                                    </div>
                                  </div>
                                  {r.estado !== 'CANCELADA' && (
                                    <Button variant="outline" size="sm" onClick={() => handleCancelar(r.id)} disabled={accionId === r.id}>
                                      {accionId === r.id ? '...' : 'Cancelar'}
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
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
    </div>
  );
}
