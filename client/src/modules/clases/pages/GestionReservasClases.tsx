import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { clasesApi } from '../clases.api';
import type { Clase, ReservaClase } from '../clases.types';
import { usuariosApi } from '../../usuarios/usuarios.api';
import type { Usuario } from '../../usuarios/usuarios.types';
import { Badge, Button, Card, SectionTitle } from '../../../shared/components/ui';

export function GestionReservasClases() {
  const { user } = useAuth();
  const sedeId = user?.sedeId ?? null;

  const [clases, setClases] = useState<Clase[]>([]);
  const [reservasPorClase, setReservasPorClase] = useState<Record<string, ReservaClase[]>>({});
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [claseIdSel, setClaseIdSel] = useState('');
  const [usuarioIdSel, setUsuarioIdSel] = useState('');
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [accionId, setAccionId] = useState<string | null>(null);

  const clasesDeSede = useMemo(() => {
    if (!sedeId) return [];
    return clases.filter((c) => c.sede.id === sedeId);
  }, [clases, sedeId]);

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
      const filtradas = sedeId ? allClases.filter((c) => c.sede.id === sedeId) : [];
      if (filtradas.length && !claseIdSel) setClaseIdSel(filtradas[0].id);
      const map: Record<string, ReservaClase[]> = {};
      await Promise.all(
        filtradas.map(async (c) => {
          try {
            const r = await clasesApi.getReservasPorClase(c.id);
            map[c.id] = r;
          } catch {
            map[c.id] = [];
          }
        }),
      );
      setReservasPorClase(map);
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

  async function handleReservar() {
    if (!claseIdSel) { setMsg({ type: 'err', text: 'Seleccioná una clase.' }); return; }
    if (!usuarioIdSel) { setMsg({ type: 'err', text: 'Seleccioná un usuario.' }); return; }
    setAccionId('reservar');
    setMsg(null);
    try {
      const reserva = await clasesApi.reservar(claseIdSel, usuarioIdSel);
      setReservasPorClase((prev) => ({ ...prev, [claseIdSel]: [...(prev[claseIdSel] ?? []), reserva] }));
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
      await clasesApi.cancelar(reservaId);
      setReservasPorClase((prev) => {
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
              onChange={(e) => setClaseIdSel(e.target.value)}
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none bg-white"
              style={{ minHeight: 44 }}
            >
              <option value="">Seleccionar clase…</option>
              {clasesDeSede.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.tipoClase} — {new Date(c.horarioInicio).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} — {c.sede.nombre}
                </option>
              ))}
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
            const reservas = reservasPorClase[clase.id] ?? [];
            const ocupadas = reservas.filter((r) => r.estado === 'RESERVADA').length;
            const llena = ocupadas >= clase.capacidad;
            return (
              <Card key={clase.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#111111]">{clase.tipoClase}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{clase.sede.nombre} · {clase.instructor.nombre} · {new Date(clase.horarioInicio).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>
                  {llena ? <Badge variant="amber">Llena</Badge> : <Badge variant="green">{ocupadas}/{clase.capacidad}</Badge>}
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-[#374151] mb-2">Reservas ({reservas.length})</p>
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
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
