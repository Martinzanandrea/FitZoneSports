import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usuariosApi } from '../usuarios.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import type { CrearStaffPayload } from '../usuarios.types';
import { TipoActor } from '../../../shared/types/enums';
import { useAuth } from '../../auth/AuthContext';
import { Select } from '../../../shared/components/Select';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { useTitulo } from '../../../shared/hooks/useTitulo';

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

export function CrearStaff() {
  useTitulo('Nuevo personal');
  const navigate = useNavigate();
  const { user } = useAuth();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;
  // El GS solo crea recepcionistas y siempre en su sede: sin selectores.
  const sedeFija = esGG ? null : user?.sedeId ?? null;

  const [form, setForm] = useState({
    tipoActor: TipoActor.RECEPCIONISTA as string,
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    sedeId: '',
  });
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!esGG) return;
    sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
  }, [esGG]);

  const requiereSede = form.tipoActor === TipoActor.RECEPCIONISTA || form.tipoActor === TipoActor.GERENTE_SEDE;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setError(null);
    if (!esGG && !sedeFija) {
      setError('Tu usuario no tiene una sede asignada.');
      return;
    }
    if (esGG && requiereSede && !form.sedeId) {
      setError('Elegí la sede.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: CrearStaffPayload = {
        tipoActor: (esGG ? form.tipoActor : TipoActor.RECEPCIONISTA) as CrearStaffPayload['tipoActor'],
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        password: form.password,
        sedeId: esGG ? (requiereSede ? form.sedeId : undefined) : sedeFija ?? undefined,
      };
      const usuario = await usuariosApi.crearStaff(payload);
      setMensaje(`${usuario.nombre} ${usuario.apellido} creado como ${usuario.tipoActor}.`);
      setForm({ tipoActor: TipoActor.RECEPCIONISTA, nombre: '', apellido: '', email: '', password: '', sedeId: '' });
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo crear el usuario. Revisá los datos.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>{esGG ? 'Dar de alta personal' : 'Nuevo recepcionista'}</h2>
          <p>{esGG ? 'Creá una cuenta de recepción o gerencia.' : 'Se crea en tu sede.'}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/personal')}>
          <ArrowLeft size={15} aria-hidden /> Volver
        </button>
      </div>

      <form className="glass panel" style={{ maxWidth: 480 }} onSubmit={handleSubmit}>
        <SectionHeader title="Datos de la cuenta" />
        <div className="stack-gap">
          {esGG && (
            <div>
              <span className="field-label">ROL</span>
              <Select
                value={form.tipoActor}
                onChange={(v) => setForm({ ...form, tipoActor: v })}
                ariaLabel="Rol"
                opciones={[
                  { value: TipoActor.RECEPCIONISTA, label: 'Recepcionista' },
                  { value: TipoActor.GERENTE_SEDE, label: 'Gerente de sede' },
                  { value: TipoActor.GERENTE_GENERAL, label: 'Gerente general' },
                ]}
              />
            </div>
          )}

          {esGG && requiereSede && (
            <div>
              <span className="field-label">SEDE ASIGNADA</span>
              <Select
                required
                value={form.sedeId}
                onChange={(v) => setForm({ ...form, sedeId: v })}
                placeholder="Seleccionar sede..."
                ariaLabel="Sede asignada"
                opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
              />
            </div>
          )}

          <label>
            <span className="field-label">NOMBRE</span>
            <input className="field-input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </label>
          <label>
            <span className="field-label">APELLIDO</span>
            <input className="field-input" required value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
          </label>
          <label>
            <span className="field-label">EMAIL</span>
            <input className="field-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            <span className="field-label">CONTRASEÑA (MÍN. 8 CARACTERES)</span>
            <input className="field-input" type="password" minLength={8} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>

          {mensaje && <p role="status" className="notice notice-ok">{mensaje}</p>}
          {error && <p role="alert" className="notice notice-err">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </form>
    </>
  );
}
