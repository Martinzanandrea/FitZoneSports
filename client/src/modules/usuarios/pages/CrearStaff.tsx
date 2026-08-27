import { type FormEvent, useEffect, useState } from 'react';
import { usuariosApi } from '../usuarios.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { TipoActor } from '../../../shared/types/enums';

export function CrearStaff() {
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
    sedesApi.getAll().then(setSedes).catch(() => setSedes([]));
  }, []);

  const esRecepcionista = form.tipoActor === TipoActor.RECEPCIONISTA;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        sedeId: esRecepcionista && form.sedeId ? form.sedeId : undefined,
      };
      const usuario = await usuariosApi.crearStaff(payload as any);
      setMensaje(`${usuario.nombre} ${usuario.apellido} creado como ${usuario.tipoActor}`);
      setForm({ tipoActor: TipoActor.RECEPCIONISTA, nombre: '', apellido: '', email: '', password: '', sedeId: '' });
    } catch {
      setError('No se pudo crear el usuario. Revisá los datos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#111111] mb-6">Dar de alta personal</h1>
      <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-[#374151]">Rol</span>
          <select
            value={form.tipoActor}
            onChange={(e) => setForm({ ...form, tipoActor: e.target.value })}
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm
              focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
          >
            <option value={TipoActor.RECEPCIONISTA}>Recepcionista</option>
            <option value={TipoActor.GERENTE}>Gerente</option>
          </select>
        </label>

        {esRecepcionista && (
          <label className="block">
            <span className="text-sm font-medium text-[#374151]">Sede asignada</span>
            <select
              value={form.sedeId}
              onChange={(e) => setForm({ ...form, sedeId: e.target.value })}
              required
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm
                focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
            >
              <option value="">Seleccionar sede…</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium text-[#374151]">Nombre</span>
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm
              focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#374151]">Apellido</span>
          <input
            value={form.apellido}
            onChange={(e) => setForm({ ...form, apellido: e.target.value })}
            required
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm
              focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#374151]">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm
              focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#374151]">Contraseña</span>
          <input
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm
              focus:border-[#8B2EFF] focus:ring-2 focus:ring-[#8B2EFF]/20 outline-none"
          />
        </label>

        {mensaje && <p className="text-sm text-[#16A34A]">{mensaje}</p>}
        {error && <p className="text-sm text-[#DC2626]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold
            hover:bg-[#7A25E6] disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Creando…' : 'Crear'}
        </button>
      </form>
    </div>
  );
}