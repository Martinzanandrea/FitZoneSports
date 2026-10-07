import { useEffect, useState } from 'react';
import { fetchMapaReservasClase } from '../../clases/clases.api';
import { fetchMisReservasCancha } from '../../canchas/canchas.api';
import { unaVez } from '../../../shared/utils/unaVez';

export interface ProximaReserva {
  id: string;
  kind: 'clase' | 'cancha';
  titulo: string;
  detalle: string;
  fecha: string;
  hora: string;
  instructor?: string;
  to: '/reservar-clases' | '/reservar-canchas';
}

// Agrega las reservas futuras de clases (RESERVADA) y canchas
// (CONFIRMADA) del usuario, ordenadas por fecha y hora. Reusa la misma
// agregación que las pantallas de reserva, sin endpoints nuevos.
export function useProximasReservas(usuarioId: string | undefined, limite = 3) {
  const [proximas, setProximas] = useState<ProximaReserva[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!usuarioId) {
      setCargando(false);
      return;
    }
    let viva = true;
    (async () => {
      try {
        // unaVez: un solo juego de pedidos por montaje aunque StrictMode
        // ejecute el efecto dos veces; `viva` descarta resultados viejos.
        const [mapa, misCanchas] = await unaVez(`proximas:${usuarioId}`, () =>
          Promise.all([fetchMapaReservasClase(14), fetchMisReservasCancha(usuarioId)]),
        );
        const hoy = new Date().toISOString().split('T')[0];
        const items: ProximaReserva[] = [];
        for (const reservas of Object.values(mapa.resMap)) {
          for (const r of reservas) {
            if (r.usuario.id !== usuarioId || r.estado !== 'RESERVADA' || r.ocurrencia.fecha < hoy) continue;
            items.push({
              id: r.id,
              kind: 'clase',
              titulo: r.ocurrencia.clase.tipoClase,
              detalle: `${r.ocurrencia.clase.sede.nombre}`,
              fecha: r.ocurrencia.fecha,
              hora: r.ocurrencia.horaInicio.slice(0, 5),
              instructor: r.ocurrencia.clase.instructor.nombre,
              to: '/reservar-clases',
            });
          }
        }
        for (const { reserva, cancha } of misCanchas) {
          if (reserva.fecha < hoy) continue;
          items.push({
            id: reserva.id,
            kind: 'cancha',
            titulo: cancha.nombre,
            detalle: cancha.sede.nombre,
            fecha: reserva.fecha,
            hora: reserva.horaInicio.slice(0, 5),
            to: '/reservar-canchas',
          });
        }
        items.sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
        if (viva) setProximas(items.slice(0, limite));
      } catch {
        if (viva) setError(true);
      } finally {
        if (viva) setCargando(false);
      }
    })();
    return () => {
      viva = false;
    };
  }, [usuarioId, limite]);

  return { proximas, cargando, error };
}

export function formatearFechaCorta(fechaYMD: string): string {
  const [y, m, d] = fechaYMD.split('-');
  return `${d}/${m}/${y}`;
}
