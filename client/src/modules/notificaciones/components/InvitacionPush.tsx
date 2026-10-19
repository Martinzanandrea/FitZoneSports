import { useState } from "react";
import { Bell, Smartphone } from "lucide-react";
import { useEstadoConexion } from "../../../shared/hooks/useEstadoConexion";
import { usePushNotificaciones } from "../hooks/usePushNotificaciones";
import { descarteVigente, guardarDescarte } from "../push.descarte";
import "../../../styles/notificaciones.css";

// Franja del inicio que invita a activar las notificaciones. El permiso del navegador se pide
// únicamente al tocar "Activar".
export function InvitacionPush() {
  const push = usePushNotificaciones();
  const enLinea = useEstadoConexion();
  const [oculta, setOculta] = useState(descarteVigente);

  if (oculta || push.verificando) return null;

  function ahoraNo() {
    guardarDescarte();
    setOculta(true);
  }

  // iPhone y iPad sin la app instalada: solo funciona agregándola a la pantalla de inicio.
  if (push.requiereInstalar) {
    return (
      <section className="push-invitacion glass" aria-label="Notificaciones">
        <Smartphone size={20} aria-hidden />
        <p>
          Para recibir avisos, agregá la app a la pantalla de inicio: tocá
          Compartir y luego Agregar a pantalla de inicio.
        </p>
        <div className="push-invitacion-acciones">
          <button type="button" className="btn btn-ghost" onClick={ahoraNo}>
            Ahora no
          </button>
        </div>
      </section>
    );
  }

  if (!push.soportado || push.suscrito || push.permiso === "denied" || !enLinea)
    return null;

  return (
    <section className="push-invitacion glass" aria-label="Notificaciones">
      <Bell size={20} aria-hidden />
      <p>Recibí avisos de tus clases, cupos y comunicados de la sede</p>
      <div className="push-invitacion-acciones">
        <button
          type="button"
          className="btn btn-primary"
          disabled={push.trabajando}
          onClick={() => void push.activar()}
        >
          {push.trabajando ? "Activando..." : "Activar"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={push.trabajando}
          onClick={ahoraNo}
        >
          Ahora no
        </button>
      </div>
    </section>
  );
}
