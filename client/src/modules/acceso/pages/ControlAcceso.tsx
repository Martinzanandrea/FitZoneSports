import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { accesoApi } from '../acceso.api';
import type { SesionAbierta } from '../acceso.types';
import { sedesApi } from '../../sedes/sedes.api';
import { LectorQr } from '../components/LectorQr';
import { Button, Card, SectionTitle, StatCard, Tooltip } from '../../../shared/components/ui';
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';
export function ControlAcceso() {
  useTitulo('Control de Acceso');
  const { user } = useAuth();
  const navigate = useNavigate();
  const sedeId = user?.sedeId ?? null;

  const [tab, setTab] = useState<'camara' | 'manual' | 'codigo'>('codigo');
  const [qrToken, setQrToken] = useState('');
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [validandoCodigo, setValidandoCodigo] = useState(false);
  const codigoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === 'codigo') codigoRef.current?.focus();
  }, [tab]);

  const [aforo, setAforo] = useState<{ actual: number; maximo: number } | null>(null);
  const [loadingAforo, setLoadingAforo] = useState(true);
  const [sedeNombre, setSedeNombre] = useState('');

  const [dentro, setDentro] = useState<SesionAbierta[]>([]);
  const [totalDentro, setTotalDentro] = useState(0);
  const [loadingDentro, setLoadingDentro] = useState(true);
  const [egresandoId, setEgresandoId] = useState<string | null>(null);
  const [egresoMsg, setEgresoMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Tiempo transcurrido desde el ingreso ("hace 45 min", "hace 2 h 15 min").
  function haceCuanto(horaIngreso: string): string {
    const mins = Math.max(0, Math.round((Date.now() - new Date(horaIngreso).getTime()) / 60000));
    if (mins < 60) return `hace ${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `hace ${h} h` : `hace ${h} h ${m} min`;
  }

  async function cargarAforo() {
    if (!sedeId) { setLoadingAforo(false); return; }
    try {
      const [data, sede] = await Promise.all([
        accesoApi.getAforo(sedeId),
        sedesApi.getOne(sedeId).catch(() => null),
      ]);
      setAforo(data);
      if (sede) setSedeNombre(sede.nombre);
    } catch {
      setAforo(null);
    } finally {
      setLoadingAforo(false);
    }
  }

  // Resumen: primera página (hasta 4) + total para el contador.
  // La lista completa vive en /admin/acceso/dentro.
  async function cargarDentro() {
    if (!sedeId) { setLoadingDentro(false); return; }
    try {
      const res = await accesoApi.listarDentro(sedeId, 1, 4);
      setDentro(res.data);
      setTotalDentro(res.total);
    } catch {
      setDentro([]);
      setTotalDentro(0);
    } finally {
      setLoadingDentro(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarAforo();
    void cargarDentro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId]);

  // Mismo flujo para pegado manual y cámara: solo cambia de dónde viene el token.
  async function handleValidar(token: string) {
    if (!sedeId) {
      setResultado({ type: 'err', text: 'No tenés sede asignada.' });
      return;
    }
    if (!token.trim()) {
      setResultado({ type: 'err', text: 'Ingresá el token QR.' });
      return;
    }
    setValidando(true);
    setResultado(null);
    try {
      const data = await accesoApi.validarIngreso({ qrToken: token.trim(), sedeId });
      // backend devuelve ControlAcceso con usuario y sede poblados
      const nombre = data?.usuario ? `${data.usuario.nombre} ${data.usuario.apellido}` : 'Socio';
      setResultado({ type: 'ok', text: `Ingreso validado: ${nombre}` });
      setQrToken('');
      void cargarAforo();
      void cargarDentro();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo validar el ingreso.';
      setResultado({ type: 'err', text: msg });
    } finally {
      setValidando(false);
    }
  }

  // Remontar el lector (nuevo key) lo reinicia para otro escaneo.
  const [escanKey, setEscanKey] = useState(0);

  async function handleValidarCodigo(valor: string) {
    if (!sedeId) {
      setResultado({ type: 'err', text: 'No tenés sede asignada.' });
      return;
    }
    if (!/^\d{6}$/.test(valor)) {
      setResultado({ type: 'err', text: 'Ingresá los 6 dígitos del código.' });
      return;
    }
    setValidandoCodigo(true);
    setResultado(null);
    try {
      const data = await accesoApi.validarCodigo({ codigo: valor, sedeId });
      // backend devuelve ControlAcceso con usuario y sede poblados
      const nombre = data?.usuario ? `${data.usuario.nombre} ${data.usuario.apellido}` : 'Socio';
      setResultado({ type: 'ok', text: `Ingreso validado: ${nombre}` });
      setCodigo('');
      void cargarAforo();
      void cargarDentro();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo validar el ingreso.';
      setResultado({ type: 'err', text: msg });
    } finally {
      setValidandoCodigo(false);
    }
  }

  function handleCodigoChange(valor: string) {
    const limpio = valor.replace(/\D/g, '').slice(0, 6);
    setCodigo(limpio);
    // Avanza solo al completar los 6 dígitos.
    if (limpio.length === 6 && !validandoCodigo) void handleValidarCodigo(limpio);
  }

  // Egreso directo por fila: la lista ya trae el usuarioId, no se pide nada a mano.
  async function handleEgresoDirecto(usuarioId: string, nombre: string) {
    setEgresandoId(usuarioId);
    setEgresoMsg(null);
    try {
      await accesoApi.registrarEgreso({ usuarioId });
      // Releer la página del resumen para mantener bien el contador.
      await cargarDentro();
      setEgresoMsg({ type: 'ok', text: `Egreso registrado: ${nombre}` });
      void cargarAforo();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string | string[] } } };
      const raw = ax.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo registrar el egreso.';
      setEgresoMsg({ type: 'err', text: msg });
    } finally {
      setEgresandoId(null);
    }
  }

  // Solo el Recepcionista necesita sede asignada para operar. El Gerente
  // tiene sedeId null por diseño ("todas las sedes") y no debe bloquearse
  // (sus acciones degradan con gracia: aforo/validación y la lista de
  // quién está dentro requieren sede para cargarse).
  if (!sedeId && user?.tipoActor === TipoActor.RECEPCIONISTA) {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#111111] tracking-tight">Control de Acceso</h1>
        <p className="text-sm text-[#6B7280] mt-1">{sedeNombre ? `Validá ingresos por QR y registrá egresos de ${sedeNombre}.` : 'Validá ingresos por QR y registrá egresos de tu sede.'}</p>
      </div>

      {/* Aforo */}
      {loadingAforo ? (
        <p className="text-sm text-[#6B7280]">Cargando aforo...</p>
      ) : aforo ? (
        <div className="space-y-3">
          <StatCard label="Aforo actual" value={`${aforo.actual}/${aforo.maximo}`} sub={`${pct}% de ocupación`} icon={Users} iconColor="#8B2EFF" />
          <Button variant="ghost" size="sm" onClick={() => { setLoadingAforo(true); void cargarAforo(); }}>
            Actualizar
          </Button>
        </div>
      ) : (
        <p className="text-sm text-[#6B7280]">No se pudo cargar el aforo.</p>
      )}

      {/* En desktop la columna de validación queda ancha a propósito:
          el visor de la cámara necesita espacio real (el lector ocupa
          todo el ancho disponible, sin tope). A la derecha va la lista
          de quién está dentro. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
      {/* Validar ingreso */}
      <Card>
        <SectionTitle>Validar ingreso</SectionTitle>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F3F4F6] p-1 mb-4">
          {(
            [
              { id: 'camara', label: 'Cámara' },
              { id: 'manual', label: 'Pegado' },
              { id: 'codigo', label: 'Código' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                tab === t.id ? 'bg-white text-[#111111] shadow-sm' : 'text-[#6B7280]'
              }`}
              style={{ minHeight: 44 }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'camara' && (
          <div className="space-y-3">
            <LectorQr key={escanKey} onDetectado={(token) => void handleValidar(token)} />
            {resultado && (
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  setResultado(null);
                  setEscanKey((k) => k + 1);
                }}
              >
                Escanear otro código
              </Button>
            )}
          </div>
        )}

        {tab === 'manual' && (
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
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Button onClick={() => handleValidar(qrToken)} disabled={validando} fullWidth>
                  {validando ? 'Validando...' : 'Validar ingreso'}
                </Button>
              </div>
              <Tooltip text="Escaneá o pegá el código QR que te muestra el socio en su celular">
                <HelpCircle size={14} className="text-[#9CA3AF]" />
              </Tooltip>
            </div>
          </div>
        )}

        {tab === 'codigo' && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-[#374151]">Código de 6 dígitos</span>
              <input
                ref={codigoRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={codigo}
                onChange={(e) => handleCodigoChange(e.target.value)}
                placeholder="000000"
                className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-center
                  text-2xl font-black tracking-[0.3em] text-[#111111]
                  focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
                style={{ minHeight: 44 }}
              />
            </label>
            <Button onClick={() => handleValidarCodigo(codigo)} disabled={validandoCodigo || codigo.length !== 6} fullWidth>
              {validandoCodigo ? 'Validando...' : 'Validar código'}
            </Button>
          </div>
        )}

        {resultado && (
          <p className={`mt-3 rounded-lg border p-3 text-sm ${resultado.type === 'ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>
            {resultado.text}
          </p>
        )}
      </Card>
        </div>
        <div className="min-w-0">
      {/* Quién está dentro: resumen (la lista completa vive en su pantalla propia) */}
      <Card>
        <SectionTitle>Quién está dentro{totalDentro > 0 ? ` (${totalDentro})` : ''}</SectionTitle>
        {loadingDentro ? (
          <p className="text-sm text-[#6B7280]">Cargando...</p>
        ) : dentro.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No hay nadie registrado dentro en este momento.</p>
        ) : (
          <div className="space-y-2">
            {dentro.map((s) => {
              const nombre = `${s.usuario.nombre} ${s.usuario.apellido}`;
              const ocupado = egresandoId === s.usuario.id;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] p-3"
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
                    onClick={() => handleEgresoDirecto(s.usuario.id, nombre)}
                    disabled={ocupado}
                  >
                    {ocupado ? 'Registrando...' : 'Registrar egreso'}
                  </Button>
                </div>
              );
            })}
            {totalDentro > dentro.length && (
              <p className="text-xs text-[#6B7280]">+ {totalDentro - dentro.length} más adentro</p>
            )}
            <Button variant="ghost" fullWidth onClick={() => navigate('/admin/acceso/dentro')}>
              Ver lista completa
            </Button>
          </div>
        )}
        {egresoMsg && (
          <p className={`mt-3 rounded-lg border p-3 text-sm ${egresoMsg.type === 'ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>
            {egresoMsg.text}
          </p>
        )}
      </Card>
        </div>
      </div>
    </div>
  );
}
