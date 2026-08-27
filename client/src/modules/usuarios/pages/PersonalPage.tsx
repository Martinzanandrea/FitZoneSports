import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { usuariosApi } from '../usuarios.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Usuario } from '../usuarios.types';
import type { Sede } from '../../sedes/sedes.types';
import { TipoActor } from '../../../shared/types/enums';

export function PersonalPage() {
  const [staff, setStaff] = useState<Usuario[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cambiando, setCambiando] = useState<string | null>(null);

  useEffect(() => {
    cargar();
    sedesApi.getAll().then(setSedes).catch(() => setSedes([]));
  }, []);

  function cargar() {
    usuariosApi.getStaff().then(setStaff).catch(() => setStaff([]));
  }

  async function handleCambiarSede(usuarioId: string, sedeId: string) {
    if (!sedeId) return;
    setCambiando(usuarioId);
    try {
      await usuariosApi.asignarSede(usuarioId, sedeId);
      cargar();
    } catch {
      alert('No se pudo reasignar la sede.');
    } finally {
      setCambiando(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Personal</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Recepcionistas y gerentes de la cadena</p>
        </div>
        <Link
          to="/admin/personal/nuevo"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#8B2EFF] text-white text-sm font-semibold hover:bg-[#7A25E6] transition-colors"
        >
          <UserPlus size={16} /> Nuevo
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#6B7280] uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Rol</th>
              <th className="px-5 py-3 font-medium">Sede</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id} className="border-b border-[#E5E7EB] last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-[#111111]">{u.nombre} {u.apellido}</p>
                  <p className="text-xs text-[#6B7280]">{u.email}</p>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      u.tipoActor === TipoActor.GERENTE
                        ? 'bg-[#F3E8FF] text-[#8B2EFF]'
                        : 'bg-[#F3F4F6] text-[#374151]'
                    }`}
                  >
                    {u.tipoActor}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {u.tipoActor === TipoActor.GERENTE ? (
                    <span className="text-xs text-[#6B7280]">Todas las sedes</span>
                  ) : (
                    <select
                      value={u.sede?.id ?? ''}
                      disabled={cambiando === u.id}
                      onChange={(e) => handleCambiarSede(u.id, e.target.value)}
                      className="px-2.5 py-1.5 rounded-md border border-[#E5E7EB] text-xs
                        focus:border-[#8B2EFF] focus:ring-1 focus:ring-[#8B2EFF]/30 outline-none"
                    >
                      <option value="">Sin asignar</option>
                      {sedes.map((s) => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 && (
          <p className="p-8 text-center text-sm text-[#6B7280]">Todavía no hay personal cargado.</p>
        )}
      </div>
    </div>
  );
}