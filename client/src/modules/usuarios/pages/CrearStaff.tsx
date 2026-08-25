import { type FormEvent, useState } from 'react';
import { usuariosApi } from '../usuarios.api';
import { TipoActor } from '../../../shared/types/enums';

export function CrearStaff() {
  const [form, setForm] = useState({
    tipoActor: TipoActor.RECEPCIONISTA as string,
    nombre: '',
    apellido: '',
    email: '',
    password: '',
  });
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setError(null);
    setSubmitting(true);
    try {
      const usuario = await usuariosApi.crearStaff(form as any);
      setMensaje(`${usuario.nombre} ${usuario.apellido} creado como ${usuario.tipoActor}`);
      setForm({ tipoActor: TipoActor.RECEPCIONISTA, nombre: '', apellido: '', email: '', password: '' });
    } catch {
      setError('No se pudo crear el usuario. Revisá los datos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-page">
      <h1>Dar de alta personal</h1>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Rol
          <select
            value={form.tipoActor}
            onChange={(e) => setForm({ ...form, tipoActor: e.target.value })}
          >
            <option value={TipoActor.RECEPCIONISTA}>Recepcionista</option>
            <option value={TipoActor.GERENTE}>Gerente</option>
          </select>
        </label>
        <label>
          Nombre
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
          />
        </label>
        <label>
          Apellido
          <input
            value={form.apellido}
            onChange={(e) => setForm({ ...form, apellido: e.target.value })}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </label>
        {mensaje && <p className="admin-form__success">{mensaje}</p>}
        {error && <p className="admin-form__error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear'}
        </button>
      </form>
    </div>
  );
}