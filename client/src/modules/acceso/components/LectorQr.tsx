import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '../../../shared/components/ui';

const ELEMENT_ID = 'lector-qr-visor';

type Estado = 'pidiendo' | 'escaneando' | 'detectado' | 'error';

// Envuelve Html5Qrcode: pide permiso al montarse, prefiere la cámara
// trasera en mobile y avisa una sola vez por QR detectado. Al
// desmontarse libera la cámara (si no, queda prendida).
export function LectorQr({ onDetectado }: { onDetectado: (token: string) => void }) {
  const [estado, setEstado] = useState<Estado>('pidiendo');
  const [mensajeError, setMensajeError] = useState('');
  const [intento, setIntento] = useState(0);
  // Ref para no capturar un callback viejo si el padre re-renderiza
  // mientras la cámara sigue abierta.
  const onDetectadoRef = useRef(onDetectado);
  onDetectadoRef.current = onDetectado;

  useEffect(() => {
    let cancelado = false;
    let instancia: Html5Qrcode | null = null;

    async function iniciar() {
      try {
        const camaras = await Html5Qrcode.getCameras();
        if (cancelado) return;
        if (camaras.length === 0) {
          setMensajeError('No se encontró ninguna cámara en este dispositivo. Probá con Código o Pegado.');
          setEstado('error');
          return;
        }
        instancia = new Html5Qrcode(ELEMENT_ID, false);
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        };
        const alDetectar = (texto: string) => {
          if (cancelado) return;
          setEstado('detectado');
          // Se frena acá: el padre valida y, si hace falta otro intento,
          // desmonta y vuelve a montar este componente.
          void instancia?.stop().catch(() => undefined);
          onDetectadoRef.current(texto);
        };
        try {
          await instancia.start({ facingMode: 'environment' }, config, alDetectar, undefined);
        } catch {
          // Sin cámara trasera (desktop): reintentar con la primera disponible.
          await instancia.start(camaras[0].id, config, alDetectar, undefined);
        }
        if (cancelado) {
          await instancia.stop().catch(() => undefined);
          return;
        }
        setEstado('escaneando');
      } catch (e: unknown) {
        if (cancelado) return;
        const msg = e instanceof Error ? e.message : '';
        setMensajeError(
          /permission|permiso|denied|denegado|NotAllowed/i.test(msg)
            ? 'Permiso de cámara denegado. Habilitá el acceso en el navegador o usá Código o Pegado.'
            : 'No se pudo iniciar la cámara. Probá con Código o Pegado.',
        );
        setEstado('error');
      }
    }

    void iniciar();

    return () => {
      cancelado = true;
      if (instancia) {
        void instancia.stop().then(() => instancia?.clear()).catch(() => undefined);
      }
    };
    // El reintento manual se dispara con `intento`; el callback llega por ref.
  }, [intento]);

  if (estado === 'error') {
    return (
      <div className="text-center py-6 space-y-3">
        <Camera size={28} className="mx-auto text-[#9CA3AF]" />
        <p className="text-sm text-[#DC2626]">{mensajeError}</p>
        <Button variant="outline" onClick={() => { setEstado('pidiendo'); setIntento((i) => i + 1); }}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        id={ELEMENT_ID}
        className="w-full overflow-hidden rounded-2xl border border-[#E5E7EB] bg-black"
        style={{ minHeight: 240 }}
      />
      <p className="text-xs text-[#6B7280] text-center">
        {estado === 'pidiendo' && 'Pidiendo permiso de cámara…'}
        {estado === 'escaneando' && 'Apuntá al QR del socio'}
        {estado === 'detectado' && 'QR detectado, validando…'}
      </p>
    </div>
  );
}
