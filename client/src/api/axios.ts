import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

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
