import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Pencil, Search, UserMinus, UserPlus, Users } from 'lucide-react';
import { usuariosApi } from '../usuarios.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Usuario } from '../usuarios.types';
import type { Sede } from '../../sedes/sedes.types';
import { TipoActor } from '../../../shared/types/enums';
import { useAuth } from '../../auth/AuthContext';
import { Avatar, Badge } from '../../../shared/components/atoms';
import { Pagination } from '../../../shared/components/molecules';
import { Select } from '../../../shared/components/atoms';;
import { MetricCard } from '../../../shared/components/molecules';;
import { SectionHeader } from '../../../shared/components/molecules';;
import { EmptyState } from '../../../shared/components/molecules';;
import { ErrorState } from '../../../shared/components/molecules';;
import { LoadingState } from '../../../shared/components/molecules';;
import { useTitulo } from '../../../shared/hooks/useTitulo';

const ROL_LABEL: Record<string, string> = {
  RECEPCIONISTA: 'Recepcionista',
  GERENTE_SEDE: 'Gerente de sede',
  GERENTE_GENERAL: 'Gerente general',
};

function mensajeDe(e: unknown, porDefecto: string): string {
  const ax = e as { response?: { data?: { message?: string | string[] } } };
  const raw = ax.response?.data?.message;
  return Array.isArray(raw) ? raw.join(', ') : raw ?? porDefecto;
}

