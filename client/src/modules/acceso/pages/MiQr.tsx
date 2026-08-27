import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RotateCw } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { accesoApi } from '../acceso.api';
import { Button } from '../../../shared/components/ui';

const CIRCUMFERENCE = 2 * Math.PI * 44;

export function MiQr() {
  const { user } = useAuth();
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(60);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState(false);

  const generar = useCallback(async () => {
    if (!user) return;
    try {
      const { qrToken, expiraEn } = await accesoApi.generarQr(user.id);
      setQrToken(qrToken);
      setSeconds(expiraEn);
      setExpired(false);
      setError(false);
    } catch {
      setError(true);
    }
  }, [user]);

  useEffect(() => {
    generar();
  }, [generar]);

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

  const progress = seconds / 60;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const ringColor = seconds > 20 ? '#8B2EFF' : seconds > 10 ? '#F59E0B' : '#DC2626';
  const iniciales = user ? `${user.nombre[0]}${user.apellido[0]}` : '';

  return (
    <div className="max-w-sm mx-auto px-4 py-8 flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-[#111111]">Mi código QR</h1>
        <p className="text-sm mt-1 text-[#6B7280]">Presentá este código en recepción para ingresar</p>
      </div>

      <div className="rounded-3xl p-6 flex flex-col items-center gap-5 w-full bg-white border border-[#E5E7EB]">
        {error ? (
          <div className="py-10 text-center">
            <p className="text-sm text-[#DC2626] mb-4">No se pudo generar el código.</p>
            <Button onClick={generar}>
              <RotateCw size={16} /> Reintentar
            </Button>
          </div>
        ) : (
          <>
            <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
              <svg width="240" height="240" viewBox="0 0 100 100" className="absolute top-0 left-0">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                <circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                />
              </svg>

              <div
                className="relative flex flex-col items-center justify-center rounded-2xl overflow-hidden bg-white"
                style={{ width: 212, height: 212, filter: expired ? 'grayscale(1) opacity(0.3)' : 'none', transition: 'filter 0.4s' }}
              >
                {qrToken && <QRCodeSVG value={qrToken} size={180} />}
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center h-7 bg-black/85">
                  <span className="text-xs font-bold tracking-widest text-white">{iniciales}</span>
                </div>
              </div>

              <div
                className="absolute bottom-0 flex items-center justify-center rounded-full font-bold text-sm w-9 h-9 bg-white"
                style={{ border: `2px solid ${ringColor}`, color: ringColor, transition: 'color 0.3s, border-color 0.3s' }}
              >
                {seconds}
              </div>
            </div>

            {expired ? (
              <div className="text-center space-y-3">
                <p className="text-sm font-semibold text-[#DC2626]">Código expirado</p>
                <Button onClick={generar}>
                  <RotateCw size={16} /> Generar nuevo
                </Button>
              </div>
            ) : (
              <p className="text-xs font-medium text-[#6B7280]">
                Expira en <span style={{ color: ringColor, fontWeight: 700 }}>{seconds}s</span>
              </p>
            )}
          </>
        )}
      </div>

      <div className="w-full rounded-xl p-4 flex items-center gap-3 bg-white border border-[#E5E7EB]">
        <div className="flex-shrink-0 flex items-center justify-center rounded-full font-bold text-sm text-white w-10 h-10 bg-[#8B2EFF]">
          {iniciales}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111111]">{user?.nombre} {user?.apellido}</p>
          <p className="text-xs text-[#6B7280]">{user?.tipoActor}</p>
        </div>
      </div>
    </div>
  );
}