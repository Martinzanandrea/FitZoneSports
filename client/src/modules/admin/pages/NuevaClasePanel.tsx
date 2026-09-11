import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { clasesApi } from '../../clases/clases.api';
import type { HorarioClasePayload } from '../../clases/clases.api';
import type { Clase } from '../../clases/clases.types';
import { sedesApi } from '../../sedes/sedes.api';
import type { FranjaHoraria } from '../../sedes/sedes.types';
import { instructoresApi, type Instructor } from '../../instructores/instructores.api';
import { Button, Chip } from '../../../shared/components/ui';

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

const inputCls =
  'mt-1.5 w-full rounded-lg border border-[#D1D5DB] px-3 py-2.5 font-normal outline-none focus:border-[#8B2EFF]';

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
      await clasesApi.crear({
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
      onCreada();
    } catch {
      setError('No se pudo crear la clase. Revisá los horarios (puede haber solape).');
    } finally {
      setGuardando(false);
    }
  }

  const paso1Valido = tipoClase.trim().length > 0 && instructorId !== '' && horasSemanales >= 0.5;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 md:rounded-2xl md:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#111111]">Nueva clase</h2>
            <p className="mt-0.5 text-xs text-[#6B7280]">Paso {paso} de 3</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-[#6B7280] hover:text-[#111111]"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
            {error}
          </p>
        )}

        {paso === 1 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-[#374151]">
              Tipo de clase
              <input
                value={tipoClase}
                onChange={(e) => setTipoClase(e.target.value)}
                placeholder="Spinning, Yoga, Funcional..."
                className={inputCls}
                style={{ minHeight: 44 }}
              />
            </label>
            <label className="block text-sm font-medium text-[#374151]">
              Instructor
              <select
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className={inputCls}
                style={{ minHeight: 44 }}
              >
                <option value="">Seleccionar instructor...</option>
                {instructores
                  .filter((i) => i.activo)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-[#374151]">
              Horas semanales totales
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={horasSemanales}
                onChange={(e) => setHorasSemanales(Number(e.target.value))}
                className={inputCls}
                style={{ minHeight: 44 }}
              />
            </label>
            <Button fullWidth disabled={!paso1Valido} onClick={() => setPaso(2)}>
              Continuar
            </Button>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-[#6B7280]">
              ¿En cuántos días se reparten las {horasSemanales} h semanales?
            </p>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip
                  key={n}
                  label={n === 1 ? '1 día' : `${n} días`}
                  active={numDias === n}
                  onClick={() => void elegirDias(n)}
                />
              ))}
            </div>

            {cargandoSugerencia && <p className="text-sm text-[#6B7280]">Calculando propuesta...</p>}

            {motivo && (
              <p className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-sm text-[#92400E]">
                {motivo}
              </p>
            )}

            {horarios.length > 0 && (
              <div className="space-y-2">
                {horarios.map((h, i) => {
                  const huecos = huecosDelDia(h.diaSemana, i);
                  const inicios = iniciosEnHuecos(huecos);
                  const fines = h.horaInicio ? finesDesde(huecos, h.horaInicio) : [];
                  const selectCls =
                    'mt-1 w-full rounded-lg border border-[#D1D5DB] bg-white px-2 py-2 text-sm outline-none focus:border-[#8B2EFF] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]';
                  return (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_1fr] items-end gap-2 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3"
                  >
                    <label className="text-xs font-medium text-[#374151]">
                      Día
                      <select
                        value={h.diaSemana}
                        onChange={(e) => actualizarHorario(i, 'diaSemana', Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] bg-white px-2 py-2 text-sm outline-none focus:border-[#8B2EFF]"
                        style={{ minHeight: 44 }}
                      >
                        {DIAS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-[#374151]">
                      Inicio
                      <select
                        value={inicios.includes(h.horaInicio) ? h.horaInicio : ''}
                        onChange={(e) => actualizarHorario(i, 'horaInicio', e.target.value)}
                        disabled={inicios.length === 0}
                        className={selectCls}
                        style={{ minHeight: 44 }}
                      >
                        {inicios.length === 0 ? (
                          <option value="">Sin horarios libres este día</option>
                        ) : (
                          <>
                            <option value="">Elegir hora…</option>
                            {inicios.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </>
                        )}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-[#374151]">
                      Fin
                      <select
                        value={fines.includes(h.horaFin) ? h.horaFin : ''}
                        onChange={(e) => actualizarHorario(i, 'horaFin', e.target.value)}
                        disabled={!h.horaInicio || fines.length === 0}
                        className={selectCls}
                        style={{ minHeight: 44 }}
                      >
                        {!h.horaInicio ? (
                          <option value="">Elegí inicio primero</option>
                        ) : (
                          <>
                            <option value="">Elegir hora…</option>
                            {fines.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </>
                        )}
                      </select>
                    </label>
                  </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" fullWidth onClick={() => setPaso(1)}>
                Atrás
              </Button>
              <Button fullWidth disabled={!horariosValidos} onClick={() => setPaso(3)}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-[#374151]">
              Capacidad (cupo máximo)
              <input
                type="number"
                min={1}
                value={capacidad}
                onChange={(e) => setCapacidad(Number(e.target.value))}
                className={inputCls}
                style={{ minHeight: 44 }}
              />
            </label>

            <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 text-sm">
              <p className="font-bold text-[#111111]">{tipoClase}</p>
              <p className="mt-1 text-xs text-[#6B7280]">
                {horasSemanales} h/semana · {horarios.length} día(s) · cupo {capacidad}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-[#374151]">
                {horarios.map((h, i) => (
                  <li key={i}>
                    {nombreDia(h.diaSemana)} {h.horaInicio}–{h.horaFin}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" fullWidth onClick={() => setPaso(2)}>
                Atrás
              </Button>
              <Button fullWidth disabled={guardando} onClick={() => void crear()}>
                {guardando ? 'Creando...' : 'Crear clase'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
