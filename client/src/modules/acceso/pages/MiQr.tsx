import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RotateCw } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { accesoApi } from '../acceso.api';
import { membresiasApi } from '../../membresias/membresias.api';
import type { Membresia } from '../../membresias/membresias.types';
import { Button } from '../../../shared/components/ui';

const RADIO = 90;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

export function MiQr() {
  const { user } = useAuth();
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(60);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState(false);
  const [membresia, setMembresia] = useState<Membresia | null>(null);

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

  const dashOffset = CIRCUNFERENCIA * (1 - seconds / 60);
  const urgente = seconds <= 10;
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
    <div className="max-w-sm lg:max-w-md mx-auto px-4 sm:px-6 py-8 lg:py-12 flex flex-col items-center">
      <h2 className="text-2xl font-black tracking-tight text-gray-900 mb-1">Mi QR de ingreso</h2>
      <p className="text-sm text-gray-400 text-center mb-10">Mostráselo al recepcionista en la entrada</p>

      {error ? (
        <div className="py-10 text-center">
          <p className="text-sm text-[#DC2626] mb-4">No se pudo generar el código.</p>
          <Button onClick={generar}>
            <RotateCw size={16} /> Reintentar
          </Button>
        </div>
      ) : (
        <>
          <div className="relative flex items-center justify-center mb-6">
            <svg width="220" height="220" className="absolute">
              <circle cx="110" cy="110" r={RADIO} fill="none" stroke="#F3EAFF" strokeWidth="7" />
              <circle
                cx="110" cy="110" r={RADIO} fill="none"
                stroke={urgente ? '#EF4444' : '#8B2EFF'} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={CIRCUNFERENCIA} strokeDashoffset={dashOffset}
                transform="rotate(-90 110 110)"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>

            <div
              className={`w-44 h-44 bg-white rounded-3xl flex items-center justify-center shadow-xl border-2 transition-colors ${urgente ? 'border-red-200' : 'border-[#8B2EFF]/10'}`}
              style={expired ? { filter: 'grayscale(1) opacity(0.3)' } : undefined}
            >
              {qrToken && <QRCodeSVG value={qrToken} size={152} />}
            </div>

            <div className="absolute -bottom-4">
              <div className={`text-white text-xs font-black px-4 py-1.5 rounded-full shadow transition-colors ${urgente ? 'bg-red-500' : 'bg-[#8B2EFF]'}`}>
                {urgente ? `⚠ ${seconds}s` : `${seconds}s`}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-8">El código se renueva automáticamente</p>

          {expired && (
            <div className="text-center space-y-3 mb-8">
              <p className="text-sm font-semibold text-[#DC2626]">Código expirado</p>
              <Button onClick={generar}>
                <RotateCw size={16} /> Generar nuevo
              </Button>
            </div>
          )}
        </>
      )}

      {membresia && (
        <div className="w-full bg-white rounded-[1.75rem] border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-black text-gray-900">Estado de membresía</p>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              ● {membresia.estado === 'ACTIVO' ? 'Activo' : membresia.estado}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Plan</span>
              <span className="font-bold text-gray-900">{membresia.plan}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Válido hasta</span>
              <span className="font-bold text-gray-900">
                {new Date(`${membresia.fechaFin}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Días restantes</span>
              <span className="font-bold text-[#8B2EFF]">{diasRestantes} días</span>
            </div>
          </div>
          <p className="text-xs text-gray-300 mt-4 pt-4 border-t border-gray-50">Si el acceso falla, verificá que tu membresía esté al día.</p>
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}
