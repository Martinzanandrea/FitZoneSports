import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../modules/auth/AuthContext";
import { destinoInicioApp } from "../../utils/rutaPanel";
import "../../../styles/instalacion.css";

// Inicio de la app según la sesión: panel del rol o login.
function useDestinoInicio(): string {
  const { user } = useAuth();
  return destinoInicioApp(user?.tipoActor);
}

// Botón "Volver" con ícono. Usa el historial solo si hay una pantalla previa dentro de la app
// (React Router guarda el índice en history.state); si se abrió desde un enlace profundo,
// va al inicio.
export function BotonVolverApp({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const inicio = useDestinoInicio();

  function volver() {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(inicio, { replace: true });
  }

  return (
    <button
      type="button"
      className={`icon-button boton-volver ${className}`.trim()}
      aria-label="Volver"
      onClick={volver}
    >
      <ArrowLeft size={20} aria-hidden />
    </button>
  );
}
