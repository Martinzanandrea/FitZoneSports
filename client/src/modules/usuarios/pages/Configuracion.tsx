import { useEffect, useRef, useState } from 'react';
import { Camera, LockKeyhole } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { usuariosApi } from '../usuarios.api';
import type { Usuario } from '../usuarios.types';
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { CambiarPasswordForm } from './CambiarPassword';
import { useTitulo } from '../../../shared/hooks/useTitulo';

export function Configuracion() {
  useTitulo('Mi cuenta');
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', telefono: '' });
  const [guardando, setGuardando] = useState(false);
  const [msgDatos, setMsgDatos] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setCargando(true);
    setError(false);
    usuariosApi
      .getOne(user.id)
      .then((u) => {
        setPerfil(u);
        setForm({
          nombre: u.nombre,
          apellido: u.apellido,
          email: u.email ?? '',
          telefono: u.telefono ?? '',
        });
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [user]);

  const iniciales = perfil
    ? `${perfil.nombre[0] ?? ''}${perfil.apellido[0] ?? ''}`.toUpperCase()
    : '';

  async function handleGuardarDatos(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setGuardando(true);
    setMsgDatos(null);
    try {
      const upd = await usuariosApi.actualizar(user.id, {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
      });
      setPerfil(upd);
      setMsgDatos({ type: 'ok', text: 'Datos actualizados.' });
    } catch {
      setMsgDatos({ type: 'err', text: 'No se pudieron guardar los cambios.' });
    } finally {
      setGuardando(false);
    }
  }

  function handleElegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFotoFile(file);
    setFotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubirFoto() {
    if (!user || !fotoFile) return;
    setSubiendoFoto(true);
    setMsgDatos(null);
    try {
      const upd = await usuariosApi.actualizarFoto(user.id, fotoFile);
      setPerfil(upd);
      setFotoFile(null);
      setFotoPreview(null);
      setMsgDatos({ type: 'ok', text: 'Foto actualizada.' });
    } catch {
      setMsgDatos({ type: 'err', text: 'No se pudo subir la foto. Revisá el formato y el tamaño.' });
    } finally {
      setSubiendoFoto(false);
    }
  }

  if (cargando) return <LoadingState rows={3} label="Cargando perfil" />;
  if (error)
    return (
      <ErrorState
        title="No pudimos cargar tu perfil"
        description="Revisá tu conexión e intentá de nuevo en unos segundos."
        onRetry={() => window.location.reload()}
      />
    );
  if (!perfil)
    return (
      <EmptyState
        title="No se pudo cargar tu perfil"
        description="Intentá recargar la página."
        icon={Camera}
      />
    );

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Mi cuenta</h2>
          <p>Datos personales, foto y seguridad.</p>
        </div>
      </div>

      {msgDatos && (
        <p
          role="status"
          style={{
            borderRadius: 12,
            border: `1px solid ${msgDatos.type === 'ok' ? 'rgba(140,242,166,.3)' : 'rgba(255,130,108,.3)'}`,
            background: msgDatos.type === 'ok' ? 'rgba(140,242,166,.08)' : 'rgba(255,130,108,.08)',
            padding: '12px 16px',
            fontSize: 12,
            marginBottom: 14,
          }}
        >
          {msgDatos.text}
        </p>
      )}

      <div className="form-panel">
        <SectionHeader title="Datos personales" description="Mantené tu información de contacto actualizada." />

        <div className="profile-head">
          {fotoPreview ?? perfil.fotoUrl ? (
            <span className="profile-photo">
              <img src={fotoPreview ?? perfil.fotoUrl ?? ''} alt="Foto de perfil" />
            </span>
          ) : (
            <span className="profile-photo" aria-hidden>
              {iniciales}
            </span>
          )}
          <div>
            <h2>
              {perfil.nombre} {perfil.apellido}
            </h2>
            <p>
              {perfil.tipoActor}
              {perfil.sede ? ` · ${perfil.sede.nombre}` : ''}
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleElegirFoto} aria-label="Elegir foto de perfil" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              <Camera size={16} aria-hidden /> Cambiar foto
            </button>
            {fotoFile && (
              <button className="btn btn-primary" onClick={() => void handleSubirFoto()} disabled={subiendoFoto}>
                {subiendoFoto ? 'Subiendo...' : 'Confirmar'}
              </button>
            )}
          </div>
          {fotoPreview && <p style={{ fontSize: 10, marginTop: 8 }}>Vista previa — confirmá para guardar.</p>}
        </div>

        <form onSubmit={(e) => void handleGuardarDatos(e)}>
          <div className="form-grid">
            <label>
              <span className="field-label">NOMBRE</span>
              <input
                className="field-input"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                aria-label="Nombre"
              />
            </label>
            <label>
              <span className="field-label">APELLIDO</span>
              <input
                className="field-input"
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                required
                aria-label="Apellido"
              />
            </label>
            <label>
              <span className="field-label">EMAIL</span>
              <input
                className="field-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                aria-label="Email"
              />
            </label>
            <label>
              <span className="field-label">TELÉFONO</span>
              <input
                className="field-input"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                aria-label="Teléfono"
              />
            </label>
            <label>
              <span className="field-label">DNI</span>
              <input className="field-input" value={perfil.dni ?? '—'} readOnly aria-label="DNI (solo lectura)" />
              <p style={{ fontSize: 10, marginTop: 6 }}>Para modificar tu DNI, contactá a recepción.</p>
            </label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={guardando} style={{ width: '100%', marginTop: 18 }}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>

        <div className="password-row">
          <div>
            <LockKeyhole size={20} aria-hidden />
            <span>
              <strong>Contraseña</strong>
              <small>Mantené tu cuenta segura</small>
            </span>
          </div>
        </div>
        <CambiarPasswordForm />
      </div>
    </>
  );
}
