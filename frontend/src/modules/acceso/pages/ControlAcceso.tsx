import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { accesoApi } from '../acceso.api';
import type { EstadoMembresiaVista, SesionAbierta, VistaPreviaSocio } from '../acceso.types';
import { sedesApi } from '../../sedes/sedes.api';
import { LectorQr } from '../components/LectorQr';
import { Donut } from '../../../shared/components/atoms';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { TipoActor } from '../../../shared/types/enums';
import { useAhora } from '../../../shared/hooks/useAhora';
import { useTitulo } from '../../../shared/hooks/useTitulo';
import { TEXTO_REQUIERE_CONEXION, useEstadoConexion } from '../../../shared/hooks/useEstadoConexion';
import { useModoOffline } from '../offline/useModoOffline';
import { validarIngresoOffline } from '../offline/colaIngresos';
import { leerSnapshot } from '../offline/almacenOffline';
import {
  TEXTO_EGRESO_REQUIERE_CONEXION,
  controlesSegunConexion,
  debeDescargarSnapshot,
  debeMostrarResumen,
  debePasarAOffline,
  estadoBanner,
  estadoModoCamara,
  rutaValidacionQr,
  textoRequiereConexion,
  textoResumenSync,
} from '../offline/decisionesPantalla';

// Cada cuánto se revisa si el snapshot de la sede necesita refrescarse (se baja si tiene más de 1 hora).
const REVISION_SNAPSHOT_MS = 5 * 60 * 1000;

type Modo = 'camara' | 'manual' | 'codigo' | 'dni';

const ESTADO_MEMBRESIA: Record<EstadoMembresiaVista, { texto: string; clase: string }> = {
  VIGENTE: { texto: 'Membresía vigente', clase: 'badge-success' },
  PROXIMA: { texto: 'Membresía próxima, aún no comenzó', clase: 'badge-warning' },
  SUSPENDIDA: { texto: 'Membresía suspendida', clase: 'badge-danger' },
  VENCIDA: { texto: 'Membresía vencida', clase: 'badge-danger' },
  SIN_MEMBRESIA: { texto: 'Sin membresía', clase: 'badge-neutral' },
};

