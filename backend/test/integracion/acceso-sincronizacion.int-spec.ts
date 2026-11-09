import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AccesoService } from '../../src/acceso/acceso.service';
import { ClavesQrService } from '../../src/acceso/claves-qr.service';
import { ControlAcceso, Membresia, Sede, Usuario } from '../../src/entities';
import { TipoActor } from '../../src/entities/enums';
import type { UsuarioAutenticado } from '../../src/auth/types/usuario-autenticado.type';
import {
  conectar,
  crearSede,
  crearUsuario,
  darMembresiaVigente,
} from './base-de-pruebas';

// Sincronización de ingresos offline contra Postgres real: idempotencia por
// clientEventId, QR de un solo uso (uq_evento_offline_jti), una sola sesión
// abierta (uq_acceso_abierto_por_usuario) y observaciones por membresía.
// Los QR se firman con ClavesQrService con clave efímera, como los de la API.
describe('Sincronización de ingresos offline (Postgres real)', () => {
  let ds: DataSource;
  let service: AccesoService;
  let sede: string;
  let recep: UsuarioAutenticado;

  beforeAll(async () => {
    ds = await conectar();
    service = new AccesoService(
      ds.getRepository(ControlAcceso),
      ds.getRepository(Usuario),
      ds.getRepository(Sede),
      ds.getRepository(Membresia),
      new JwtService({ secret: 'secreto-de-integracion' }),
      new ClavesQrService({
        get: (k: string) => (k === 'QR_CLAVE_EFIMERA' ? 'true' : undefined),
      } as never),
    );
    sede = await crearSede(ds);
    recep = {
      id: await crearUsuario(ds, 'RECEPCIONISTA', sede),
      tipoActor: TipoActor.RECEPCIONISTA,
      email: 'recepcion@prueba.test',
      sedeId: sede,
    };
  });

  afterAll(async () => {
    await ds.destroy();
  });

  async function socio(): Promise<string> {
    const id = await crearUsuario(ds, 'SOCIO', sede);
    await darMembresiaVigente(ds, id, sede);
    return id;
  }

  // Un evento que el terminal registró hace unos segundos.
  async function eventoDe(usuarioId: string, clientEventId = randomUUID()) {
    const { qrToken } = await service.generarQr(usuarioId);
    return {
      clientEventId,
      qrToken,
      ocurridoEn: new Date(Date.now() - 5_000).toISOString(),
    };
  }

  const accesosDe = (usuarioId: string) =>
    ds.query<
      Array<{
        metodo_ingreso: string;
        validado_offline: boolean;
        sincronizado_en: Date | null;
        observacion: string | null;
      }>
    >(
      `SELECT metodo_ingreso, validado_offline, sincronizado_en, observacion
       FROM control_acceso WHERE usuario_id = $1`,
      [usuarioId],
    );

  const eventoGuardado = async (clientEventId: string) => {
    const filas = await ds.query<
      Array<{
        estado: string;
        codigo: string;
        usuario_id: string | null;
        qr_jti: string | null;
        acceso_id: string | null;
      }>
    >(
      `SELECT estado, codigo, usuario_id, qr_jti, acceso_id
       FROM eventos_acceso_offline WHERE client_event_id = $1`,
      [clientEventId],
    );
    return filas;
  };

  it('(a) reenviar el mismo lote no duplica ingresos', async () => {
    const id = await socio();
    const ev = await eventoDe(id);

    const [primero] = (await service.sincronizarIngresosOffline(sede, [ev], recep))
      .resultados;
    expect(primero).toMatchObject({ estado: 'CREADO', codigo: 'OK' });
    expect(primero.accesoId).toBeDefined();

    const [segundo] = (await service.sincronizarIngresosOffline(sede, [ev], recep))
      .resultados;
    expect(segundo).toMatchObject({
      estado: 'CREADO',
      codigo: 'YA_PROCESADO',
      accesoId: primero.accesoId,
    });

    const accesos = await accesosDe(id);
    expect(accesos).toHaveLength(1);
    expect(accesos[0]).toMatchObject({
      metodo_ingreso: 'QR_OFFLINE',
      validado_offline: true,
    });
    expect(accesos[0].sincronizado_en).not.toBeNull();
    expect(await eventoGuardado(ev.clientEventId)).toHaveLength(1);
  });

  it('(b) dos eventos del mismo usuario en un lote: CREADO y luego CONFLICTO / SESION_ABIERTA', async () => {
    const id = await socio();
    const a = await eventoDe(id);
    const b = await eventoDe(id);
    b.ocurridoEn = new Date(Date.now() - 2_000).toISOString();

    const { resultados } = await service.sincronizarIngresosOffline(
      sede,
      [a, b],
      recep,
    );
    expect(resultados[0]).toMatchObject({ estado: 'CREADO' });
    expect(resultados[1]).toMatchObject({
      estado: 'CONFLICTO',
      codigo: 'SESION_ABIERTA',
    });
    expect(resultados[1].accesoId).toBeUndefined();

    expect(await accesosDe(id)).toHaveLength(1);
    const [guardado] = await eventoGuardado(b.clientEventId);
    expect(guardado).toMatchObject({
      estado: 'CONFLICTO',
      codigo: 'SESION_ABIERTA',
      usuario_id: id,
      acceso_id: null,
    });
  });

  it('(c) el mismo jti en dos lotes con distinto clientEventId: CREADO y CONFLICTO / QR_REUSADO', async () => {
    const id = await socio();
    const a = await eventoDe(id);
    const b = { ...a, clientEventId: randomUUID() };

    const [primero] = (await service.sincronizarIngresosOffline(sede, [a], recep))
      .resultados;
    const [segundo] = (await service.sincronizarIngresosOffline(sede, [b], recep))
      .resultados;

    expect(primero).toMatchObject({ estado: 'CREADO' });
    expect(segundo).toMatchObject({ estado: 'CONFLICTO', codigo: 'QR_REUSADO' });
    expect(await accesosDe(id)).toHaveLength(1);
    const [guardado] = await eventoGuardado(b.clientEventId);
    expect(guardado).toMatchObject({ estado: 'CONFLICTO', codigo: 'QR_REUSADO' });
  });

  it('(d) membresía vencida al sincronizar: OBSERVADO con observacion', async () => {
    const id = await socio();
    const ev = await eventoDe(id);
    // El QR se emitió con la membresía vigente; vence antes de sincronizar.
    await ds.query(
      `UPDATE membresias SET estado = 'VENCIDO' WHERE usuario_id = $1`,
      [id],
    );

    const [r] = (await service.sincronizarIngresosOffline(sede, [ev], recep))
      .resultados;
    expect(r).toMatchObject({
      estado: 'OBSERVADO',
      codigo: 'MEMBRESIA_NO_VIGENTE',
    });
    expect(r.accesoId).toBeDefined();

    const accesos = await accesosDe(id);
    expect(accesos).toHaveLength(1);
    expect(accesos[0].observacion).toContain('Membresía');
    const [guardado] = await eventoGuardado(ev.clientEventId);
    expect(guardado).toMatchObject({
      estado: 'OBSERVADO',
      acceso_id: r.accesoId,
    });
  });

  it('el mismo QR sincronizado en paralelo desde dos terminales: uno CREADO y otro QR_REUSADO, sin errores', async () => {
    const id = await socio();
    const a = await eventoDe(id);
    const b = { ...a, clientEventId: randomUUID() };

    const [ra, rb] = await Promise.all([
      service.sincronizarIngresosOffline(sede, [a], recep),
      service.sincronizarIngresosOffline(sede, [b], recep),
    ]);
    const codigos = [ra.resultados[0], rb.resultados[0]].map(
      (r) => `${r.estado}/${r.codigo}`,
    );
    expect(codigos.sort()).toEqual(['CONFLICTO/QR_REUSADO', 'CREADO/OK']);
    expect(await accesosDe(id)).toHaveLength(1);
  });
});