export function PersonalPage() {
  useTitulo('Personal');
  const navigate = useNavigate();
  const { user } = useAuth();
  const esGG = user?.tipoActor === TipoActor.GERENTE_GENERAL;

  const [staff, setStaff] = useState<Usuario[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStaff, setTotalStaff] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSede, setFiltroSede] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [cambiando, setCambiando] = useState<string | null>(null);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [formulario, setFormulario] = useState({ nombre: '', apellido: '', email: '', telefono: '', dni: '' });
  const [guardando, setGuardando] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');
  const [aBaja, setABaja] = useState<Usuario | null>(null);
  const [dandoBaja, setDandoBaja] = useState(false);
  const [errorBaja, setErrorBaja] = useState('');

  useEffect(() => {
    let viva = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError(false);
    usuariosApi
      .getStaff(page)
      .then((res) => {
        if (!viva) return;
        setStaff(res.data);
        setTotalPages(res.totalPages);
        setTotalStaff(res.total);
      })
      .catch(() => viva && setError(true))
      .finally(() => viva && setCargando(false));
    return () => {
      viva = false;
    };
  }, [page, recarga]);

  useEffect(() => {
    // Solo el GG reasigna sedes; el GS no necesita el catálogo.
    if (!esGG) return;
    sedesApi.getAll(1, 100).then((res) => setSedes(res.data)).catch(() => setSedes([]));
  }, [esGG]);

  const recepcionistas = useMemo(() => staff.filter((u) => u.tipoActor === TipoActor.RECEPCIONISTA), [staff]);
  const gerentes = staff.length - recepcionistas.length;
  const sedesSinRecep = useMemo(() => {
    const conRecep = new Set(recepcionistas.filter((r) => r.activo && r.sede?.id).map((r) => r.sede!.id));
    return sedes.filter((s) => !conRecep.has(s.id));
  }, [sedes, recepcionistas]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return staff.filter((u) => {
      if (esGG && filtroSede && u.sede?.id !== filtroSede) return false;
      if (!texto) return true;
      return `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(texto);
    });
  }, [staff, busqueda, filtroSede, esGG]);

  // Baja: el GG sobre cualquiera menos sí mismo; el GS solo recepcionistas (su lista ya es solo su sede).
  function puedeDarDeBaja(u: Usuario) {
    if (!u.activo || u.id === user?.id) return false;
    return esGG || u.tipoActor === TipoActor.RECEPCIONISTA;
  }

  async function handleCambiarSede(usuarioId: string, sedeId: string) {
    if (!sedeId) return;
    setCambiando(usuarioId);
    setMsg(null);
    try {
      await usuariosApi.asignarSede(usuarioId, sedeId);
      setMsg({ type: 'ok', text: 'Sede reasignada.' });
      setRecarga((n) => n + 1);
    } catch (e) {
      setMsg({ type: 'err', text: mensajeDe(e, 'No se pudo reasignar la sede.') });
    } finally {
      setCambiando(null);
    }
  }

  function abrirEdicion(u: Usuario) {
    setEditando(u);
    setErrorEdicion('');
    setFormulario({ nombre: u.nombre, apellido: u.apellido, email: u.email, telefono: u.telefono ?? '', dni: u.dni ?? '' });
  }

  async function guardarEdicion(event: FormEvent) {
    event.preventDefault();
    if (!editando) return;
    setGuardando(true);
    setErrorEdicion('');
    try {
      await usuariosApi.actualizar(editando.id, {
        nombre: formulario.nombre,
        apellido: formulario.apellido,
        email: formulario.email,
        telefono: formulario.telefono || undefined,
      });
      // El DNI va por su endpoint dedicado (el PATCH general lo rechaza).
      if (formulario.dni && formulario.dni !== (editando.dni ?? '')) {
        await usuariosApi.actualizarDni(editando.id, formulario.dni);
      }
      setEditando(null);
      setMsg({ type: 'ok', text: 'Datos actualizados.' });
      setRecarga((n) => n + 1);
    } catch (e) {
      setErrorEdicion(mensajeDe(e, 'No se pudieron guardar los cambios. Revisá los datos.'));
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarBaja() {
    if (!aBaja) return;
    setDandoBaja(true);
    setErrorBaja('');
    try {
      await usuariosApi.desactivar(aBaja.id);
      setMsg({ type: 'ok', text: `${aBaja.nombre} ${aBaja.apellido} fue dado de baja.` });
      setABaja(null);
      setRecarga((n) => n + 1);
    } catch (e) {
      setErrorBaja(mensajeDe(e, 'No se pudo dar de baja.'));
    } finally {
      setDandoBaja(false);
    }
  }

  const sinDatos = cargando && staff.length === 0;
  const cols = esGG ? '2fr 1fr 1.4fr 0.8fr 1.2fr' : '2fr 1fr 0.8fr 1.2fr';

  return (
    <>
      <div className="welcome-line">
        <div>
          <h2>Personal</h2>
          <p>{esGG ? 'Recepcionistas y gerentes de la cadena.' : 'Recepcionistas de tu sede.'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/personal/nuevo')}>
          <UserPlus size={16} aria-hidden /> {esGG ? 'Nuevo integrante' : 'Nuevo recepcionista'}
        </button>
      </div>

      {msg && (
        <p role="status" className={`notice ${msg.type === 'ok' ? 'notice-ok' : 'notice-err'}`} style={{ marginBottom: 14 }}>
          {msg.text}
        </p>
      )}

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 14 }}>
        <MetricCard label="Total de personal" value={sinDatos ? '—' : String(totalStaff)} change={esGG ? 'en la cadena' : 'en tu sede'} icon={Users} />
        <MetricCard label="Recepcionistas" value={sinDatos ? '—' : String(recepcionistas.length)} change="en esta página" icon={UserPlus} />
        {esGG && (
          <>
            <MetricCard label="Gerentes" value={sinDatos ? '—' : String(gerentes)} change="en esta página" icon={Users} />
            <MetricCard
              label="Sedes sin recepcionista"
              value={sinDatos || sedes.length === 0 ? '—' : String(sedesSinRecep.length)}
              change={sedesSinRecep.length ? sedesSinRecep.map((s) => s.nombre).join(', ') : 'todas cubiertas'}
              icon={Building2}
            />
          </>
        )}
      </div>

      <section className="glass panel" aria-label="Listado de personal">
        <div className="filters" style={{ boxShadow: 'none', marginBottom: 14 }}>
          {esGG && (
            <div className="select-field">
              <span className="field-label">SEDE</span>
              <Select
                value={filtroSede}
                onChange={setFiltroSede}
                placeholder="Todas las sedes"
                ariaLabel="Filtrar por sede"
                opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
              />
            </div>
          )}
          <div className="select-field">
            <span className="field-label">BUSCAR</span>
            <label className="search search-wide">
              <Search size={15} aria-hidden />
              <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o email..." aria-label="Buscar personal" />
            </label>
          </div>
        </div>

        {cargando ? (
          <LoadingState rows={4} label="Cargando personal" />
        ) : error ? (
          <ErrorState title="No pudimos cargar el personal" onRetry={() => setRecarga((n) => n + 1)} />
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={Users}
            title={staff.length === 0 ? 'Todavía no hay personal cargado' : 'Nadie coincide con el filtro'}
            description={staff.length === 0 ? 'Dá de alta al primer integrante.' : 'Probá con otra sede o búsqueda.'}
          />
        ) : (
          <div className="ops-table" style={{ ['--cols' as string]: cols }}>
            <div className="ops-row ops-head">
              <span>NOMBRE</span>
              <span>ROL</span>
              {esGG && <span>SEDE</span>}
              <span>ESTADO</span>
              <span />
            </div>
            {filtrados.map((u) => (
              <div className="ops-row" key={u.id} style={u.activo ? undefined : { opacity: 0.55 }}>
                <div className="person-cell">
                  <Avatar name={`${u.nombre} ${u.apellido}`} size={34} />
                  <span>
                    <strong>
                      {u.nombre} {u.apellido}
                      {!u.activo && (
                        <span style={{ marginLeft: 8, verticalAlign: 'middle' }}>
                          <Badge variant="neutral">Baja</Badge>
                        </span>
                      )}
                    </strong>
                    <small>{u.email}</small>
                  </span>
                </div>
                <span data-label="ROL">{ROL_LABEL[u.tipoActor] ?? u.tipoActor}</span>
                {esGG && (
                  <span data-label="SEDE">
                    {u.tipoActor === TipoActor.GERENTE_GENERAL ? (
                      'Todas las sedes'
                    ) : (
                      <Select
                        value={u.sede?.id ?? ''}
                        disabled={cambiando === u.id || !u.activo}
                        onChange={(v) => void handleCambiarSede(u.id, v)}
                        placeholder="Sin asignar"
                        ariaLabel={`Sede de ${u.nombre} ${u.apellido}`}
                        opciones={sedes.map((s) => ({ value: s.id, label: s.nombre }))}
                      />
                    )}
                  </span>
                )}
                <span>
                  <Badge variant={u.activo ? 'success' : 'neutral'}>{u.activo ? 'Activo' : 'De baja'}</Badge>
                </span>
                <span className="ops-cell-actions">
                  <button className="btn btn-secondary" onClick={() => abrirEdicion(u)}>
                    <Pencil size={14} aria-hidden /> Editar
                  </button>
                  {puedeDarDeBaja(u) && (
                    <button
                      className="btn btn-secondary"
                      style={{ color: 'var(--coral)' }}
                      onClick={() => {
                        setErrorBaja('');
                        setABaja(u);
                      }}
                    >
                      <UserMinus size={14} aria-hidden /> Baja
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>

      {editando && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setEditando(null)}>
          <form className="glass panel modal-card" role="dialog" aria-modal="true" aria-label="Editar personal" onSubmit={guardarEdicion}>
            <SectionHeader title="Editar personal" description="Actualizá los datos de la cuenta." />
            <div className="stack-gap">
              <label>
                <span className="field-label">NOMBRE</span>
                <input className="field-input" required value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} />
              </label>
              <label>
                <span className="field-label">APELLIDO</span>
                <input className="field-input" required value={formulario.apellido} onChange={(e) => setFormulario({ ...formulario, apellido: e.target.value })} />
              </label>
              <label>
                <span className="field-label">EMAIL</span>
                <input className="field-input" type="email" required value={formulario.email} onChange={(e) => setFormulario({ ...formulario, email: e.target.value })} />
              </label>
              <label>
                <span className="field-label">DNI</span>
                <input className="field-input" value={formulario.dni} onChange={(e) => setFormulario({ ...formulario, dni: e.target.value })} />
              </label>
              <label>
                <span className="field-label">TELÉFONO</span>
                <input className="field-input" value={formulario.telefono} onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })} />
              </label>
              {errorEdicion && <p role="alert" className="notice notice-err">{errorEdicion}</p>}
              <div className="inline-actions">
                <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {aBaja && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !dandoBaja && setABaja(null)}>
          <div className="glass panel modal-card" role="alertdialog" aria-modal="true" aria-label="Dar de baja">
            <SectionHeader title="Dar de baja" />
            <p style={{ marginBottom: 14, fontSize: 13 }}>
              ¿Dar de baja a <strong style={{ color: 'var(--text)' }}>{aBaja.nombre} {aBaja.apellido}</strong>? Va a dejar de poder ingresar al sistema.
            </p>
            {errorBaja && <p role="alert" className="notice notice-err" style={{ marginBottom: 14 }}>{errorBaja}</p>}
            <div className="inline-actions">
              <button className="btn btn-danger" disabled={dandoBaja} onClick={() => void confirmarBaja()}>{dandoBaja ? 'Procesando...' : 'Sí, dar de baja'}</button>
              <button className="btn btn-secondary" disabled={dandoBaja} onClick={() => setABaja(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
