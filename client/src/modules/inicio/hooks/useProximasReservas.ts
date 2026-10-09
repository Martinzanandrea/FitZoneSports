import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { clasesApi } from '../../clases/clases.api';
import { canchasApi } from '../../canchas/canchas.api';
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
// (CONFIRMADA) del usuario autenticado, ordenadas por fecha y hora. Usa los
// endpoints "mias": el backend filtra por el token, el navegador no recibe
// reservas ajenas. conClases=false evita pedir clases (ej. Externo).
// 'red': sin respuesta o 5xx (reintentar tiene sentido). 'proceso': la
// respuesta llegó pero no se pudo interpretar (bug o datos inesperados).
export type ErrorProximas = 'red' | 'proceso' | null;

export function useProximasReservas(usuarioId: string | undefined, limite = 3, conClases = true) {
  const [proximas, setProximas] = useState<ProximaReserva[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ErrorProximas>(null);

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
        const hoy = fechaLocalYMD(new Date());
        const [clases, canchas] = await unaVez(`proximas:${usuarioId}:${conClases}`, () =>
          Promise.all([
            conClases ? clasesApi.getMisReservas(hoy) : Promise.resolve(null),
            canchasApi.getMisReservas({ desde: hoy }),
          ]),
        );
        const items: ProximaReserva[] = [];
        for (const r of clases?.data ?? []) {
          if (r.estado !== 'RESERVADA') continue;
          // Elemento incompleto: se omite sin tumbar la lista, y se avisa.
          if (!r.ocurrencia?.clase) {
            console.warn('Reserva de clase incompleta, se omite:', r.id);
            continue;
          }
          items.push({
            id: r.id,
            kind: 'clase',
            titulo: r.ocurrencia.clase.tipoClase,
            detalle: r.ocurrencia.clase.sede?.nombre ?? '',
            fecha: r.ocurrencia.fecha,
            hora: r.ocurrencia.horaInicio.slice(0, 5),
            instructor: r.ocurrencia.clase.instructor?.nombre,
            to: '/reservar-clases',
          });
        }
        for (const r of canchas.data) {
          if (!r.cancha) {
            console.warn('Reserva de cancha incompleta, se omite:', r.id);
            continue;
          }
          items.push({
            id: r.id,
            kind: 'cancha',
            titulo: r.cancha.nombre,
            detalle: r.cancha.sede?.nombre ?? '',
            fecha: r.fecha,
            hora: r.horaInicio.slice(0, 5),
            to: '/reservar-canchas',
          });
        }
        items.sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
        if (viva) setProximas(items.slice(0, limite));
      } catch (e) {
        const esRed = isAxiosError(e) && (!e.response || e.response.status >= 500);
        if (!esRed) console.error('Error procesando las próximas reservas:', e);
        if (viva) setError(esRed ? 'red' : 'proceso');
      } finally {
        if (viva) setCargando(false);
      }
    })();
    return () => {
      viva = false;
    };
  }, [usuarioId, limite, conClases]);

  return { proximas, cargando, error };
}

function fechaLocalYMD(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatearFechaCorta(fechaYMD: string): string {
  const [y, m, d] = fechaYMD.split('-');
  return `${d}/${m}/${y}`;
}
