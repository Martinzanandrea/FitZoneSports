import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Clock3, RotateCw } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { accesoApi } from '../acceso.api';
import { membresiasApi } from '../../membresias/membresias.api';
import type { EstadoSocio } from '../../membresias/membresias.types';
import { TarjetaProxima } from '../../membresias/components/TarjetaProxima';
import { Badge } from '../../../shared/components/atoms';
import { useTitulo } from '../../../shared/hooks/useTitulo';
import {
  diasRestantes,
  fechaValidaHasta,
  formatearDDMMAAAA,
} from '../../../shared/utils/fechasMembresia';

function tonoMembresia(estado: EstadoSocio['estado']): 'success' | 'warning' | 'danger' {
  return estado === 'ACTIVO' ? 'success' : estado === 'SUSPENDIDO' ? 'warning' : 'danger';
}

function etiquetaMembresia(estado: EstadoSocio['estado']): string {
  return estado === 'ACTIVO' ? 'Activo' : estado === 'SUSPENDIDO' ? 'Suspendido' : 'Vencido';
}

function motivoSinVigente(membresia: EstadoSocio | null): { titulo: string; detalle: string } {
  if (!membresia) {
    return {
      titulo: 'No tenés una membresía vigente',
      detalle: 'Contratá un plan para obtener tu código de ingreso.',
    };
  }
  if (membresia.proxima) {
    return {
      titulo: 'Tenés una membresía programada',
      detalle: `Comienza el ${formatearDDMMAAAA(membresia.proxima.fechaInicio)}.`,
    };
  }
  if (membresia.estado === 'SUSPENDIDO') {
    return {
      titulo: 'Tu membresía está suspendida',
      detalle: 'Acercate a tu sede para regularizar el estado.',
    };
  }
  return {
    titulo: 'Tu membresía venció',
    detalle: `El último día de validez fue el ${formatearDDMMAAAA(fechaValidaHasta(membresia.fechaFin))}.`,
  };
}

function formatearSegundos(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.max(0, total % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MiQr() {
  useTitulo('Mi QR de ingreso');
  const { user } = useAuth();
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [codigoCorto, setCodigoCorto] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(60);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState(false);
  const [membresia, setMembresia] = useState<EstadoSocio | null>(null);
  const [cargandoMembresia, setCargandoMembresia] = useState(true);

  const vigente =
    !!membresia && membresia.estado === 'ACTIVO' && diasRestantes(membresia.fechaFin) > 0;

  const generar = useCallback(async () => {
    if (!user) return;
    try {
      const { qrToken, codigoCorto, expiraEn } = await accesoApi.generarQr(user.id);
      setQrToken(qrToken);
      setCodigoCorto(codigoCorto ?? null);
      setSeconds(expiraEn);
      setExpired(false);
      setError(false);
    } catch {
      setError(true);
    }
  }, [user]);

  useEffect(() => {
    if (!vigente) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void generar();
  }, [generar, vigente]);

  useEffect(() => {
    if (!user) return;
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargandoMembresia(true);
    membresiasApi
      .getVigente(user.id)
      .then((m) => viva && setMembresia(m))
      .catch(() => viva && setMembresia(null))
      .finally(() => viva && setCargandoMembresia(false));
    return () => {
      viva = false;
    };
  }, [user]);

  useEffect(() => {
    if (expired || !qrToken) return;
    if (seconds <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpired(true);
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, expired, qrToken]);

  const urgente = seconds <= 10 && !expired;
  const dias = membresia ? Math.max(0, diasRestantes(membresia.fechaFin)) : null;
  const motivo = vigente ? null : motivoSinVigente(membresia);

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Mi QR de ingreso</h2>
          <p>Mostráselo al recepcionista en la entrada.</p>
        </div>
      </div>

      <section className="qr-screen" aria-label="Código QR de ingreso">
        <span className="eyebrow">CÓDIGO DE ACCESO</span>
        {cargandoMembresia ? (
          <div style={{ padding: '28px 0 8px' }}>
            <p style={{ fontSize: 12 }}>Cargando tu membresía…</p>
          </div>
        ) : vigente ? (
          <>
            <h2>Acercá tu QR al lector</h2>
            <p>Se actualiza automáticamente para proteger tu cuenta.</p>
            {error ? (
              <div style={{ padding: '28px 0 8px' }}>
                <p style={{ fontSize: 12, marginBottom: 16 }}>No se pudo generar el código.</p>
                <button className="btn btn-secondary" onClick={() => void generar()}>
                  <RotateCw size={17} aria-hidden /> Volver a intentar
                </button>
              </div>
            ) : (
              <>
                <div className={`qr-real${expired ? ' expired' : ''}`} role="img" aria-label={expired ? 'Código QR expirado' : 'Código QR de ingreso'}>
                  {qrToken && <QRCodeSVG value={qrToken} size={232} />}
                </div>

                {codigoCorto && (
                  <div className="short-code" style={expired ? { filter: 'grayscale(1)', opacity: 0.4 } : undefined}>
                    <span>CÓDIGO ALTERNATIVO</span>
                    <strong>
                      {codigoCorto.slice(0, 3)} {codigoCorto.slice(3)}
                    </strong>
                  </div>
                )}

                {expired ? (
                  <div style={{ marginTop: 22 }}>
                    <p style={{ fontSize: 12, marginBottom: 14 }}>Código expirado.</p>
                    <button className="btn btn-primary" onClick={() => void generar()}>
                      <RotateCw size={17} aria-hidden /> Generar nuevo
                    </button>
                  </div>
                ) : (
                  <div className="countdown" aria-live="off">
                    <Clock3 size={17} aria-hidden />
                    <span>Nuevo código en</span>
                    <strong style={urgente ? { color: 'var(--coral)' } : undefined}>
                      {formatearSegundos(seconds)}
                    </strong>
                    <i aria-hidden>
                      <b style={{ width: `${(seconds / 60) * 100}%`, background: urgente ? 'var(--coral)' : undefined }} />
                    </i>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div style={{ padding: '28px 0 8px' }}>
            <h2>{motivo?.titulo ?? 'No podés generar el código'}</h2>
            <p>{motivo?.detalle}</p>
            {membresia?.proxima ? (
              <p style={{ fontSize: 12, marginTop: 16 }}>
                Podés renovar cuando comience tu próxima membresía.
              </p>
            ) : (
              <Link className="btn btn-primary" style={{ marginTop: 16 }} to="/completar-membresia">
                Contratar o renovar membresía
              </Link>
            )}
          </div>
        )}
      </section>

      {membresia && (
        <section className="glass panel" style={{ maxWidth: 520, margin: '14px auto 0' }} aria-label="Estado de membresía">
          <div className="stack-list">
            <div className="list-row">
              <div className="row-main">
                <strong>Plan {membresia.plan}</strong>
                <span>
                  Válida hasta {formatearDDMMAAAA(fechaValidaHasta(membresia.fechaFin))}
                  {dias !== null && ` · ${dias} días restantes`} · {membresia.sedeAlta.nombre}
                </span>
              </div>
              <Badge variant={tonoMembresia(membresia.estado)}>{etiquetaMembresia(membresia.estado)}</Badge>
            </div>
          </div>
          <p style={{ fontSize: 10, marginTop: 12 }}>Si el acceso falla, verificá que tu membresía esté al día.</p>
        </section>
      )}

      {membresia?.proxima && (
        <div style={{ maxWidth: 520, margin: '14px auto 0' }}>
          <TarjetaProxima proxima={membresia.proxima} />
        </div>
      )}
    </>
  );
}
