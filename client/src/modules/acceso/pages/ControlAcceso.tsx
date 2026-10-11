import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { accesoApi } from '../acceso.api';
import type { SesionAbierta } from '../acceso.types';
import { sedesApi } from '../../sedes/sedes.api';
import { LectorQr } from '../components/LectorQr';
import { Donut } from '../../../shared/components/atoms';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { TipoActor } from '../../../shared/types/enums';
import { useTitulo } from '../../../shared/hooks/useTitulo';

type Modo = 'camara' | 'manual' | 'codigo';

export function ControlAcceso() {
  useTitulo('Control de acceso');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sedeId = user?.sedeId ?? null;
  // Escanear/validar y registrar egresos: solo el Recepcionista. El Gerente de Sede
  // ve únicamente el aforo y quién está dentro (el backend lo exige igual).
  const puedeOperar = user?.tipoActor === TipoActor.RECEPCIONISTA;

  // ?modo= permite llegar directo a la cámara o al código desde el panel.
  const modoInicial = searchParams.get('modo');
  const [tab, setTab] = useState<Modo>(modoInicial === 'camara' || modoInicial === 'manual' ? modoInicial : 'codigo');
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

  // Recepcionista y Gerente de Sede necesitan sede asignada para operar; el
  // GG tiene sedeId null por diseño ("todas las sedes") y no debe bloquearse.
  if (!sedeId && user?.tipoActor !== TipoActor.GERENTE_GENERAL) {
    return (
      <EmptyState
        icon={Building2}
        title="Todavía no tenés una sede asignada"
        description="Contactá a un gerente para que te asigne una sede y poder validar ingresos."
      />
    );
  }

  const pct = aforo && aforo.maximo > 0 ? Math.min(100, Math.round((aforo.actual / aforo.maximo) * 100)) : 0;

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Control de acceso</h2>
          <p>
            {puedeOperar
              ? sedeNombre
                ? `Validá ingresos por QR o código y registrá egresos de ${sedeNombre}.`
                : 'Validá ingresos por QR o código y registrá egresos de tu sede.'
              : sedeNombre
                ? `Aforo y personas dentro de ${sedeNombre}.`
                : 'Aforo y personas dentro de tu sede.'}
          </p>
        </div>
      </div>

      <div className="ops-grid" style={puedeOperar ? undefined : { gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {puedeOperar && (
        <div className="stack-gap" style={{ minWidth: 0 }}>
          {/* Validar ingreso */}
          <section className="glass panel" aria-label="Validar ingreso">
            <SectionHeader title="Validar ingreso" />
            <div className="segmented" role="tablist" aria-label="Modo de validación">
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
                  role="tab"
                  aria-selected={tab === t.id}
                  className={tab === t.id ? 'active' : ''}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'camara' && (
              <div className="stack-gap">
                <LectorQr key={escanKey} onDetectado={(token) => void handleValidar(token)} />
                {resultado && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setResultado(null);
                      setEscanKey((k) => k + 1);
                    }}
                  >
                    Escanear otro código
                  </button>
                )}
              </div>
            )}

            {tab === 'manual' && (
              <div className="stack-gap">
                <label className="auth-field">
                  <span className="field-label">TOKEN QR DEL SOCIO</span>
                  <input
                    type="text"
                    className="field-input"
                    value={qrToken}
                    onChange={(e) => setQrToken(e.target.value)}
                    placeholder="Pegá el qrToken aquí"
                    style={{ minHeight: 44 }}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleValidar(qrToken)}
                  disabled={validando}
                >
                  {validando ? 'Validando...' : 'Validar ingreso'}
                </button>
                <p style={{ fontSize: 11 }}>Escaneá o pegá el código QR que te muestra el socio en su celular.</p>
              </div>
            )}

            {tab === 'codigo' && (
              <div className="stack-gap">
                <label className="auth-field">
                  <span className="field-label">CÓDIGO DE 6 DÍGITOS</span>
                  <input
                    ref={codigoRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="field-input code-input"
                    value={codigo}
                    onChange={(e) => handleCodigoChange(e.target.value)}
                    placeholder="000000"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleValidarCodigo(codigo)}
                  disabled={validandoCodigo || codigo.length !== 6}
                >
                  {validandoCodigo ? 'Validando...' : 'Validar código'}
                </button>
              </div>
            )}

            {resultado && (
              <p role="status" className={`notice ${resultado.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginTop: 14 }}>
                {resultado.text}
              </p>
            )}
          </section>
        </div>
        )}

        <div className="stack-gap" style={{ minWidth: 0 }}>
          {/* Aforo */}
          <section className="glass panel" aria-label="Aforo actual">
            <SectionHeader
              title="Aforo actual"
              action={
                <button className="btn btn-ghost" onClick={() => { setLoadingAforo(true); void cargarAforo(); }}>
                  Actualizar
                </button>
              }
            />
            {loadingAforo ? (
              <LoadingState rows={1} label="Cargando aforo" />
            ) : aforo ? (
              <>
                <Donut value={pct} label="ocupado" />
                <p style={{ textAlign: 'center', fontSize: 12 }}>
                  {aforo.actual} de {aforo.maximo} personas
                </p>
              </>
            ) : (
              <p style={{ fontSize: 12 }}>No se pudo cargar el aforo.</p>
            )}
          </section>

          {/* Quién está dentro: resumen (la lista completa vive en su pantalla propia) */}
          <section className="glass panel" aria-label="Quién está dentro">
            <SectionHeader title={`Quién está dentro${totalDentro > 0 ? ` (${totalDentro})` : ''}`} />
            {loadingDentro ? (
              <LoadingState rows={2} label="Cargando" />
            ) : dentro.length === 0 ? (
              <p style={{ fontSize: 12 }}>No hay nadie registrado dentro en este momento.</p>
            ) : (
              <div className="stack-list">
                {dentro.map((s) => {
                  const nombre = `${s.usuario.nombre} ${s.usuario.apellido}`;
                  const ocupado = egresandoId === s.usuario.id;
                  return (
                    <div className="list-row" key={s.id}>
                      <div className="row-main">
                        <strong>{nombre}</strong>
                        <span>
                          Ingresó {s.horaIngreso.slice(0, 5)} · {haceCuanto(s.horaIngreso)}
                        </span>
                      </div>
                      {puedeOperar && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => void handleEgresoDirecto(s.usuario.id, nombre)}
                          disabled={ocupado}
                        >
                          {ocupado ? 'Registrando...' : 'Egreso'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {totalDentro > dentro.length && (
              <p style={{ fontSize: 11, marginTop: 8 }}>+ {totalDentro - dentro.length} más adentro</p>
            )}
            {dentro.length > 0 && (
              <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => navigate('/admin/acceso/dentro')}>
                Ver lista completa
              </button>
            )}
            {egresoMsg && (
              <p role="status" className={`notice ${egresoMsg.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginTop: 12 }}>
                {egresoMsg.text}
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
