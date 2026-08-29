import { useState } from 'react';
import { pagosApi } from '../pagos.api';
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioId.trim()) { setMsg({ type: 'err', text: 'Ingresá el ID de usuario.' }); return; }
    if (!referenciaId.trim()) { setMsg({ type: 'err', text: 'Ingresá el ID de la referencia.' }); return; }
    if (tipo === TipoReferencia.RESERVA_CLASE && !monto.trim()) {
      setMsg({ type: 'err', text: 'Para reserva de clase es obligatorio indicar el monto.' });
      return;
    }
    setLoading(true);
    setMsg(null);
    setPago(null);
    try {
      const payload: { usuarioId: string; membresiaId?: string; reservaClaseId?: string; reservaCanchaId?: string; monto?: number } = {
        usuarioId: usuarioId.trim(),
      };
      if (tipo === TipoReferencia.MEMBRESIA) payload.membresiaId = referenciaId.trim();
      if (tipo === TipoReferencia.RESERVA_CLASE) payload.reservaClaseId = referenciaId.trim();
      if (tipo === TipoReferencia.RESERVA_CANCHA) payload.reservaCanchaId = referenciaId.trim();
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
        <p className="text-sm text-[#6B7280] mt-1">Registrá un pago manual. El monto se calcula en el backend salvo para reserva de clase.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <SectionTitle>Tipo de referencia</SectionTitle>
            <div className="flex gap-2 flex-wrap">
              <Chip label="Membresía" active={tipo === TipoReferencia.MEMBRESIA} onClick={() => setTipo(TipoReferencia.MEMBRESIA)} />
              <Chip label="Reserva de clase" active={tipo === TipoReferencia.RESERVA_CLASE} onClick={() => setTipo(TipoReferencia.RESERVA_CLASE)} />
              <Chip label="Reserva de cancha" active={tipo === TipoReferencia.RESERVA_CANCHA} onClick={() => setTipo(TipoReferencia.RESERVA_CANCHA)} />
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-[#374151]">ID de usuario</span>
            <input
              type="text"
              value={usuarioId}
              onChange={(e) => setUsuarioId(e.target.value)}
              required
              placeholder="UUID del usuario"
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
              style={{ minHeight: 44 }}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#374151]">
              {tipo === TipoReferencia.MEMBRESIA ? 'ID de membresía' : tipo === TipoReferencia.RESERVA_CLASE ? 'ID de reserva de clase' : 'ID de reserva de cancha'}
            </span>
            <input
              type="text"
              value={referenciaId}
              onChange={(e) => setReferenciaId(e.target.value)}
              required
              placeholder="UUID de la referencia"
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
              style={{ minHeight: 44 }}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[#374151]">
              Monto {tipo === TipoReferencia.RESERVA_CLASE ? '(obligatorio)' : '(opcional, lo calcula el backend)'}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required={tipo === TipoReferencia.RESERVA_CLASE}
              placeholder={tipo === TipoReferencia.RESERVA_CLASE ? 'Ej: 3500' : 'Dejar vacío para cálculo automático'}
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
              style={{ minHeight: 44 }}
            />
            {tipo !== TipoReferencia.RESERVA_CLASE && <p className="text-xs text-[#6B7280] mt-1">Si enviás monto para membresía/cancha, el backend lo ignora y usa el precio oficial.</p>}
          </label>

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
