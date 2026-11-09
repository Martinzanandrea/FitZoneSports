import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AccesoService } from '../../src/acceso/acceso.service';
import { ControlAcceso, Membresia, Sede, Usuario } from '../../src/entities';
import { TipoActor } from '../../src/entities/enums';
import type { UsuarioAutenticado } from '../../src/auth/types/usuario-autenticado.type';
import {
  conectar,
  crearSede,
  crearUsuario,
  darMembresiaVigente,
} from './base-de-pruebas';

// RN-01 contra Postgres real: un socio no puede estar dentro de dos sedes a
// la vez. Se usa el AccesoService real con repositorios TypeORM reales: dos
// recepciones validan al mismo socio en el mismo instante, en sedes
// distintas, y solo una registra el ingreso. El índice único parcial
// uq_acceso_abierto_por_usuario es la garantía en la base.
describe('RN-01: un socio no puede estar en dos sedes a la vez (Postgres real)', () => {
  let ds: DataSource;
  let service: AccesoService;
  let sedeA: string;
  let sedeB: string;
  let recepA: UsuarioAutenticado;
  let recepB: UsuarioAutenticado;

  beforeAll(async () => {
    ds = await conectar();
    service = new AccesoService(
      ds.getRepository(ControlAcceso),
      ds.getRepository(Usuario),
      ds.getRepository(Sede),
      ds.getRepository(Membresia),
      new JwtService({ secret: 'secreto-de-integracion' }),
    );
    sedeA = await crearSede(ds);
    sedeB = await crearSede(ds);
    const recepcion = async (sedeId: string): Promise<UsuarioAutenticado> => ({
      id: await crearUsuario(ds, 'RECEPCIONISTA', sedeId),
      tipoActor: TipoActor.RECEPCIONISTA,
      email: 'recepcion@prueba.test',
      sedeId,
    });
    recepA = await recepcion(sedeA);
    recepB = await recepcion(sedeB);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  async function socioConMembresia(): Promise<string> {
    const id = await crearUsuario(ds, 'SOCIO', sedeA);
    await darMembresiaVigente(ds, id, sedeA);
    return id;
  }

  async function sesionesAbiertas(usuarioId: string): Promise<number> {
    const [{ total }] = await ds.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total FROM control_acceso
       WHERE usuario_id = $1 AND hora_egreso IS NULL`,
      [usuarioId],
    );
    return Number(total);
  }

  it('dos ingresos simultáneos en sedes distintas: entra por una sola', async () => {
    const socio = await socioConMembresia();
    // Dos QR distintos del mismo socio (por ejemplo, credenciales compartidas).
    const qr1 = (await service.generarQr(socio)).qrToken;
    const qr2 = (await service.generarQr(socio)).qrToken;

    const resultados = await Promise.allSettled([
      service.validarIngreso(qr1, sedeA, recepA),
      service.validarIngreso(qr2, sedeB, recepB),
    ]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazo = resultados.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(rechazo?.reason).toBeInstanceOf(ConflictException);
    expect(await sesionesAbiertas(socio)).toBe(1);
  });

  it('con una sesión abierta en la sede A, el ingreso en la sede B es 409', async () => {
    const socio = await socioConMembresia();
    await service.validarIngreso((await service.generarQr(socio)).qrToken, sedeA, recepA);

    await expect(
      service.validarIngreso((await service.generarQr(socio)).qrToken, sedeB, recepB),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await sesionesAbiertas(socio)).toBe(1);
  });

  it('después del egreso puede ingresar en otra sede (RF-03, acceso multi-sede)', async () => {
    const socio = await socioConMembresia();
    await service.validarIngreso((await service.generarQr(socio)).qrToken, sedeA, recepA);
    await service.registrarEgreso(socio, recepA);

    const ingreso = await service.validarIngreso(
      (await service.generarQr(socio)).qrToken,
      sedeB,
      recepB,
    );
    expect(ingreso.sede.id).toBe(sedeB);
    expect(await sesionesAbiertas(socio)).toBe(1);
  });

  it('la base rechaza una segunda sesión abierta aunque se saltee el servicio', async () => {
    const socio = await socioConMembresia();
    const insertar = (sedeId: string) =>
      ds.query(`INSERT INTO control_acceso (usuario_id, sede_id) VALUES ($1, $2)`, [
        socio,
        sedeId,
      ]);

    await insertar(sedeA);
    await expect(insertar(sedeB)).rejects.toMatchObject({ code: '23505' });
  });
});
