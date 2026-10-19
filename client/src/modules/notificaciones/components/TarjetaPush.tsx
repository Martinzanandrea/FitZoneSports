import type { ReactNode } from "react";
import { Bell, BellOff } from "lucide-react";
import { SectionHeader } from "../../../shared/components/molecules";
import {
  TEXTO_REQUIERE_CONEXION,
  useEstadoConexion,
} from "../../../shared/hooks/useEstadoConexion";
import { usePushNotificaciones } from "../hooks/usePushNotificaciones";

export function TarjetaPush() {
  const push = usePushNotificaciones();
  const enLinea = useEstadoConexion();

  let contenido: ReactNode;
  if (push.requiereInstalar) {
    contenido = (
      <p style={{ fontSize: 12 }}>
        En iPhone y iPad las notificaciones solo funcionan con la aplicación
        instalada. Abrí esta página en Safari, tocá Compartir y elegí «Agregar a
        pantalla de inicio». Luego abrí FitZone desde el ícono y volvé a esta
        sección.
      </p>
    );
  } else if (!push.soportado) {
    contenido = (
      <p style={{ fontSize: 12 }}>
        Este navegador no admite notificaciones push.
      </p>
    );
  } else if (push.verificando) {
    contenido = (
      <p style={{ fontSize: 12 }}>
        Verificando el estado de las notificaciones...
      </p>
    );
  } else if (push.permiso === "denied" && !push.suscrito) {
    contenido = (
      <p style={{ fontSize: 12 }}>
        Las notificaciones están bloqueadas para este sitio. Para habilitarlas,
        abrí los ajustes del navegador (en el candado junto a la dirección o en
        la configuración del sitio) y permití las notificaciones; en el celular,
        revisá también los ajustes del sistema. Después recargá la página.
      </p>
    );
  } else if (push.suscrito) {
    contenido = (
      <>
        <p style={{ fontSize: 12, marginBottom: 12 }}>
          Este dispositivo recibe notificaciones de FitZone.
        </p>
        <button
          className="btn btn-secondary"
          onClick={() => void push.desactivar()}
          disabled={!enLinea || push.trabajando}
        >
          <BellOff size={16} aria-hidden />{" "}
          {push.trabajando ? "Desactivando..." : "Desactivar notificaciones"}
        </button>
      </>
    );
  } else {
    contenido = (
      <>
        <p style={{ fontSize: 12, marginBottom: 12 }}>
          Recibí avisos del gimnasio en este dispositivo, incluso con la
          aplicación cerrada.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => void push.activar("tarjeta")}
          disabled={!enLinea || push.trabajando}
        >
          <Bell size={16} aria-hidden />{" "}
          {push.trabajando ? "Activando..." : "Activar notificaciones"}
        </button>
      </>
    );
  }

  const conBoton =
    push.soportado &&
    !push.requiereInstalar &&
    !push.verificando &&
    (push.suscrito || push.permiso !== "denied");

  return (
    <div className="form-panel" style={{ marginTop: 16 }}>
      <SectionHeader
        title="Notificaciones en este dispositivo"
        description="La preferencia se guarda por dispositivo."
      />
      {contenido}
      {conBoton && !enLinea && (
        <p style={{ fontSize: 11, marginTop: 8 }}>{TEXTO_REQUIERE_CONEXION}</p>
      )}
      {push.error && (
        <p role="alert" className="notice notice-err" style={{ marginTop: 10 }}>
          {push.error}
        </p>
      )}
    </div>
  );
}
