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
});

/*
Interceptor de respuestas de Axios que revisa si la respuesta del backend es un error 401 (no autorizado).
Si lo es, redirige al usuario a la página de login, a menos que la petición sea para verificar sesión o ya esté en la página de login.
Esto evita que el usuario vea errores de autorización y lo lleva a autenticarse nuevamente.
*/
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? "";
    const enPaginaDeLogin =
      window.location.pathname === "/login" ||
      window.location.pathname === "/admin/login";
    //evita que se redirija a login si la petición es para verificar sesión
    const esCheckDeSesion = url.includes("/auth/me");

    if (
      error.response?.status === 401 &&
      !esCheckDeSesion &&
      !enPaginaDeLogin
    ) {
      const enAdmin = window.location.pathname.startsWith("/admin");
      window.location.href = enAdmin ? "/admin/login" : "/login";
    }

    return Promise.reject(error);
  },
);
