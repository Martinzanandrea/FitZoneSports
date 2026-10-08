import axios from "axios";
/*Configuración de conexion para axios, para que todas las peticiones vayan a la URL del backend y
para que envíe las cookies de sesión (si las hubiera) en cada petición.*/
/**
 * Axios sirve para hacer peticiones HTTP al backend. Se configura con la URL base del backend
 * y para que envíe cookies de sesión en cada petición.
 * Arma la url completa de la petición concatenando la baseURL
 *  con el endpoint que se le pase a cada método (get, post, patch, etc.).
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  // 10s: si una request cuelga (backend lento, red caída a medias),
  // se rechaza en vez de dejar loadings infinitos en los componentes.
  timeout: 10000,
});

const CLAVE_AVISO = "fitzone-sesion-vencida";
export const MENSAJE_SESION_VENCIDA = "Tu sesión venció. Iniciá sesión de nuevo.";

// AuthProvider registra acá cómo reaccionar (estado de React + navegación);
// este módulo vive fuera de React y solo decide cuándo disparar cada caso.
interface ManejadorSesion {
  sesionVencida: () => void;
  // Revalida /auth/me tras un 403; devuelve true si el usuario o su rol cambiaron
  // (y ya actualizó el estado y redirigió).
  revalidarTras403: () => Promise<boolean>;
}

let manejador: ManejadorSesion | null = null;
let redirigiendo = false;

export function registrarManejadorSesion(m: ManejadorSesion | null): void {
  manejador = m;
}

// El aviso viaja por sessionStorage (no es un dato sensible) hasta que Login lo muestre.
export function leerAvisoSesionVencida(): string {
  try {
    return sessionStorage.getItem(CLAVE_AVISO) ? MENSAJE_SESION_VENCIDA : "";
  } catch {
    return "";
  }
}

export function limpiarAvisoSesionVencida(): void {
  try {
    sessionStorage.removeItem(CLAVE_AVISO);
  } catch {
    /* sin sessionStorage: no hay aviso que limpiar */
  }
}

/*
Interceptor de respuestas:
- 401 (salvo /auth/me y las páginas de login): la sesión venció. Se limpia, se avisa y se
  redirige a login UNA sola vez aunque fallen varias peticiones a la vez.
- 403: puede ser que la cookie ahora pertenezca a otro usuario (otra pestaña). Se revalida
  /auth/me una vez; si cambió el usuario/rol se redirige a su panel, si no se muestra el error normal.
*/
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url: string = error.config?.url ?? "";
    const enPaginaDeLogin =
      window.location.pathname === "/login" ||
      window.location.pathname === "/admin/login";
    const esCheckDeSesion = url.includes("/auth/me");
    const status = error.response?.status;

    if (status === 401 && !esCheckDeSesion && !enPaginaDeLogin) {
      if (!redirigiendo) {
        redirigiendo = true;
        try {
          sessionStorage.setItem(CLAVE_AVISO, "1");
        } catch {
          /* sin sessionStorage: se redirige igual, sin aviso */
        }
        if (manejador) {
          manejador.sesionVencida();
        } else {
          const enAdmin = window.location.pathname.startsWith("/admin");
          window.location.href = enAdmin ? "/admin/login" : "/login";
        }
        setTimeout(() => {
          redirigiendo = false;
        }, 2000);
      }
    } else if (status === 403 && !esCheckDeSesion && manejador) {
      await manejador.revalidarTras403().catch(() => false);
    }

    return Promise.reject(error);
  },
);
