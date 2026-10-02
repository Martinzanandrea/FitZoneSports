import { type FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, LayoutGrid, Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import { tiposCanchaApi } from '../../canchas/canchas.api';
import type { TipoCanchaCatalogo } from '../../canchas/canchas.types';
import { Button, Card, PageHeader, StatCard } from '../../../shared/components/ui';
import { useTitulo } from '../../../shared/hooks/useTitulo';

const IMAGEN_FALLBACK = '/images/landing/gimnasio-alt.jpg';

// Misma regla que el backend (CreateTipoCanchaDto): letras, números y
// espacios, con al menos una letra (el "Fútbol 5" existente tiene dígito).
const NOMBRE_TIPO_REGEX = /^(?=.*\p{L})[\p{L}\s\d]+$/u;

function validarNombre(valor: string): string | null {
  const nombre = valor.trim();
  if (nombre.length < 2) return 'El nombre debe tener al menos 2 caracteres.';
  if (nombre.length > 60) return 'El nombre no puede superar los 60 caracteres.';
  if (!NOMBRE_TIPO_REGEX.test(nombre)) return 'El nombre solo puede contener letras, números y espacios, con al menos una letra.';
  return null;
}

type Modal = { mode: 'crear' } | { mode: 'editar'; tipo: TipoCanchaCatalogo } | null;

export function ConfiguracionTiposCancha() {
  useTitulo('Tipos de cancha');
  const [tipos, setTipos] = useState<TipoCanchaCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [nombre, setNombre] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accionId, setAccionId] = useState<string | null>(null);

  function cargar() {
    setLoading(true);
    tiposCanchaApi
      .listarTodos()
      .then(setTipos)
      .catch(() => setError('No se pudieron cargar los tipos de cancha.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(); }, []);

  function cerrarModal() {
    setModal(null);
    setNombre('');
    setFoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError('');
  }

  function abrirCrear() {
    setNombre('');
    setFoto(null);
    setPreview(null);
    setError('');
    setModal({ mode: 'crear' });
  }

  function abrirEditar(tipo: TipoCanchaCatalogo) {
    setNombre(tipo.nombre);
    setFoto(null);
    setPreview(tipo.imagenUrl);
    setError('');
    setModal({ mode: 'editar', tipo });
  }

  function elegirFoto(file: File | undefined) {
    if (!file) return;
    setFoto(file);
    if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const invalido = validarNombre(nombre);
    if (invalido) {
      setError(invalido);
      return;
    }
    setSaving(true); setError(''); setMensaje(null);
    try {
      if (modal?.mode === 'editar') {
        const actualizado = await tiposCanchaApi.editar(modal.tipo.id, nombre.trim(), foto);
        setTipos((actuales) => actuales.map((t) => (t.id === actualizado.id ? actualizado : t)));
        setMensaje(`"${actualizado.nombre}" actualizado correctamente`);
      } else {
        const nuevo = await tiposCanchaApi.crear(nombre.trim(), foto);
        setTipos((actuales) => [...actuales, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setMensaje(`"${nuevo.nombre}" creado correctamente`);
      }
      cerrarModal();
    } catch {
      setError(modal?.mode === 'editar' ? 'No se pudo actualizar el tipo.' : 'No se pudo crear el tipo. Revisá el nombre (máx. 60 caracteres).');
    } finally {
      setSaving(false);
    }
  }

  async function toggleEstado(tipo: TipoCanchaCatalogo) {
    setAccionId(tipo.id); setError(''); setMensaje(null);
    try {
      const actualizado = await tiposCanchaApi.cambiarEstado(tipo.id, !tipo.activo);
      setTipos((actuales) => actuales.map((t) => (t.id === actualizado.id ? actualizado : t)));
    } catch {
      setError('No se pudo cambiar el estado del tipo.');
    } finally {
      setAccionId(null);
    }
  }

  function mensajeBackend(e: unknown): string | null {
    const ax = e as { response?: { data?: { message?: string | string[] } } };
    const raw = ax.response?.data?.message;
    if (!raw) return null;
    return Array.isArray(raw) ? raw.join(', ') : raw;
  }

  async function eliminar(tipo: TipoCanchaCatalogo) {
    if (!window.confirm(`¿Eliminar "${tipo.nombre}" de verdad? Solo se puede si ninguna cancha lo usa.`)) return;
    setAccionId(tipo.id); setError(''); setMensaje(null);
    try {
      await tiposCanchaApi.eliminar(tipo.id);
      setTipos((actuales) => actuales.filter((t) => t.id !== tipo.id));
      setMensaje(`"${tipo.nombre}" eliminado correctamente`);
    } catch (e) {
      setError(mensajeBackend(e) ?? 'No se pudo eliminar el tipo.');
    } finally {
      setAccionId(null);
    }
  }

  const activos = tipos.filter((t) => t.activo).length;
  // Feedback inmediato: se muestra en cuanto el nombre deja de ser válido
  // (no reemplaza la validación del backend, solo evita el roundtrip).
  const errorNombre = nombre.trim() === '' ? null : validarNombre(nombre);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Tipos de cancha"
        action={
          <Button size="sm" onClick={abrirCrear}>
            <Plus size={16} /> Nuevo tipo
          </Button>
        }
      />
      <p className="-mt-4 mb-4 text-sm text-[#6B7280]">
        Catálogo de tipos (Paddle, Fútbol 5, Tenis…). Desactivar un tipo lo oculta sin borrar las canchas que lo usan.
      </p>

      {mensaje && (
        <p className="mb-4 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-sm text-[#15803D]">
          {mensaje}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard label="Tipos totales" value={String(tipos.length)} icon={LayoutGrid} iconColor="#8B2EFF" />
        <StatCard label="Activos" value={String(activos)} icon={CheckCircle2} iconColor="#16A34A" />
      </div>

      {loading ? (
        <p className="text-sm text-[#6B7280]">Cargando tipos…</p>
      ) : tipos.length === 0 ? (
        <Card className="py-6 text-center text-sm text-[#6B7280]">Sin tipos de cancha.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tipos.map((tipo) => (
            <article key={tipo.id} className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
              <div className="flex aspect-[16/7] items-center justify-center overflow-hidden bg-[#F3E8FF]">
                <img
                  src={tipo.imagenUrl ?? IMAGEN_FALLBACK}
                  alt={`Cancha de ${tipo.nombre}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-[#111111]">{tipo.nombre}</h2>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      tipo.activo ? 'bg-[#F0FDF4] text-[#15803D]' : 'bg-[#F3F4F6] text-[#6B7280]'
                    }`}
                  >
                    {tipo.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => abrirEditar(tipo)}
                    aria-label={`Editar ${tipo.nombre}`}
                    className="rounded-lg p-2 font-semibold text-[#6B7280] hover:text-[#8B2EFF]"
                    style={{ minHeight: 44, minWidth: 44 }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleEstado(tipo)}
                    disabled={accionId === tipo.id}
                    aria-label={tipo.activo ? `Desactivar ${tipo.nombre}` : `Activar ${tipo.nombre}`}
                    title={tipo.activo ? 'Desactivar (no se borra)' : 'Activar'}
                    className="rounded-lg p-2 font-semibold text-[#6B7280] hover:text-[#8B2EFF] disabled:opacity-50"
                    style={{ minHeight: 44, minWidth: 44 }}
                  >
                    <Power size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void eliminar(tipo)}
                    disabled={accionId === tipo.id}
                    aria-label={`Eliminar ${tipo.nombre}`}
                    title="Eliminar de verdad (solo si ninguna cancha lo usa)"
                    className="rounded-lg p-2 font-semibold text-[#6B7280] hover:text-[#DC2626] disabled:opacity-50"
                    style={{ minHeight: 44, minWidth: 44 }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 md:rounded-2xl md:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#111111]">
                  {modal.mode === 'editar' ? `Editar ${modal.tipo.nombre}` : 'Nuevo tipo de cancha'}
                </h2>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  {modal.mode === 'editar' ? 'Cambiá el nombre y/o reemplazá la foto.' : 'Se suma al catálogo sin tocar código.'}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                aria-label="Cerrar"
                className="rounded-lg p-1 text-[#6B7280] hover:text-[#111111]"
                style={{ minHeight: 44, minWidth: 44 }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={guardar} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-[#374151]">Nombre *</span>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  maxLength={60}
                  placeholder="Ej. Tenis"
                  className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 text-sm outline-none focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20"
                  style={{ minHeight: 44 }}
                />
                {errorNombre && <p className="mt-1 text-xs text-[#DC2626]">{errorNombre}</p>}
              </label>
              <div>
                <span className="text-sm font-medium text-[#374151]">Foto</span>
                {preview && (
                  <img src={preview} alt="Vista previa" className="mt-1.5 aspect-[16/7] w-full rounded-xl object-cover" />
                )}
                <label
                  className="mt-1.5 flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#D1D5DB] px-3 py-2.5 text-sm font-semibold text-[#6B7280] hover:border-[#8B2EFF] hover:text-[#8B2EFF]"
                >
                  <Plus size={16} /> {preview ? 'Cambiar foto' : 'Subir foto (jpg, png o webp, máx. 5MB)'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => elegirFoto(e.target.files?.[0])}
                  />
                </label>
                {preview && modal.mode === 'crear' && (
                  <p className="mt-1 text-xs text-[#6B7280]">Vista previa — se guarda al crear.</p>
                )}
              </div>
              {error && <p className="text-sm text-[#DC2626]">{error}</p>}
              <div className="flex gap-2">
                <Button variant="ghost" fullWidth onClick={cerrarModal}>Cancelar</Button>
                <Button type="submit" fullWidth disabled={saving || !nombre.trim() || errorNombre !== null}>
                  {saving ? 'Guardando…' : modal.mode === 'editar' ? 'Guardar cambios' : 'Crear tipo'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
