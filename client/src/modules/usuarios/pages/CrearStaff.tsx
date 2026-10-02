import { type FormEvent, useEffect, useState } from 'react';
import { usuariosApi } from '../usuarios.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { TipoActor } from '../../../shared/types/enums';
import { Select } from '../../../shared/components/Select';
import { useTitulo } from '../../../shared/hooks/useTitulo';

export function CrearStaff() {
  useTitulo('Nuevo personal');
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
    sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
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
          <div className="mt-1.5">
            <Select
              value={form.tipoActor}
              onChange={(v) => setForm({ ...form, tipoActor: v })}
              opciones={[
                { value: TipoActor.RECEPCIONISTA, label: 'Recepcionista' },
                { value: TipoActor.GERENTE, label: 'Gerente' },
              ]}
            />
          </div>
        </label>

        {esRecepcionista && (
          <label className="block">
            <span className="text-sm font-medium text-[#374151]">Sede asignada</span>
            <div className="mt-1.5">
              <Select
                value={form.sedeId}
                onChange={(v) => setForm({ ...form, sedeId: v })}
                required
                placeholder="Seleccionar sede…"
                opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
              />
            </div>
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