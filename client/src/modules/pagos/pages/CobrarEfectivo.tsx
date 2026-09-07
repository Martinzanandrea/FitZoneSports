import { useEffect, useMemo, useState } from 'react';
import { pagosApi, type OpcionesCobroEfectivo } from '../pagos.api';
import type { Pago } from '../pagos.types';
import { Button, Card, Chip, SectionTitle } from '../../../shared/components/ui';

const TipoReferencia = {
  MEMBRESIA: 'MEMBRESIA',
  RESERVA_CLASE: 'RESERVA_CLASE',
  RESERVA_CANCHA: 'RESERVA_CANCHA',
} as const;
type TipoReferencia = (typeof TipoReferencia)[keyof typeof TipoReferencia];

export function CobrarEfectivo() {
  const [tipo, setTipo] = useState<TipoReferencia>(TipoReferencia.MEMBRESIA);
  const [usuarioId, setUsuarioId] = useState('');
  const [referenciaId, setReferenciaId] = useState('');
  const [monto, setMonto] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pago, setPago] = useState<Pago | null>(null);
  const [opciones, setOpciones] = useState<OpcionesCobroEfectivo | null>(null);
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [loadingOpciones, setLoadingOpciones] = useState(true);

  useEffect(() => {
    pagosApi.getOpcionesEfectivo()
      .then(setOpciones)
      .catch(() => setMsg({ type: 'err', text: 'No se pudieron cargar los usuarios y referencias de la sede.' }))
      .finally(() => setLoadingOpciones(false));
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const termino = busquedaUsuario.trim().toLowerCase();
    if (!opciones) return [];
    if (!termino) return opciones.usuarios;
    return opciones.usuarios.filter((u) =>
      `${u.nombre} ${u.apellido} ${u.dni ?? ''}`.toLowerCase().includes(termino),
    );
  }, [opciones, busquedaUsuario]);

  const membresiasUsuario = opciones?.membresias.filter((m) => m.usuario.id === usuarioId) ?? [];
  const reservasClaseUsuario = opciones?.reservasClase.filter((r) => r.usuario.id === usuarioId) ?? [];
  const reservasCanchaUsuario = opciones?.reservasCancha.filter((r) => r.usuario.id === usuarioId) ?? [];

  const cantidadReferencias = tipo === TipoReferencia.MEMBRESIA
    ? membresiasUsuario.length
    : tipo === TipoReferencia.RESERVA_CLASE
      ? reservasClaseUsuario.length
      : reservasCanchaUsuario.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioId) { setMsg({ type: 'err', text: 'Seleccioná un usuario.' }); return; }
    if (!referenciaId) { setMsg({ type: 'err', text: 'Seleccioná una membresía o reserva.' }); return; }
    setLoading(true);
    setMsg(null);
    setPago(null);
    try {
      const payload: { usuarioId: string; membresiaId?: string; reservaClaseId?: string; reservaCanchaId?: string; monto?: number } = {
        usuarioId,
      };
      if (tipo === TipoReferencia.MEMBRESIA) payload.membresiaId = referenciaId;
      if (tipo === TipoReferencia.RESERVA_CLASE) payload.reservaClaseId = referenciaId;
      if (tipo === TipoReferencia.RESERVA_CANCHA) payload.reservaCanchaId = referenciaId;
      if (monto.trim()) {
        const n = Number(monto);
        if (Number.isNaN(n) || n <= 0) { setMsg({ type: 'err', text: 'Monto inválido.' }); setLoading(false); return; }
        payload.monto = n;
      }
      const res = await pagosApi.registrarEfectivo(payload);
      setPago(res);
      setMsg({ type: 'ok', text: `Pago registrado: $${res.monto} — ${res.estado}` });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const text = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo registrar el pago.';
      setMsg({ type: 'err', text });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#111111]">Cobrar en efectivo</h1>
        <p className="text-sm text-[#6B7280] mt-1">Registrá un pago manual.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <SectionTitle>Tipo de referencia</SectionTitle>
            <div className="flex gap-2 flex-wrap">
              <Chip label="Membresía" active={tipo === TipoReferencia.MEMBRESIA} onClick={() => { setTipo(TipoReferencia.MEMBRESIA); setReferenciaId(''); setMonto(''); }} />
              <Chip label="Reserva de clase" active={tipo === TipoReferencia.RESERVA_CLASE} onClick={() => { setTipo(TipoReferencia.RESERVA_CLASE); setReferenciaId(''); setMonto(''); }} />
              <Chip label="Reserva de cancha" active={tipo === TipoReferencia.RESERVA_CANCHA} onClick={() => { setTipo(TipoReferencia.RESERVA_CANCHA); setReferenciaId(''); setMonto(''); }} />
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-[#374151]">Usuario</span>
            <div className="mt-1.5 space-y-2">
              <input
                type="text"
                value={busquedaUsuario}
                onChange={(e) => setBusquedaUsuario(e.target.value)}
                placeholder="Buscar por nombre, apellido o DNI"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
                style={{ minHeight: 44 }}
              />
              <select
                value={usuarioId}
                onChange={(e) => { setUsuarioId(e.target.value); setReferenciaId(''); }}
                disabled={loadingOpciones}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none bg-white"
                style={{ minHeight: 44 }}
              >
                <option value="">{loadingOpciones ? 'Cargando usuarios...' : 'Seleccionar usuario...'}</option>
                {usuariosFiltrados.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} {u.apellido} - DNI: {u.dni ?? 'sin DNI'}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <div>
            <span className="text-sm font-medium text-[#374151]">
              {tipo === TipoReferencia.MEMBRESIA ? 'Membresía' : tipo === TipoReferencia.RESERVA_CLASE ? 'Reserva de clase' : 'Reserva de cancha'}
            </span>
            <div className="mt-2 max-h-52 overflow-y-auto space-y-1">
              {!usuarioId && <p className="text-xs text-[#6B7280]">Seleccioná primero un usuario.</p>}
              {tipo === TipoReferencia.MEMBRESIA && membresiasUsuario.map((m) => (
                <button key={m.id} type="button" onClick={() => setReferenciaId(m.id)} className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${referenciaId === m.id ? 'border-[#8B2EFF] bg-[#F3E8FF]' : 'border-[#E5E7EB] bg-white'}`}>Plan {m.plan} · {m.estado} · hasta {m.fechaFin}</button>
              ))}
              {tipo === TipoReferencia.RESERVA_CLASE && reservasClaseUsuario.map((r) => (
                <button key={r.id} type="button" onClick={() => setReferenciaId(r.id)} className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${referenciaId === r.id ? 'border-[#8B2EFF] bg-[#F3E8FF]' : 'border-[#E5E7EB] bg-white'}`}>{r.clase.tipoClase} · {new Date(r.clase.horarioInicio).toLocaleString('es-AR')} · {r.estado}</button>
              ))}
              {tipo === TipoReferencia.RESERVA_CANCHA && reservasCanchaUsuario.map((r) => (
                <button key={r.id} type="button" onClick={() => setReferenciaId(r.id)} className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${referenciaId === r.id ? 'border-[#8B2EFF] bg-[#F3E8FF]' : 'border-[#E5E7EB] bg-white'}`}>{r.cancha.nombre} · {r.fecha} {r.horaInicio.slice(0, 5)} · Precio final: ${r.precioFinal}</button>
              ))}
              {usuarioId && cantidadReferencias === 0 && <p className="text-xs text-[#B91C1C]">Este usuario no tiene {tipo === TipoReferencia.MEMBRESIA ? 'membresías' : tipo === TipoReferencia.RESERVA_CLASE ? 'reservas de clase' : 'reservas de cancha'} disponibles.</p>}
            </div>
          </div>

          {tipo === TipoReferencia.RESERVA_CLASE && (
            <label className="block">
              <span className="text-sm font-medium text-[#374151]">Monto de la clase</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
                placeholder="Ej: 3500"
                className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
                style={{ minHeight: 44 }}
              />
            </label>
          )}

          <Button type="submit" disabled={loading} fullWidth>
            {loading ? 'Registrando...' : 'Registrar pago en efectivo'}
          </Button>
        </form>

        {msg && <p className={`mt-4 rounded-lg border p-3 text-sm ${msg.type==='ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>{msg.text}</p>}

        {pago && (
          <div className="mt-4 rounded-lg border border-[#DDD6FE] bg-[#F3E8FF] p-4">
            <p className="text-sm font-semibold text-[#111111]">Comprobante generado</p>
            <p className="text-sm text-[#6B7280] mt-1">Pago ID: <span className="font-mono text-xs text-[#111111]">{pago.id}</span></p>
            <p className="text-sm text-[#6B7280]">Monto: <span className="font-bold text-[#111111]">${pago.monto}</span> · {pago.estado}</p>
            {pago.comprobante?.pdfPath ? (
              <a href={pago.comprobante.pdfPath} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center justify-center gap-2 font-semibold rounded-xl px-4 h-11 bg-[#8B2EFF] text-white hover:bg-[#7A25E6] text-sm" style={{ minHeight: 44 }}>
                Ver comprobante PDF
              </a>
            ) : (
              <p className="text-xs text-[#6B7280] mt-2">El comprobante se generó correctamente. Ruta: {pago.comprobante ? 'disponible' : 'no devuelta por el servidor (revisar respuesta)'}</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
