# Resultados de latencia (generado por medir-latencia.mjs)

Inicio: 2026-11-12T18:30:16.516Z · Fin: 2026-11-12T18:48:09.176Z · Node v24.19.0

| Endpoint | Muestras 2xx | Errores | p50 (ms) | p95 (ms) | Mín (ms) | Máx (ms) |
|---|---|---|---|---|---|---|
| GET /clases (listado de clases) | 50 | 0 | 22.48 | 24.35 | 7.09 | 25.01 |
| POST /reservas-cancha (reserva de cancha) | 50 | 0 | 35.04 | 42.65 | 21.74 | 46.8 |
| GET /reservas-cancha/cancha/:id/ocupacion (disponibilidad, fecha con reservas) | 200 | 0 | 21.2 | 22.62 | 5.39 | 24.16 |
| GET /reservas-cancha/cancha/:id/ocupacion (disponibilidad, fecha sin reservas) | 200 | 0 | 20.52 | 22.48 | 4.26 | 26.73 |
| GET /acceso/snapshot/:sedeId (snapshot de acceso) | 50 | 0 | 22.33 | 23.93 | 6.75 | 24.92 |
| POST /acceso/validar (validación de QR) | 50 | 0 | 37.29 | 39.93 | 10.17 | 40.24 |
| POST /auth/login (inicio de sesión) | 50 | 0 | 62.37 | 65.34 | 58.91 | 68.17 |
