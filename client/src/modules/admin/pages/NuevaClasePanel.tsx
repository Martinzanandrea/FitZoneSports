import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { clasesApi } from '../../clases/clases.api';
import type { HorarioClasePayload } from '../../clases/clases.api';
import type { Clase } from '../../clases/clases.types';
import { sedesApi } from '../../sedes/sedes.api';
import type { FranjaHoraria } from '../../sedes/sedes.types';
import { instructoresApi, type Instructor } from '../../instructores/instructores.api';
import { Chip } from '../../../shared/components/ui';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { LoadingState } from '../../../shared/components/LoadingState';
import { Select } from '../../../shared/components/Select';

export const DIAS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

export function nombreDia(diaSemana: number) {
  return DIAS.find((d) => d.value === diaSemana)?.label ?? `Día ${diaSemana}`;
}

// Huecos libres = franjas de la sede menos lo ya ocupado ese día
// (mismo criterio que el backend en reparto-horas.service.ts, pero
// calculado acá con datos ya traídos para no agregar otro endpoint).
interface Intervalo {
  inicio: number; // minutos desde las 00:00
  fin: number;
}

// Huecos libres de un día: franjas menos lo ocupado por clases activas
// ese día, menos las demás filas de la propuesta en edición.
function huecosParaDia(
  franjas: FranjaHoraria[],
  clasesSede: Clase[],
  filas: HorarioClasePayload[],
  diaSemana: number,
  excluirFila?: number,
): Intervalo[] {
  const ventanas = franjas.map((f) => ({
    inicio: aMinutosHueco(f.apertura),
    fin: aMinutosHueco(f.cierre),
  }));
  const ocupados: Intervalo[] = [];
  for (const c of clasesSede) {
    for (const h of c.horarios ?? []) {
      if (h.diaSemana === diaSemana) {
        ocupados.push({ inicio: aMinutosHueco(h.horaInicio), fin: aMinutosHueco(h.horaFin) });
      }
    }
  }
  filas.forEach((h, i) => {
    if (i !== excluirFila && h.diaSemana === diaSemana && h.horaInicio && h.horaFin) {
      ocupados.push({ inicio: aMinutosHueco(h.horaInicio), fin: aMinutosHueco(h.horaFin) });
    }
  });
  return restarOcupados(ventanas, ocupados);
}

function aMinutosHueco(hora: string) {
  const [h = '0', m = '0'] = hora.slice(0, 5).split(':');
  return Number(h) * 60 + Number(m);
}

