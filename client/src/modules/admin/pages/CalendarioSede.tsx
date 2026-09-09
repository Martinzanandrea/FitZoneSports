import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede, FranjaHoraria } from '../../sedes/sedes.types';
import { clasesApi } from '../../clases/clases.api';
import type { Clase } from '../../clases/clases.types';
import { Badge, Button, Card, Chip, PageHeader } from '../../../shared/components/ui';
import { NuevaClasePanel, nombreDia } from './NuevaClasePanel';

// Columnas Lun-Dom (diaSemana JS: 0 = domingo).
const DIAS_COLUMNAS = [1, 2, 3, 4, 5, 6, 0];

// Una clase, un color: paleta pastel fija, asignación determinística por id
// (texto siempre oscuro para que contraste sobre el pastel).
const PALETA_CLASES = [
  { fondo: '#EDE9FE', borde: '#8B5CF6' }, // lavanda
  { fondo: '#E0F2FE', borde: '#0284C7' }, // celeste
  { fondo: '#D1FAE5', borde: '#059669' }, // verde menta
  { fondo: '#FFEDD5', borde: '#EA580C' }, // durazno
  { fondo: '#FCE7F3', borde: '#DB2777' }, // rosa
  { fondo: '#FEF9C3', borde: '#CA8A04' }, // amarillo pálido
  { fondo: '#FFE4E6', borde: '#E11D48' }, // salmón
  { fondo: '#CCFBF1', borde: '#0D9488' }, // turquesa
  { fondo: '#ECFCCB', borde: '#65A30D' }, // lima pálido
];

function colorDeClase(claseId: string) {
  let hash = 0;
  for (let i = 0; i < claseId.length; i++) {
    hash = (hash * 31 + claseId.charCodeAt(i)) >>> 0;
  }
  return PALETA_CLASES[hash % PALETA_CLASES.length];
}

function aMinutos(hora: string) {
  const [h = '0', m = '0'] = hora.slice(0, 5).split(':');
  return Number(h) * 60 + Number(m);
}

