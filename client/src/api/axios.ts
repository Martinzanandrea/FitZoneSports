import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const enAdmin = window.location.pathname.startsWith('/admin');
      window.location.href = enAdmin ? '/admin/login' : '/login';
    }
    return Promise.reject(error);
  },
);