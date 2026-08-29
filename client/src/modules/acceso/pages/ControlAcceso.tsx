import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { accesoApi } from '../acceso.api';
import { Badge, Button, Card, SectionTitle } from '../../../shared/components/ui';

export function ControlAcceso() {
  const { user } = useAuth();
  const sedeId = user?.sedeId ?? null;

  const [qrToken, setQrToken] = useState('');
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [aforo, setAforo] = useState<{ actual: number; maximo: number } | null>(null);
  const [loadingAforo, setLoadingAforo] = useState(true);

  const [usuarioIdEgreso, setUsuarioIdEgreso] = useState('');
  const [egresoLoading, setEgresoLoading] = useState(false);
  const [egresoMsg, setEgresoMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function cargarAforo() {
    if (!sedeId) { setLoadingAforo(false); return; }
    try {
      const data = await accesoApi.getAforo(sedeId);
      setAforo(data);
    } catch {
      setAforo(null);
    } finally {
      setLoadingAforo(false);
    }
  }

  useEffect(() => {
    void cargarAforo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId]);

  async function handleValidar() {
    if (!sedeId) {
      setResultado({ type: 'err', text: 'No tenés sede asignada.' });
      return;
    }
    if (!qrToken.trim()) {
      setResultado({ type: 'err', text: 'Ingresá el token QR.' });
      return;
    }
    setValidando(true);
    setResultado(null);
    try {
      const data = await accesoApi.validarIngreso({ qrToken: qrToken.trim(), sedeId });
      // backend devuelve ControlAcceso con usuario y sede poblados
      const nombre = data?.usuario ? `${data.usuario.nombre} ${data.usuario.apellido}` : 'Socio';
      setResultado({ type: 'ok', text: `Ingreso validado: ${nombre}` });
      setQrToken('');
      void cargarAforo();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo validar el ingreso.';
      setResultado({ type: 'err', text: msg });
    } finally {
      setValidando(false);
    }
  }

  async function handleEgreso() {
    if (!usuarioIdEgreso.trim()) {
      setEgresoMsg({ type: 'err', text: 'Ingresá el ID del usuario.' });
      return;
    }
    setEgresoLoading(true);
    setEgresoMsg(null);
    try {
      await accesoApi.registrarEgreso({ usuarioId: usuarioIdEgreso.trim() });
      setEgresoMsg({ type: 'ok', text: 'Egreso registrado correctamente.' });
      setUsuarioIdEgreso('');
      void cargarAforo();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo registrar el egreso.';
      setEgresoMsg({ type: 'err', text: msg });
    } finally {
      setEgresoLoading(false);
    }
  }

  if (!sedeId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-[#111111]">Control de acceso</h1>
        <div className="mt-4 p-4 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-sm text-[#92400E]">
          Tu usuario no tiene una sede asignada. Contactá a un gerente.
        </div>
      </div>
    );
  }

  const pct = aforo && aforo.maximo > 0 ? Math.min(100, Math.round((aforo.actual / aforo.maximo) * 100)) : 0;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#111111]">Control de acceso</h1>
        <p className="text-sm text-[#6B7280] mt-1">Validá ingresos por QR y registrá egresos de tu sede.</p>
      </div>

      {/* Aforo */}
      <Card>
        <SectionTitle>Aforo actual</SectionTitle>
        {loadingAforo ? (
          <p className="text-sm text-[#6B7280]">Cargando aforo...</p>
        ) : aforo ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#111111]">{aforo.actual} / {aforo.maximo}</span>
              <Badge variant={pct >= 90 ? 'red' : pct >= 70 ? 'amber' : 'green'}>{pct}%</Badge>
            </div>
            <div className="h-2.5 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: pct >= 90 ? '#DC2626' : pct >= 70 ? '#D97706' : '#8B2EFF' }}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setLoadingAforo(true); void cargarAforo(); }}>
              Actualizar
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[#6B7280]">No se pudo cargar el aforo.</p>
        )}
      </Card>

      {/* Validar ingreso */}
      <Card>
        <SectionTitle>Validar ingreso</SectionTitle>
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-[#374151]">Token QR del socio</span>
            <input
              type="text"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Pegá el qrToken aquí"
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm
                focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
              style={{ minHeight: 44 }}
            />
          </label>
          <Button onClick={handleValidar} disabled={validando} fullWidth>
            {validando ? 'Validando...' : 'Validar ingreso'}
          </Button>
          {resultado && (
            <p className={`rounded-lg border p-3 text-sm ${resultado.type === 'ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>
              {resultado.text}
            </p>
          )}
        </div>
      </Card>

      {/* Registrar egreso */}
      <Card>
        <SectionTitle>Registrar egreso</SectionTitle>
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-[#374151]">ID de usuario</span>
            <input
              type="text"
              value={usuarioIdEgreso}
              onChange={(e) => setUsuarioIdEgreso(e.target.value)}
              placeholder="UUID del usuario"
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm
                focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
              style={{ minHeight: 44 }}
            />
            <p className="text-xs text-[#6B7280] mt-1">Por ahora se ingresa el ID. A futuro se podrá buscar por DNI.</p>
          </label>
          <Button variant="outline" onClick={handleEgreso} disabled={egresoLoading} fullWidth>
            {egresoLoading ? 'Registrando...' : 'Registrar egreso'}
          </Button>
          {egresoMsg && (
            <p className={`rounded-lg border p-3 text-sm ${egresoMsg.type === 'ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>
              {egresoMsg.text}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
