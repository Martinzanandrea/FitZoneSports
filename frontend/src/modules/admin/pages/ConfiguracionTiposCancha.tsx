import { type FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, LayoutGrid, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { tiposCanchaApi } from '../../canchas/canchas.api';
import type { TipoCanchaCatalogo } from '../../canchas/canchas.types';
import { Badge } from '../../../shared/components/atoms';
import { MetricCard } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
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

function mensajeBackend(e: unknown): string | null {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  if (!raw) return null;
  return Array.isArray(raw) ? raw.join(', ') : raw;
}

type Modal = { mode: 'crear' } | { mode: 'editar'; tipo: TipoCanchaCatalogo } | null;

export function ConfiguracionTiposCancha() {
  useTitulo('Tipos de cancha');
  const [tipos, setTipos] = useState<TipoCanchaCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [nombre, setNombre] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accionId, setAccionId] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<TipoCanchaCatalogo | null>(null);

  useEffect(() => {
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setErrorCarga(false);
    tiposCanchaApi
      .listarTodos()
      .then((r) => viva && setTipos(r))
      .catch(() => viva && setErrorCarga(true))
      .finally(() => viva && setLoading(false));
    return () => {
      viva = false;
    };
  }, [recarga]);

  function cerrarModal() {
    setModal(null);
    setNombre('');
    setFoto(null);
    if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
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
    setSaving(true);
    setError('');
    setMensaje(null);
    try {
      if (modal?.mode === 'editar') {
        const actualizado = await tiposCanchaApi.editar(modal.tipo.id, nombre.trim(), foto);
        setTipos((actuales) => actuales.map((t) => (t.id === actualizado.id ? actualizado : t)));
        setMensaje(`"${actualizado.nombre}" actualizado correctamente.`);
      } else {
        const nuevo = await tiposCanchaApi.crear(nombre.trim(), foto);
        setTipos((actuales) => [...actuales, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setMensaje(`"${nuevo.nombre}" creado correctamente.`);
      }
      cerrarModal();
    } catch (err) {
      setError(mensajeBackend(err) ?? (modal?.mode === 'editar' ? 'No se pudo actualizar el tipo.' : 'No se pudo crear el tipo. Revisá el nombre (máx. 60 caracteres).'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleEstado(tipo: TipoCanchaCatalogo) {
    setAccionId(tipo.id);
    setMensaje(null);
    try {
      const actualizado = await tiposCanchaApi.cambiarEstado(tipo.id, !tipo.activo);
      setTipos((actuales) => actuales.map((t) => (t.id === actualizado.id ? actualizado : t)));
    } catch (e) {
      setMensaje(null);
      setError(mensajeBackend(e) ?? 'No se pudo cambiar el estado del tipo.');
    } finally {
      setAccionId(null);
    }
  }

  async function confirmarEliminar() {
    if (!aEliminar) return;
    setAccionId(aEliminar.id);
    setError('');
    try {
      await tiposCanchaApi.eliminar(aEliminar.id);
      setTipos((actuales) => actuales.filter((t) => t.id !== aEliminar.id));
      setMensaje(`"${aEliminar.nombre}" eliminado correctamente.`);
      setAEliminar(null);
    } catch (e) {
      // El backend responde 400 con el conteo si hay canchas que lo usan.
      setError(mensajeBackend(e) ?? 'No se pudo eliminar el tipo.');
    } finally {
      setAccionId(null);
    }
  }

  const activos = tipos.filter((t) => t.activo).length;
  const errorNombre = nombre.trim() === '' ? null : validarNombre(nombre);
  const sinDatos = loading && tipos.length === 0;

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Tipos de cancha</h2>
          <p>Catálogo de tipos (Paddle, Fútbol 5, Tenis…). Desactivar un tipo lo oculta sin borrar las canchas que lo usan.</p>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>
          <Plus size={16} aria-hidden /> Nuevo tipo
        </button>
      </div>

      {mensaje && (
        <p role="status" className="notice notice-ok" style={{ marginBottom: 14 }}>
          {mensaje}
        </p>
      )}
      {error && !modal && !aEliminar && (
        <p role="alert" className="notice notice-err" style={{ marginBottom: 14 }}>
          {error}
        </p>
      )}

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard label="Tipos totales" value={sinDatos ? '—' : String(tipos.length)} change="en el catálogo" icon={LayoutGrid} />
        <MetricCard label="Activos" value={sinDatos ? '—' : String(activos)} change="visibles al reservar" icon={CheckCircle2} />
      </div>

      {loading ? (
        <LoadingState rows={3} label="Cargando tipos" />
      ) : errorCarga ? (
        <ErrorState title="No pudimos cargar los tipos de cancha" onRetry={() => setRecarga((n) => n + 1)} />
      ) : tipos.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Sin tipos de cancha"
          description="Creá el primer tipo para poder dar de alta canchas."
          action={
            <button className="btn btn-primary" onClick={abrirCrear}>
              <Plus size={16} aria-hidden /> Nuevo tipo
            </button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {tipos.map((tipo) => (
            <article key={tipo.id} className="glass" style={{ borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ aspectRatio: '16 / 7', background: 'rgba(255,255,255,0.04)' }}>
                <img src={tipo.imagenUrl ?? IMAGEN_FALLBACK} alt={`Cancha de ${tipo.nombre}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <strong style={{ fontSize: 14, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tipo.nombre}</strong>
                  <Badge variant={tipo.activo ? 'success' : 'neutral'}>{tipo.activo ? 'Activo' : 'Inactivo'}</Badge>
                </div>
                <div className="inline-actions" style={{ marginTop: 'auto' }}>
                  <button className="btn btn-secondary" onClick={() => abrirEditar(tipo)} aria-label={`Editar ${tipo.nombre}`}>
                    <Pencil size={14} aria-hidden /> Editar
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => void toggleEstado(tipo)}
                    disabled={accionId === tipo.id}
                    aria-label={tipo.activo ? `Desactivar ${tipo.nombre}` : `Activar ${tipo.nombre}`}
                    title={tipo.activo ? 'Desactivar (no se borra)' : 'Activar'}
                  >
                    <Power size={14} aria-hidden /> {tipo.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ color: 'var(--coral)' }}
                    onClick={() => {
                      setError('');
                      setAEliminar(tipo);
                    }}
                    disabled={accionId === tipo.id}
                    aria-label={`Eliminar ${tipo.nombre}`}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !saving && cerrarModal()}>
          <form className="glass panel modal-card" role="dialog" aria-modal="true" aria-label={modal.mode === 'editar' ? 'Editar tipo' : 'Nuevo tipo'} onSubmit={guardar}>
            <SectionHeader
              title={modal.mode === 'editar' ? `Editar ${modal.tipo.nombre}` : 'Nuevo tipo de cancha'}
              description={modal.mode === 'editar' ? 'Cambiá el nombre y/o reemplazá la foto.' : 'Se suma al catálogo sin tocar código.'}
            />
            <div className="stack-gap">
              <label>
                <span className="field-label">NOMBRE *</span>
                <input className="field-input" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={60} placeholder="Ej. Tenis" />
                {errorNombre && <p style={{ marginTop: 6, fontSize: 11, color: 'var(--coral)' }}>{errorNombre}</p>}
              </label>
              <div>
                <span className="field-label">FOTO</span>
                {preview && <img src={preview} alt="Vista previa" style={{ aspectRatio: '16 / 7', width: '100%', objectFit: 'cover', borderRadius: 12, marginBottom: 8 }} />}
                <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  <Plus size={15} aria-hidden /> {preview ? 'Cambiar foto' : 'Subir foto (jpg, png o webp, máx. 5MB)'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => elegirFoto(e.target.files?.[0])} />
                </label>
                {preview && modal.mode === 'crear' && <p style={{ marginTop: 6, fontSize: 11 }}>Vista previa: se guarda al crear.</p>}
              </div>
              {error && (
                <p role="alert" className="notice notice-err">
                  {error}
                </p>
              )}
              <div className="inline-actions">
                <button type="submit" className="btn btn-primary" disabled={saving || !nombre.trim() || errorNombre !== null}>
                  {saving ? 'Guardando...' : modal.mode === 'editar' ? 'Guardar cambios' : 'Crear tipo'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={cerrarModal}>
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {aEliminar && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && accionId === null && setAEliminar(null)}>
          <div className="glass panel modal-card" role="alertdialog" aria-modal="true" aria-label="Eliminar tipo">
            <SectionHeader title="Eliminar tipo" />
            <p style={{ marginBottom: 14, fontSize: 13 }}>
              ¿Eliminar <strong style={{ color: 'var(--text)' }}>{aEliminar.nombre}</strong>? Solo se puede si ninguna cancha lo usa; si no, desactivalo.
            </p>
            {error && (
              <p role="alert" className="notice notice-err" style={{ marginBottom: 14 }}>
                {error}
              </p>
            )}
            <div className="inline-actions">
              <button className="btn btn-danger" disabled={accionId !== null} onClick={() => void confirmarEliminar()}>
                {accionId ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button className="btn btn-secondary" disabled={accionId !== null} onClick={() => setAEliminar(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