function aHoraHueco(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function restarOcupados(ventanas: Intervalo[], ocupados: Intervalo[]): Intervalo[] {
  const libres: Intervalo[] = [];
  for (const v of ventanas) {
    let cursor = v.inicio;
    const choques = ocupados
      .filter((o) => o.inicio < v.fin && v.inicio < o.fin)
      .sort((a, b) => a.inicio - b.inicio);
    for (const c of choques) {
      if (c.inicio > cursor) libres.push({ inicio: cursor, fin: c.inicio });
      cursor = Math.max(cursor, c.fin);
    }
    if (cursor < v.fin) libres.push({ inicio: cursor, fin: v.fin });
  }
  return libres.sort((a, b) => a.inicio - b.inicio);
}

// Inicios posibles en pasos de 30 minutos (con al menos 30 min libres).
function iniciosEnHuecos(huecos: Intervalo[]): string[] {
  const out: string[] = [];
  for (const h of huecos) {
    for (let t = Math.ceil(h.inicio / 30) * 30; t + 30 <= h.fin; t += 30) {
      out.push(aHoraHueco(t));
    }
  }
  return out;
}

// Fines posibles desde un inicio, sin saltar a otro hueco separado.
function finesDesde(huecos: Intervalo[], inicio: string): string[] {
  const ini = aMinutosHueco(inicio);
  const bloque = huecos.find((h) => h.inicio <= ini && ini < h.fin);
  if (!bloque) return [];
  const out: string[] = [];
  for (let t = ini + 30; t <= bloque.fin; t += 30) {
    out.push(aHoraHueco(t));
  }
  return out;
}

interface NuevaClasePanelProps {
  sedeId: string;
  inicial?: { diaSemana: number; horaInicio: string };
  onClose: () => void;
  onCreada: () => void;
}

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

export function NuevaClasePanel({ sedeId, inicial, onClose, onCreada }: NuevaClasePanelProps) {
  const [paso, setPaso] = useState(1);
  const [tipoClase, setTipoClase] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [horasSemanales, setHorasSemanales] = useState(2);
  const [instructores, setInstructores] = useState<Instructor[]>([]);
  const [numDias, setNumDias] = useState<number | null>(null);
  const [horarios, setHorarios] = useState<HorarioClasePayload[]>([]);
  const [motivo, setMotivo] = useState('');
  const [cargandoSugerencia, setCargandoSugerencia] = useState(false);
  const [capacidad, setCapacidad] = useState(20);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [franjas, setFranjas] = useState<FranjaHoraria[]>([]);
  const [clasesSede, setClasesSede] = useState<Clase[]>([]);
  // La clase ya quedó guardada pero el backend no pudo generar sus fechas.
  const [claseCreadaId, setClaseCreadaId] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState(false);

  useEffect(() => {
    instructoresApi.getAll(1, 100).then((res) => setInstructores(res.data)).catch(() => setInstructores([]));
    // Ya se traen para el selector: franjas y clases activas de esta sede.
    sedesApi.getFranjas(sedeId).then(setFranjas).catch(() => setFranjas([]));
    clasesApi.getAll(sedeId, 1, 100).then((res) => setClasesSede(res.data.filter((cl) => cl.activa !== false))).catch(() => setClasesSede([]));
  }, [sedeId]);

  // Huecos libres de un día: franjas menos lo ocupado por otras clases
  // activas ese día, menos las demás filas de esta misma propuesta.
  function huecosDelDia(diaSemana: number, excluirFila?: number): Intervalo[] {
    return huecosParaDia(franjas, clasesSede, horarios, diaSemana, excluirFila);
  }

  async function elegirDias(n: number) {
    setNumDias(n);
    setMotivo('');
    setHorarios([]);
    setCargandoSugerencia(true);
    try {
      const res = await clasesApi.sugerirReparto(sedeId, horasSemanales, n);
      if (!res.viable) {
        setMotivo(res.motivo ?? 'Sin lugar disponible para esa combinación.');
        return;
      }
      const base = res.horarios.map((h) => ({
        diaSemana: h.diaSemana,
        horaInicio: h.horaInicio.slice(0, 5),
        horaFin: h.horaFin.slice(0, 5),
      }));
      // Si se abrió desde un hueco libre, precargar el primer renglón con ese día/hora
      // (solo si esa hora sigue libre entre las opciones calculadas).
      if (inicial && base.length > 0) {
        const huecos = huecosParaDia(franjas, clasesSede, [], inicial.diaSemana);
        base[0] = {
          ...base[0],
          diaSemana: inicial.diaSemana,
          horaInicio: iniciosEnHuecos(huecos).includes(inicial.horaInicio.slice(0, 5))
            ? inicial.horaInicio.slice(0, 5)
            : '',
        };
      }
      setHorarios(base);
    } catch {
      setMotivo('No se pudo calcular la sugerencia. Intentá de nuevo.');
    } finally {
      setCargandoSugerencia(false);
    }
  }

  function actualizarHorario(index: number, campo: keyof HorarioClasePayload, valor: string | number) {
    setHorarios((prev) =>
      prev.map((h, i) => {
        if (i !== index) return h;
        // Si cambia el día, se resetean las horas (las opciones dependen del día).
        if (campo === 'diaSemana') return { ...h, diaSemana: Number(valor), horaInicio: '', horaFin: '' };
        // Si cambia el inicio, se resetea el fin (depende del hueco continuo).
        if (campo === 'horaInicio') return { ...h, horaInicio: String(valor), horaFin: '' };
        return { ...h, horaFin: String(valor) };
      }),
    );
  }

  // Los horarios se eligen solo entre huecos realmente libres del día
  // (franjas menos clases activas y menos las demás filas). Igual el
  // backend revalida al crear (validarHuecosLibres) y devuelve 400/409
  // si algo cambió entre que se cargó la pantalla y se guardó.
  const horariosValidos =
    horarios.length > 0 && horarios.every((h) => h.horaInicio && h.horaFin && h.horaFin > h.horaInicio);

  async function crear() {
    setGuardando(true);
    setError('');
    try {
      const clase = await clasesApi.crear({
        sedeId,
        tipoClase: tipoClase.trim(),
        instructorId,
        capacidad: Number(capacidad),
        horasSemanalesTotales: Number(horasSemanales),
        horarios: horarios.map((h) => ({
          diaSemana: h.diaSemana,
          horaInicio: h.horaInicio.slice(0, 5),
          horaFin: h.horaFin.slice(0, 5),
        })),
      });
      if (clase.ocurrenciasGeneradas) {
        onCreada();
      } else {
        // La clase existe: NO se vuelve a crear, solo se reintenta la generación.
        setClaseCreadaId(clase.id);
        setPaso(4);
      }
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo crear la clase. Revisá los horarios (puede haber solape).'));
    } finally {
      setGuardando(false);
    }
  }

  async function reintentarGeneracion() {
    if (!claseCreadaId) return;
    setReintentando(true);
    setError('');
    try {
      await clasesApi.generarOcurrencias(claseCreadaId);
      onCreada();
    } catch (e) {
      setError(mensajeDe(e, 'No se pudieron generar las fechas. Intentá de nuevo en unos segundos.'));
    } finally {
      setReintentando(false);
    }
  }

  const paso1Valido = tipoClase.trim().length > 0 && instructorId !== '' && horasSemanales >= 0.5;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        // En el paso 4 la clase ya existe: cerrar refresca el calendario.
        if (e.target === e.currentTarget) (paso === 4 ? onCreada : onClose)();
      }}
    >
      <div className="glass panel modal-card" role="dialog" aria-modal="true" aria-label="Nueva clase">
        <SectionHeader
          title="Nueva clase"
          description={paso === 4 ? 'Clase creada' : `Paso ${paso} de 3`}
          action={
            <button type="button" className="icon-button" onClick={paso === 4 ? onCreada : onClose} aria-label="Cerrar">
              <X size={16} />
            </button>
          }
        />

        {error && (
          <p role="alert" className="notice notice-err" style={{ marginBottom: 14 }}>
            {error}
          </p>
        )}

        {paso === 1 && (
          <div className="stack-gap">
            <label>
              <span className="field-label">TIPO DE CLASE</span>
              <input
                className="field-input"
                value={tipoClase}
                onChange={(e) => setTipoClase(e.target.value)}
                placeholder="Spinning, Yoga, Funcional..."
              />
            </label>
            <div>
              <span className="field-label">INSTRUCTOR</span>
              <Select
                value={instructorId}
                onChange={(v) => setInstructorId(v)}
                placeholder="Seleccionar instructor..."
                ariaLabel="Instructor"
                opciones={instructores.filter((i) => i.activo).map((i) => ({ value: i.id, label: i.nombre }))}
              />
            </div>
            <label>
              <span className="field-label">HORAS SEMANALES TOTALES</span>
              <input
                className="field-input"
                type="number"
                min={0.5}
                step={0.5}
                value={horasSemanales}
                onChange={(e) => setHorasSemanales(Number(e.target.value))}
              />
            </label>
            <button className="btn btn-primary" disabled={!paso1Valido} onClick={() => setPaso(2)}>
              Continuar
            </button>
          </div>
        )}

        {paso === 2 && (
          <div className="stack-gap">
            <p style={{ fontSize: 13 }}>¿En cuántos días se reparten las {horasSemanales} h semanales?</p>
            <div className="inline-actions">
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} label={n === 1 ? '1 día' : `${n} días`} active={numDias === n} onClick={() => void elegirDias(n)} />
              ))}
            </div>

            {cargandoSugerencia && <LoadingState rows={1} label="Calculando propuesta" />}

            {motivo && <p className="notice notice-err">{motivo}</p>}

            {horarios.length > 0 && (
              <div className="stack-gap" style={{ gap: 10 }}>
                {horarios.map((h, i) => {
                  const huecos = huecosDelDia(h.diaSemana, i);
                  const inicios = iniciosEnHuecos(huecos);
                  const fines = h.horaInicio ? finesDesde(huecos, h.horaInicio) : [];
                  return (
                    <div
                      key={i}
                      className="glass"
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, borderRadius: 14, padding: 12 }}
                    >
                      <div>
                        <span className="field-label">DÍA</span>
                        <Select
                          value={String(h.diaSemana)}
                          onChange={(v) => actualizarHorario(i, 'diaSemana', Number(v))}
                          ariaLabel="Día"
                          opciones={DIAS.map((d) => ({ value: String(d.value), label: d.label }))}
                        />
                      </div>
                      <div>
                        <span className="field-label">INICIO</span>
                        <Select
                          value={inicios.includes(h.horaInicio) ? h.horaInicio : ''}
                          onChange={(v) => actualizarHorario(i, 'horaInicio', v)}
                          disabled={inicios.length === 0}
                          ariaLabel="Hora de inicio"
                          placeholder={inicios.length === 0 ? 'Sin horarios libres este día' : 'Elegir hora…'}
                          opciones={inicios.map((t) => ({ value: t, label: t }))}
                        />
                      </div>
                      <div>
                        <span className="field-label">FIN</span>
                        <Select
                          value={fines.includes(h.horaFin) ? h.horaFin : ''}
                          onChange={(v) => actualizarHorario(i, 'horaFin', v)}
                          disabled={!h.horaInicio || fines.length === 0}
                          ariaLabel="Hora de fin"
                          placeholder={!h.horaInicio ? 'Elegí inicio primero' : 'Elegir hora…'}
                          opciones={fines.map((t) => ({ value: t, label: t }))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="inline-actions">
              <button className="btn btn-secondary" onClick={() => setPaso(1)}>
                Atrás
              </button>
              <button className="btn btn-primary" disabled={!horariosValidos} onClick={() => setPaso(3)}>
                Continuar
              </button>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div className="stack-gap">
            <label>
              <span className="field-label">CAPACIDAD (CUPO MÁXIMO)</span>
              <input className="field-input" type="number" min={1} value={capacidad} onChange={(e) => setCapacidad(Number(e.target.value))} />
            </label>

            <div className="glass" style={{ borderRadius: 14, padding: 14 }}>
              <strong style={{ color: 'var(--text)' }}>{tipoClase}</strong>
              <p style={{ marginTop: 4, fontSize: 12 }}>
                {horasSemanales} h/semana · {horarios.length} día(s) · cupo {capacidad}
              </p>
              <ul style={{ marginTop: 8, fontSize: 12, listStyle: 'none', padding: 0 }}>
                {horarios.map((h, i) => (
                  <li key={i}>
                    {nombreDia(h.diaSemana)} {h.horaInicio}–{h.horaFin}
                  </li>
                ))}
              </ul>
            </div>

            <div className="inline-actions">
              <button className="btn btn-secondary" onClick={() => setPaso(2)}>
                Atrás
              </button>
              <button className="btn btn-primary" disabled={guardando} onClick={() => void crear()}>
                {guardando ? 'Creando...' : 'Crear clase'}
              </button>
            </div>
          </div>
        )}

        {paso === 4 && (
          <div className="stack-gap">
            <p className="notice notice-err" role="status">
              La clase se guardó, pero no pudimos generar sus fechas. Mientras tanto nadie puede reservarla. Reintentá la generación (es seguro repetirla) o cerrá y hacelo más tarde.
            </p>
            <div className="inline-actions">
              <button className="btn btn-primary" disabled={reintentando} onClick={() => void reintentarGeneracion()}>
                <RefreshCw size={15} aria-hidden /> {reintentando ? 'Reintentando...' : 'Reintentar generación'}
              </button>
              <button className="btn btn-secondary" disabled={reintentando} onClick={onCreada}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