function aHora(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function CalendarioSede() {
  const { sedeId } = useParams<{ sedeId: string }>();
  const navigate = useNavigate();
  const [sede, setSede] = useState<Sede | null>(null);
  const [franjas, setFranjas] = useState<FranjaHoraria[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diaMovil, setDiaMovil] = useState(1);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [inicial, setInicial] = useState<{ diaSemana: number; horaInicio: string } | undefined>(
    undefined,
  );

  const cargar = useCallback(async () => {
    if (!sedeId) return;
    setLoading(true);
    setError('');
    try {
      const [s, f, c] = await Promise.all([
        sedesApi.getOne(sedeId),
        sedesApi.getFranjas(sedeId).catch(() => [] as FranjaHoraria[]),
        clasesApi.getAll(sedeId).catch(() => [] as Clase[]),
      ]);
      setSede(s);
      setFranjas(f);
      setClases(c.filter((cl) => cl.activa !== false));
    } catch {
      setError('No se pudo cargar el calendario de la sede.');
    } finally {
      setLoading(false);
    }
  }, [sedeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Filas horarias: de la apertura mínima al cierre máximo, en bloques de 1 h.
  const filas = useMemo(() => {
    if (franjas.length === 0) return [];
    const min = Math.min(...franjas.map((f) => aMinutos(f.apertura)));
    const max = Math.max(...franjas.map((f) => aMinutos(f.cierre)));
    const inicio = Math.floor(min / 60) * 60;
    const fin = Math.ceil(max / 60) * 60;
    const out: number[] = [];
    for (let t = inicio; t < fin; t += 60) out.push(t);
    return out;
  }, [franjas]);

  const dentroDeFranja = useCallback(
    (slotInicio: number, slotFin: number) =>
      franjas.some((f) => aMinutos(f.apertura) <= slotInicio && aMinutos(f.cierre) >= slotFin),
    [franjas],
  );

  const bloquesEn = useCallback(
    (dia: number, slotInicio: number, slotFin: number) => {
      const out: Array<{ clase: Clase; horaInicio: string; horaFin: string }> = [];
      for (const clase of clases) {
        for (const h of clase.horarios ?? []) {
          if (
            h.diaSemana === dia &&
            aMinutos(h.horaInicio) < slotFin &&
            aMinutos(h.horaFin) > slotInicio
          ) {
            out.push({ clase, horaInicio: h.horaInicio.slice(0, 5), horaFin: h.horaFin.slice(0, 5) });
          }
        }
      }
      return out;
    },
    [clases],
  );

  function abrirPanel(diaSemana?: number, horaInicio?: string) {
    setInicial(
      diaSemana !== undefined && horaInicio ? { diaSemana, horaInicio } : undefined,
    );
    setPanelAbierto(true);
  }

  const bloquesDiaMovil = useMemo(() => {
    const out: Array<{ clase: Clase; horaInicio: string; horaFin: string }> = [];
    for (const clase of clases) {
      for (const h of clase.horarios ?? []) {
        if (h.diaSemana === diaMovil) {
          out.push({ clase, horaInicio: h.horaInicio.slice(0, 5), horaFin: h.horaFin.slice(0, 5) });
        }
      }
    }
    return out.sort((a, b) => (a.horaInicio < b.horaInicio ? -1 : 1));
  }, [clases, diaMovil]);

  if (loading) return <p className="text-sm text-[#6B7280]">Cargando calendario...</p>;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={sede?.nombre ?? 'Calendario'}
        onBack={() => navigate('/admin/clases')}
        action={
          <Button size="sm" onClick={() => abrirPanel()}>
            <Plus size={16} /> Nueva clase
          </Button>
        }
      />
      {sede && (
        <p className="-mt-4 mb-4 text-sm text-[#6B7280]">
          {sede.direccion} · {clases.length} clase(s) activa(s)
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      )}

      {franjas.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-sm text-[#6B7280]">
            Esta sede no tiene franjas horarias cargadas. Cargá al menos una franja para poder
            programar clases.
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop: grilla semanal */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white md:block">
            <div
              className="grid min-w-[760px]"
              style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}
            >
              <div className="border-b border-[#E5E7EB] bg-[#FAFAFA] p-2" />
              {DIAS_COLUMNAS.map((d) => (
                <div
                  key={d}
                  className="border-b border-l border-[#E5E7EB] bg-[#FAFAFA] p-2 text-center text-xs font-bold text-[#111111]"
                >
                  {nombreDia(d)}
                </div>
              ))}

              {filas.map((slot) => (
                <Fragment key={`fila-${slot}`}>
                  <div
                    key={`h-${slot}`}
                    className="border-b border-[#E5E7EB] p-2 text-right text-[11px] font-medium text-[#6B7280]"
                  >
                    {aHora(slot)}
                  </div>
                  {DIAS_COLUMNAS.map((dia) => {
                    const fin = slot + 60;
                    const abierto = dentroDeFranja(slot, fin);
                    const bloques = abierto ? bloquesEn(dia, slot, fin) : [];
                    const libre = abierto && bloques.length === 0;
                    return (
                      <div
                        key={`${dia}-${slot}`}
                        onClick={() => {
                          if (libre) abrirPanel(dia, aHora(slot));
                        }}
                        className={`min-h-[52px] border-b border-l border-[#E5E7EB] p-1 ${
                          !abierto
                            ? 'bg-[#F3F4F6]'
                            : libre
                              ? 'cursor-pointer hover:bg-[#F3E8FF]/50'
                              : 'bg-white'
                        }`}
                        title={libre ? 'Clic para crear una clase acá' : undefined}
                      >
                        {bloques.map(({ clase, horaInicio, horaFin }, i) => {
                          const color = colorDeClase(clase.id);
                          return (
                          <div
                            key={`${clase.id}-${i}`}
                            className="mb-1 rounded-lg border-l-4 p-1.5"
                            style={{ backgroundColor: color.fondo, borderLeftColor: color.borde }}
                          >
                            <p className="text-[11px] font-bold leading-tight text-[#111111]">
                              {clase.tipoClase}
                            </p>
                            <p className="text-[10px] leading-tight text-[#6B7280]">
                              {horaInicio}–{horaFin}
                            </p>
                            <p className="truncate text-[10px] leading-tight text-[#6B7280]">
                              {clase.instructor.nombre} · cupo {clase.capacidad}
                            </p>
                          </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Mobile: selector de día + lista vertical */}
          <div className="md:hidden">
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {DIAS_COLUMNAS.map((d) => (
                <Chip
                  key={d}
                  label={nombreDia(d)}
                  active={diaMovil === d}
                  onClick={() => setDiaMovil(d)}
                />
              ))}
            </div>
            {bloquesDiaMovil.length === 0 ? (
              <Card className="text-center py-8">
                <p className="text-sm text-[#6B7280]">Sin clases el {nombreDia(diaMovil)}.</p>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    onClick={() => abrirPanel(diaMovil, filas.length ? aHora(filas[0]) : '08:00')}
                  >
                    <Plus size={16} /> Crear acá
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {bloquesDiaMovil.map(({ clase, horaInicio, horaFin }, i) => {
                  const color = colorDeClase(clase.id);
                  return (
                  <Card
                    key={`${clase.id}-${i}`}
                    className="border-l-4"
                    style={{ backgroundColor: color.fondo, borderLeftColor: color.borde }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#111111]">{clase.tipoClase}</p>
                        <p className="mt-0.5 text-xs text-[#6B7280]">
                          {horaInicio}–{horaFin} · {clase.instructor.nombre}
                        </p>
                        <p className="text-xs text-[#6B7280]">Cupo {clase.capacidad}</p>
                      </div>
                      <Badge variant="violet">Activa</Badge>
                    </div>
                  </Card>
                  );
                })}
              </div>
            )}
            <div className="mt-4">
              <Button fullWidth onClick={() => abrirPanel()}>
                <Plus size={16} /> Nueva clase
              </Button>
            </div>
          </div>
        </>
      )}

      {panelAbierto && sedeId && (
        <NuevaClasePanel
          sedeId={sedeId}
          inicial={inicial}
          onClose={() => setPanelAbierto(false)}
          onCreada={() => {
            setPanelAbierto(false);
            void cargar();
          }}
        />
      )}
    </div>
  );
}
