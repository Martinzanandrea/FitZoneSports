import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Clock3, RotateCw } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { accesoApi } from '../acceso.api';
import { membresiasApi } from '../../membresias/membresias.api';
import type { Membresia } from '../../membresias/membresias.types';
import { Badge } from '../../../shared/components/ui';
import { useTitulo } from '../../../shared/hooks/useTitulo';

function tonoMembresia(estado: Membresia['estado']): 'success' | 'warning' | 'danger' {
  return estado === 'ACTIVO' ? 'success' : estado === 'SUSPENDIDO' ? 'warning' : 'danger';
}

function etiquetaMembresia(estado: Membresia['estado']): string {
  return estado === 'ACTIVO' ? 'Activo' : estado === 'SUSPENDIDO' ? 'Suspendido' : 'Vencido';
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
  const [membresia, setMembresia] = useState<Membresia | null>(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    generar();
  }, [generar]);

  useEffect(() => {
    if (!user) return;
    membresiasApi.getVigente(user.id).then(setMembresia).catch(() => setMembresia(null));
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
  const diasRestantes = membresia
    ? Math.max(
        0,
        Math.ceil(
          (new Date(`${membresia.fechaFin}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : null;

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
      </section>

      {membresia && (
        <section className="glass panel" style={{ maxWidth: 520, margin: '14px auto 0' }} aria-label="Estado de membresía">
          <div className="stack-list">
            <div className="list-row">
              <div className="row-main">
                <strong>Plan {membresia.plan}</strong>
                <span>
                  Válido hasta{' '}
                  {new Date(`${membresia.fechaFin}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                  {diasRestantes !== null && ` · ${diasRestantes} días restantes`} · {membresia.sedeAlta.nombre}
                </span>
              </div>
              <Badge variant={tonoMembresia(membresia.estado)}>{etiquetaMembresia(membresia.estado)}</Badge>
            </div>
          </div>
          <p style={{ fontSize: 10, marginTop: 12 }}>Si el acceso falla, verificá que tu membresía esté al día.</p>
        </section>
      )}
    </>
  );
}
