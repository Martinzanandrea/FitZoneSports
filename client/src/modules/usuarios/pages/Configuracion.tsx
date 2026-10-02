import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { usuariosApi } from '../usuarios.api';
import type { Usuario } from '../usuarios.types';
import { pagosApi } from '../../pagos/pagos.api';
import type { Pago } from '../../pagos/pagos.types';
import { Badge, Button, Card, PageHeader } from '../../../shared/components/ui';
import { CambiarPasswordForm } from './CambiarPassword';
import { useTitulo } from '../../../shared/hooks/useTitulo';

function concepto(p: Pago) {
  if (p.membresia) return 'Membresía';
  if (p.reservaClase) return 'Reserva de clase';
  if (p.reservaCancha) return 'Reserva de cancha';
  return 'Pago';
}

const inputCls =
  'mt-1.5 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]';

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
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setCargando(true);
    Promise.all([
      usuariosApi.getOne(user.id).catch(() => null),
      pagosApi.getPorUsuario(user.id, 1, 3).then((res) => res.data).catch(() => [] as Pago[]),
    ]).then(([u, ultimos]) => {
      if (u) {
        setPerfil(u);
        setForm({
          nombre: u.nombre,
          apellido: u.apellido,
          email: u.email,
          telefono: u.telefono ?? '',
        });
      }
      setPagos(ultimos);
    }).finally(() => setCargando(false));
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

  if (cargando) return <p className="text-sm text-[#6B7280]">Cargando configuración...</p>;
  if (!perfil) return <p className="text-sm text-[#B91C1C]">No se pudo cargar tu perfil.</p>;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Mi cuenta" />
      {msgDatos && <p className={`mb-4 rounded-lg border p-3 text-sm ${msgDatos.type === 'ok' ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'}`}>{msgDatos.text}</p>}

      <Card className="mb-6">
        <h2 className="text-base font-bold text-[#111111] mb-4">Foto de perfil</h2>
        <div className="flex items-center gap-4">
          {fotoPreview ?? perfil.fotoUrl ? (
            <img
              src={fotoPreview ?? perfil.fotoUrl ?? ''}
              alt="Foto de perfil"
              className="w-20 h-20 rounded-full object-cover border border-[#E5E7EB]"
            />
          ) : (
            <div className="flex items-center justify-center rounded-full font-bold text-lg text-white w-20 h-20 bg-[#8B2EFF]">
              {iniciales}
            </div>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleElegirFoto} />
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Camera size={14} /> Cambiar foto
              </Button>
              {fotoFile && (
                <Button size="sm" onClick={handleSubirFoto} disabled={subiendoFoto}>
                  {subiendoFoto ? 'Subiendo...' : 'Confirmar'}
                </Button>
              )}
            </div>
            {fotoPreview && <p className="text-xs text-[#6B7280] mt-1">Vista previa — confirmá para guardar.</p>}
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="text-base font-bold text-[#111111] mb-4">Datos personales</h2>
        <form onSubmit={handleGuardarDatos} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-[#374151]">Nombre
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required className={inputCls} style={{ minHeight: 44 }} />
            </label>
            <label className="block text-sm font-medium text-[#374151]">Apellido
              <input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required className={inputCls} style={{ minHeight: 44 }} />
            </label>
          </div>
          <label className="block text-sm font-medium text-[#374151]">Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className={inputCls} style={{ minHeight: 44 }} />
          </label>
          <label className="block text-sm font-medium text-[#374151]">Teléfono
            <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={inputCls} style={{ minHeight: 44 }} />
          </label>
          <div>
            <p className="text-sm font-medium text-[#374151]">DNI</p>
            <p className="mt-1.5 text-sm text-[#111111] font-semibold">{perfil.dni ?? '—'}</p>
            <p className="text-xs text-[#6B7280] mt-1">Para modificar tu DNI, contactá a recepción.</p>
          </div>
          <Button type="submit" disabled={guardando} fullWidth>{guardando ? 'Guardando...' : 'Guardar cambios'}</Button>
        </form>
      </Card>

      <Card className="mb-6">
        <h2 className="text-base font-bold text-[#111111] mb-4">Seguridad</h2>
        <CambiarPasswordForm />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#111111]">Últimos pagos</h2>
          <Link to="/pagos" className="text-sm font-semibold text-[#8B2EFF] hover:underline">Ver historial completo</Link>
        </div>
        {pagos.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Todavía no tenés pagos.</p>
        ) : (
          <div className="space-y-2">
            {pagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#111111] truncate">{concepto(p)}</p>
                  <p className="text-xs text-[#6B7280]">{new Date(p.creadoEn).toLocaleDateString('es-AR')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-[#111111]">${p.monto}</span>
                  <Badge variant={p.estado === 'APROBADO' ? 'green' : p.estado === 'RECHAZADO' ? 'red' : 'amber'}>{p.estado}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
