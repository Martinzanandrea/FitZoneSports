import { useEffect, useState } from 'react';
import { adminApi, type AuditoriaRegistro } from '../admin.api';
import { sedesApi } from '../../sedes/sedes.api';
import type { Sede } from '../../sedes/sedes.types';
import { canchasApi } from '../../canchas/canchas.api';
import { clasesApi } from '../../clases/clases.api';
import { Badge, Card, Chip, SectionTitle, formatMoney } from '../../../shared/components/ui';

const TAB = { AUDITORIA: 'AUDITORIA', POR_SEDE: 'POR_SEDE' } as const;
type Tab = (typeof TAB)[keyof typeof TAB];

function accionVariant(accion: string) {
  const a = accion.toLowerCase();
  if (a.includes('crear')) return 'green' as const;
  if (a.includes('actualizar') || a.includes('asignar')) return 'violet' as const;
  if (a.includes('cancelar') || a.includes('desactivar') || a.includes('bloquear')) return 'red' as const;
  return 'gray' as const;
}

export function Reportes() {
  const [tab, setTab] = useState<Tab>(TAB.AUDITORIA);

  // auditoria tab
  const [regs, setRegs] = useState<AuditoriaRegistro[]>([]);
  const [entidad, setEntidad] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [loadingA, setLoadingA] = useState(true);
  const [errA, setErrA] = useState('');

  // por sede tab
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedeId, setSedeId] = useState<string>('');
  const [financiero, setFinanciero] = useState<{ total: number; sede: string } | null>(null);
  const [membresias, setMembresias] = useState<import('../admin.api').MembresiaPorSedeItem | null>(null);
  const [counts, setCounts] = useState<{ canchas: number; clases: number } | null>(null);
  const [loadingS, setLoadingS] = useState(false);
  const [errS, setErrS] = useState('');

  function cargarAuditoria() {
    setLoadingA(true); setErrA('');
    adminApi.getAuditoria({ entidad: entidad || undefined, desde: desde || undefined, hasta: hasta || undefined })
      .then(setRegs)
      .catch(() => setErrA('No se pudo cargar la auditoría.'))
      .finally(() => setLoadingA(false));
  }

  useEffect(() => {
    cargarAuditoria();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sedesApi.getAll().then((s) => {
      setSedes(s);
      if (s.length && !sedeId) setSedeId(s[0].id);
    }).catch(() => setSedes([]));
  }, [sedeId]);

  useEffect(() => {
    if (!sedeId) return;
    setLoadingS(true); setErrS(''); setFinanciero(null); setMembresias(null); setCounts(null);
    Promise.allSettled([
      adminApi.getReporteFinanciero(),
      adminApi.getMembresiasPorSede(sedeId),
      canchasApi.getAll(),
      clasesApi.getAll(),
    ]).then((results) => {
      const [finRes, membRes, canchasRes, clasesRes] = results;
      if (finRes.status === 'fulfilled') {
        const porSede = finRes.value.porSede.find((x) => x.sedeId === sedeId);
        if (porSede) setFinanciero({ total: porSede.total, sede: porSede.sede });
        else setFinanciero({ total: 0, sede: sedes.find((s) => s.id === sedeId)?.nombre ?? '' });
      } else setErrS((prev) => prev + ' Financiero no disponible.');
      if (membRes.status === 'fulfilled') {
        const arr = membRes.value;
        setMembresias(arr.length ? arr[0] : null);
      } else setErrS((prev) => prev + ' Membresías no disponibles.');
      if (canchasRes.status === 'fulfilled' && clasesRes.status === 'fulfilled') {
        const sede = sedes.find((s) => s.id === sedeId);
        const canchas = (canchasRes.value as unknown as { sede: { id: string } }[]).filter((c) => c.sede.id === sedeId).length;
        const clases = (clasesRes.value as unknown as { sede: { id: string } }[]).filter((c) => c.sede.id === sedeId).length;
        void sede;
        setCounts({ canchas, clases });
      }
      if (finRes.status === 'rejected' && membRes.status === 'rejected') setErrS('No se pudieron cargar reportes financieros/membresías.');
      setLoadingS(false);
    });
  }, [sedeId, sedes]);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-[#111111]">Reportes</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Auditoría y métricas por sede.</p>

      <div className="mt-6 flex gap-2">
        <Chip label="Auditoría" active={tab === TAB.AUDITORIA} onClick={() => setTab(TAB.AUDITORIA)} />
        <Chip label="Por sede" active={tab === TAB.POR_SEDE} onClick={() => setTab(TAB.POR_SEDE)} />
      </div>

      {tab === TAB.AUDITORIA && (
        <div className="mt-6 space-y-4">
          <Card>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className="text-sm font-medium text-[#374151]">Entidad
                <select value={entidad} onChange={(e) => setEntidad(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }}>
                  <option value="">Todas</option>
                  <option value="Sede">Sede</option>
                  <option value="Usuario">Usuario</option>
                  <option value="Cancha">Cancha</option>
                  <option value="Clase">Clase</option>
                  <option value="Pago">Pago</option>
                  <option value="Membresia">Membresia</option>
                  <option value="PrecioPlan">PrecioPlan</option>
                  <option value="Instructor">Instructor</option>
                </select>
              </label>
              <label className="text-sm font-medium text-[#374151]">Desde
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} />
              </label>
              <label className="text-sm font-medium text-[#374151]">Hasta
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF]" style={{ minHeight: 44 }} />
              </label>
              <div className="flex items-end">
                <button type="button" onClick={cargarAuditoria} className="w-full rounded-lg bg-[#8B2EFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7A25E6]" style={{ minHeight: 44 }}>Filtrar</button>
              </div>
            </div>
          </Card>

          {errA && <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{errA}</p>}
          {loadingA ? <p className="text-sm text-[#6B7280]">Cargando...</p> : regs.length === 0 ? <Card className="py-8 text-center text-sm text-[#6B7280]">Sin registros.</Card> : (
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#FAFAFA] text-xs uppercase tracking-wide text-[#6B7280]">
                    <tr><th className="px-4 py-3 text-left">Acción</th><th className="px-4 py-3 text-left">Entidad</th><th className="px-4 py-3 text-left">Actor</th><th className="px-4 py-3 text-left">Fecha</th></tr>
                  </thead>
                  <tbody>
                    {regs.map((r) => (
                      <tr key={r.id} className="border-t border-[#E5E7EB]">
                        <td className="px-4 py-3"><Badge variant={accionVariant(r.accion)}>{r.accion}</Badge></td>
                        <td className="px-4 py-3 text-[#111111]">{r.entidad}{r.entidadId ? ` · ${r.entidadId.slice(0,8)}` : ''}</td>
                        <td className="px-4 py-3 text-[#6B7280]">{r.actor ? `${r.actor.nombre} ${r.actor.apellido}` : '—'}</td>
                        <td className="px-4 py-3 text-[#6B7280]">{new Date(r.creadoEn).toLocaleString('es-AR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === TAB.POR_SEDE && (
        <div className="mt-6 space-y-4">
          <Card>
            <label className="text-sm font-medium text-[#374151]">Sede
              <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#8B2EFF] bg-white" style={{ minHeight: 44 }}>
                {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
          </Card>

          {loadingS ? <p className="text-sm text-[#6B7280]">Cargando métricas...</p> : (
            <>
              {errS && <p className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-sm text-[#92400E]">{errS}</p>}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card>
                  <SectionTitle>Ingresos</SectionTitle>
                  <p className="text-2xl font-bold text-[#111111]">{financiero ? formatMoney(financiero.total) : '—'}</p>
                  <p className="text-xs text-[#6B7280] mt-1">Del mes · {financiero?.sede ?? ''}</p>
                </Card>
                <Card>
                  <SectionTitle>Membresías</SectionTitle>
                  <p className="text-2xl font-bold text-[#111111]">{membresias ? membresias.socios.length : '—'}</p>
                  <div className="mt-2 space-y-1 text-xs text-[#6B7280]">
                    {membresias && (
                      <>
                        <div className="flex justify-between"><span>Activas</span><span className="font-semibold text-[#16A34A]">{membresias.activas}</span></div>
                        <div className="flex justify-between"><span>Vencidas</span><span className="font-semibold text-[#DC2626]">{membresias.vencidas}</span></div>
                        <div className="flex justify-between"><span>Suspendidas</span><span className="font-semibold text-[#6B7280]">{membresias.suspendidas}</span></div>
                      </>
                    )}
                  </div>
                </Card>
                <Card>
                  <SectionTitle>Infraestructura</SectionTitle>
                  <p className="text-sm text-[#6B7280]">Canchas: <span className="font-bold text-[#111111]">{counts?.canchas ?? '—'}</span></p>
                  <p className="text-sm text-[#6B7280]">Clases: <span className="font-bold text-[#111111]">{counts?.clases ?? '—'}</span></p>
                </Card>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