// Mensaje que devuelve el servidor, o uno genérico si no llegó respuesta.
function mensajeDeError(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

// Resultado de la última sincronización de ingresos hechos sin conexión.
function ResumenSincronizacion({ resumen, onCerrar }: { resumen: Parameters<typeof textoResumenSync>[0]; onCerrar: () => void }) {
  const t = textoResumenSync(resumen);
  const clase = t.tono === 'error' ? 'notice-err' : t.tono === 'ok' ? 'notice-ok' : '';
  return (
    <section role="status" aria-label="Resultado de la sincronización" className={`notice ${clase}`} style={{ marginBottom: 14 }}>
      <strong>{t.titulo}</strong>
      <p style={{ marginTop: 4 }}>{t.conteos}</p>
      {t.interrupcion && <p style={{ marginTop: 4 }}>{t.interrupcion}</p>}
      {t.fallidos && <p style={{ marginTop: 4 }}>{t.fallidos}</p>}
      {t.detalle.length > 0 && (
        <ul style={{ marginTop: 6, paddingLeft: 18 }}>
          {t.detalle.map((d) => (
            <li key={d.clientEventId}>{d.texto}</li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-ghost" style={{ marginTop: 6 }} onClick={onCerrar}>
        Cerrar
      </button>
    </section>
  );
}

export function ControlAcceso() {
  useTitulo('Control de acceso');
  const { user } = useAuth();
  const navigate = useNavigate();
  const online = useEstadoConexion();
  const [searchParams] = useSearchParams();
  const sedeId = user?.sedeId ?? null;
  const offline = useModoOffline(sedeId);
  // Escanear/validar y registrar egresos: solo el Recepcionista. El Gerente de Sede
  // ve únicamente el aforo y quién está dentro (el backend lo exige igual).
  const puedeOperar = user?.tipoActor === TipoActor.RECEPCIONISTA;
  const controles = controlesSegunConexion(!online);
  const banner = estadoBanner({ sinConexion: !online, snapshotVigente: offline.snapshotVigente, pendientes: offline.pendientes });
  // Ingresos registrados sin conexión en esta sesión de la pantalla, con su insignia.
  const [ingresosOffline, setIngresosOffline] = useState<Array<{ id: string; nombre: string; hora: string }>>([]);
  const [resumenOcultoFecha, setResumenOcultoFecha] = useState<string | null>(null);

  // ?modo= permite llegar directo a la cámara o al código desde el panel.
  const modoInicial = searchParams.get('modo');
  const [tab, setTab] = useState<Modo>(modoInicial === 'camara' || modoInicial === 'manual' ? modoInicial : 'codigo');
  const [qrToken, setQrToken] = useState('');
  const [validando, setValidando] = useState(false);
  // offline: el resultado salió de la validación local (sin conexión), no del servidor.
  const [resultado, setResultado] = useState<{ type: 'ok' | 'err'; text: string; offline?: boolean } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [validandoCodigo, setValidandoCodigo] = useState(false);
  const codigoRef = useRef<HTMLInputElement>(null);
  const [dni, setDni] = useState('');
  const [buscandoDni, setBuscandoDni] = useState(false);
  const [confirmandoDni, setConfirmandoDni] = useState(false);
  const [socioDni, setSocioDni] = useState<VistaPreviaSocio | null>(null);

  useEffect(() => {
    if (tab === 'codigo') codigoRef.current?.focus();
  }, [tab]);

  // Con conexión: baja el snapshot de la sede si no hay uno o tiene más de 1 hora, y lo revisa cada tanto.
  const descargarSnapshot = offline.descargarSnapshot;
  useEffect(() => {
    if (!puedeOperar || !sedeId || !online) return;
    const sede = sedeId;
    async function asegurarSnapshot() {
      try {
        const guardado = await leerSnapshot(sede);
        if (debeDescargarSnapshot(guardado?.generadoEn ?? null, Date.now())) await descargarSnapshot();
      } catch {
        /* sin snapshot nuevo: el banner informa si el que hay está vencido */
      }
    }
    void asegurarSnapshot();
    const id = setInterval(() => void asegurarSnapshot(), REVISION_SNAPSHOT_MS);
    return () => clearInterval(id);
  }, [puedeOperar, sedeId, online, descargarSnapshot]);

  // Al cambiar la conexión se relee el estado local (snapshot vigente, pendientes, resumen).
  const refrescarOffline = offline.refrescar;
  useEffect(() => {
    void Promise.resolve().then(refrescarOffline);
  }, [online, refrescarOffline]);

  const [aforo, setAforo] = useState<{ actual: number; maximo: number } | null>(null);
  const [loadingAforo, setLoadingAforo] = useState(true);
  const [sedeNombre, setSedeNombre] = useState('');

  const [dentro, setDentro] = useState<SesionAbierta[]>([]);
  const [totalDentro, setTotalDentro] = useState(0);
  const [loadingDentro, setLoadingDentro] = useState(true);
  const [egresandoId, setEgresandoId] = useState<string | null>(null);
  const [egresoMsg, setEgresoMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const ahora = useAhora();

  // Tiempo transcurrido desde el ingreso ("hace 45 min", "hace 2 h 15 min").
  function haceCuanto(horaIngreso: string): string {
    const mins = Math.max(0, Math.round((ahora - new Date(horaIngreso).getTime()) / 60000));
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
    // Sin conexión: validación local con el snapshot descargado.
    if (rutaValidacionQr(navigator.onLine) === 'OFFLINE') {
      try {
        await validarSinConexion(sedeId, token.trim());
      } finally {
        setValidando(false);
      }
      return;
    }
    try {
      const data = await accesoApi.validarIngreso({ qrToken: token.trim(), sedeId });
      // backend devuelve ControlAcceso con usuario y sede poblados
      const nombre = data?.usuario ? `${data.usuario.nombre} ${data.usuario.apellido}` : 'Socio';
      setResultado({ type: 'ok', text: `Ingreso validado: ${nombre}` });
      setQrToken('');
      void cargarAforo();
      void cargarDentro();
    } catch (e: unknown) {
      // Sin respuesta del servidor (red, timeout) o servidor caído: se valida localmente.
      // Un 4xx es un rechazo real del servidor y se muestra como tal.
      if (debePasarAOffline(e, navigator.onLine)) {
        await validarSinConexion(sedeId, token.trim());
      } else {
        const ax = e as { response?: { data?: { message?: string | string[] } } };
        const raw = ax.response?.data?.message;
        const msg = Array.isArray(raw) ? raw.join(', ') : raw ?? 'No se pudo validar el ingreso.';
        setResultado({ type: 'err', text: msg });
      }
    } finally {
      setValidando(false);
    }
  }

  // Valida el QR contra el snapshot local; si corresponde, lo encola para sincronizarlo después.
  async function validarSinConexion(sede: string, token: string) {
    const r = await validarIngresoOffline(sede, token);
    // Primero se relee la cola (pendientes) y recién después se agrega a la lista de la pantalla.
    await offline.refrescar();
    if (r.permitido) {
      setResultado({ type: 'ok', text: r.mensaje, offline: true });
      setIngresosOffline((prev) => [
        { id: crypto.randomUUID(), nombre: `${r.nombre} ${r.apellido}`.trim(), hora: new Date().toISOString() },
        ...prev,
      ]);
      setQrToken('');
    } else {
      setResultado({ type: 'err', text: r.mensaje, offline: true });
    }
  }

  // Remontar el lector (nuevo key) lo reinicia para otro escaneo.
  const [escanKey, setEscanKey] = useState(0);
  // true cuando el escaneo con cámara ya devolvió un resultado: se quita el lector y su leyenda.
  const [escaneoTerminado, setEscaneoTerminado] = useState(false);
  const camara = estadoModoCamara(escaneoTerminado);

  async function handleValidarCodigo(valor: string) {
    if (!sedeId) {
      setResultado({ type: 'err', text: 'No tenés sede asignada.' });
      return;
    }
    if (!/^\d{6}$/.test(valor)) {
      setResultado({ type: 'err', text: 'Ingresá los 6 dígitos del código.' });
      return;
    }
    if (!navigator.onLine) {
      setResultado({ type: 'err', text: `Sin conexión a internet. ${TEXTO_REQUIERE_CONEXION}` });
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

  function handleDniChange(valor: string) {
    setDni(valor.replace(/\D/g, '').slice(0, 9));
    // Cambiar el DNI invalida la tarjeta de confirmación anterior.
    setSocioDni(null);
    setResultado(null);
  }

  async function handleBuscarDni() {
    if (!sedeId) {
      setResultado({ type: 'err', text: 'No tenés sede asignada.' });
      return;
    }
    if (!/^\d{6,9}$/.test(dni)) {
      setResultado({ type: 'err', text: 'Ingresá un DNI de 6 a 9 dígitos.' });
      return;
    }
    if (!navigator.onLine) {
      setResultado({ type: 'err', text: `Sin conexión a internet. ${TEXTO_REQUIERE_CONEXION}` });
      return;
    }
    setBuscandoDni(true);
    setResultado(null);
    setSocioDni(null);
    try {
      setSocioDni(await accesoApi.buscarDni({ dni, sedeId }));
    } catch (e: unknown) {
      setResultado({ type: 'err', text: mensajeDeError(e, 'No se pudo buscar al socio.') });
    } finally {
      setBuscandoDni(false);
    }
  }

  async function handleConfirmarDni() {
    if (!sedeId || !socioDni) return;
    if (!navigator.onLine) {
      setResultado({ type: 'err', text: `Sin conexión a internet. ${TEXTO_REQUIERE_CONEXION}` });
      return;
    }
    setConfirmandoDni(true);
    setResultado(null);
    try {
      await accesoApi.validarDni({ dni, sedeId });
      setResultado({ type: 'ok', text: `Ingreso validado: ${socioDni.nombre} ${socioDni.apellido}` });
      setDni('');
      setSocioDni(null);
      void cargarAforo();
      void cargarDentro();
    } catch (e: unknown) {
      setResultado({ type: 'err', text: mensajeDeError(e, 'No se pudo validar el ingreso.') });
    } finally {
      setConfirmandoDni(false);
    }
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

      {puedeOperar && banner.visible && (
        <section
          role="status"
          aria-label="Estado de la conexión"
          className={`notice ${banner.tono === 'error' ? 'notice-err' : ''}`}
          style={{ marginBottom: 14 }}
        >
          <strong>{banner.titulo}</strong>
          {banner.lineas.map((linea) => (
            <p key={linea} style={{ marginTop: 4 }}>
              {linea}
            </p>
          ))}
          {offline.pendientes > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 8 }}
              onClick={() => void offline.sincronizar()}
              disabled={!online || offline.sincronizando}
            >
              {offline.sincronizando ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>
          )}
        </section>
      )}

      {puedeOperar && debeMostrarResumen(offline.resumenUltimaSync, !online, resumenOcultoFecha) && offline.resumenUltimaSync && (
        <ResumenSincronizacion
          resumen={offline.resumenUltimaSync}
          onCerrar={() => setResumenOcultoFecha(offline.resumenUltimaSync?.fecha ?? null)}
        />
      )}

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
                  { id: 'dni', label: 'DNI' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={tab === t.id ? 'active' : ''}
                  onClick={() => {
                    setTab(t.id);
                    setEscaneoTerminado(false);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {textoRequiereConexion(tab, !online) && (
              <p role="status" style={{ fontSize: 11, marginTop: 10 }}>
                {textoRequiereConexion(tab, !online)}
              </p>
            )}

            {tab === 'camara' && (
              <div className="stack-gap">
                {camara.mostrarLector && (
                  <LectorQr
                    key={escanKey}
                    onDetectado={(token) => void handleValidar(token).finally(() => setEscaneoTerminado(true))}
                  />
                )}
                {camara.mostrarEscanearOtro && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setResultado(null);
                      setEscaneoTerminado(false);
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
                    disabled={controles.codigoDeshabilitado}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleValidarCodigo(codigo)}
                  disabled={validandoCodigo || controles.codigoDeshabilitado || codigo.length !== 6}
                >
                  {validandoCodigo ? 'Validando...' : 'Validar código'}
                </button>
              </div>
            )}

            {tab === 'dni' && (
              <div className="stack-gap">
                <label className="auth-field">
                  <span className="field-label">DNI DEL SOCIO</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={9}
                    className="field-input"
                    value={dni}
                    onChange={(e) => handleDniChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !buscandoDni && online && dni) void handleBuscarDni();
                    }}
                    placeholder="Sin puntos"
                    style={{ minHeight: 44 }}
                    disabled={controles.dniDeshabilitado}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void handleBuscarDni()}
                  disabled={buscandoDni || controles.dniDeshabilitado || dni.length < 6}
                >
                  {buscandoDni ? 'Buscando...' : 'Buscar'}
                </button>
                <p style={{ fontSize: 11 }}>Usalo solo cuando el socio no puede mostrar su QR. Confirmá su identidad con la foto antes de registrar el ingreso.</p>

                {socioDni && (
                  <div className="profile-head" aria-label="Socio encontrado">
                    {socioDni.fotoUrl ? (
                      <span className="profile-photo">
                        <img src={socioDni.fotoUrl} alt={`Foto de ${socioDni.nombre} ${socioDni.apellido}`} />
                      </span>
                    ) : (
                      <span className="profile-photo" aria-hidden>
                        {`${socioDni.nombre[0] ?? ''}${socioDni.apellido[0] ?? ''}`.toUpperCase()}
                      </span>
                    )}
                    <div>
                      <h2>{`${socioDni.nombre} ${socioDni.apellido}`}</h2>
                      <span className={`badge ${ESTADO_MEMBRESIA[socioDni.estadoMembresia].clase}`}>
                        <i />
                        {ESTADO_MEMBRESIA[socioDni.estadoMembresia].texto}
                      </span>
                    </div>
                  </div>
                )}
                {socioDni && socioDni.estadoMembresia !== 'VIGENTE' && (
                  <p role="status" className="notice notice-err">
                    La membresía no está vigente: no se puede registrar el ingreso.
                  </p>
                )}
                {socioDni && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleConfirmarDni()}
                    disabled={confirmandoDni || controles.dniDeshabilitado || socioDni.estadoMembresia !== 'VIGENTE'}
                  >
                    {confirmandoDni ? 'Registrando...' : 'Confirmar ingreso'}
                  </button>
                )}
              </div>
            )}

            {resultado && (
              <p role="status" className={`notice ${resultado.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginTop: 14 }}>
                {resultado.text}
                {resultado.offline && (
                  <span className="badge badge-warning" style={{ marginLeft: 8 }}>
                    <i />
                    Sin conexión
                  </span>
                )}
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
            {ingresosOffline.length > 0 && (
              <div className="stack-list" aria-label="Ingresos registrados sin conexión">
                {ingresosOffline.map((i) => (
                  <div className="list-row" key={i.id}>
                    <div className="row-main">
                      <strong>{i.nombre}</strong>
                      <span>Ingresó {new Date(i.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · pendiente de sincronizar</span>
                    </div>
                    <span className="badge badge-warning">
                      <i />
                      Sin conexión
                    </span>
                  </div>
                ))}
              </div>
            )}
            {loadingDentro ? (
              <LoadingState rows={2} label="Cargando" />
            ) : dentro.length === 0 ? (
              ingresosOffline.length === 0 && <p style={{ fontSize: 12 }}>No hay nadie registrado dentro en este momento.</p>
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
                          disabled={ocupado || controles.egresoDeshabilitado}
                        >
                          {ocupado ? 'Registrando...' : 'Egreso'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {puedeOperar && controles.egresoDeshabilitado && dentro.length > 0 && (
              <p role="status" style={{ fontSize: 11, marginTop: 8 }}>
                {TEXTO_EGRESO_REQUIERE_CONEXION}
              </p>
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
