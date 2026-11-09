import { ConflictException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { TypeOrmBookingCanchaRepository } from '../../src/canchas/booking-cancha.repository';
import { Usuario } from '../../src/entities';
import { TipoEstrategiaPrecio } from '../../src/entities/enums';
import {
  conectar,
  crearCancha,
  crearSede,
  crearUsuario,
  enDias,
} from './base-de-pruebas';

// RN-02 contra Postgres real: dos (o más) reservas simultáneas de la misma
// cancha, fecha y horario terminan con exactamente una confirmada. Se usa el
// repositorio real (transacción + SELECT ... FOR UPDATE sobre la cancha) y,
// por separado, se verifica la red de seguridad de la base: el índice único
// parcial uq_cancha_horario_confirmado.
describe('RN-02: reserva concurrente de canchas (Postgres real)', () => {
  let ds: DataSource;
  let repo: TypeOrmBookingCanchaRepository;
  let sedeId: string;

  beforeAll(async () => {
    ds = await conectar();
    repo = new TypeOrmBookingCanchaRepository(ds);
    sedeId = await crearSede(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  async function usuarios(n: number): Promise<Usuario[]> {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) ids.push(await crearUsuario(ds, 'SOCIO', sedeId));
    return ds.getRepository(Usuario).findBy({ id: In(ids) });
  }

  const datos = (canchaId: string, usuario: Usuario, fecha: string) => ({
    canchaId,
    usuario,
    fecha,
    horaInicio: '19:00',
    horaFin: '20:00',
    precioFinal: 11500,
    estrategiaPrecio: TipoEstrategiaPrecio.HORA_PICO,
  });

  it('10 reservas en el mismo instante: confirma una sola y el resto recibe 409', async () => {
    const canchaId = await crearCancha(ds, sedeId);
    const fecha = enDias(3);
    const socios = await usuarios(10);

    const resultados = await Promise.allSettled(
      socios.map((u) => repo.crearReservaSegura(datos(canchaId, u, fecha))),
    );

    const ok = resultados.filter((r) => r.status === 'fulfilled');
    const rechazadas = resultados.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(ok).toHaveLength(1);
    expect(rechazadas).toHaveLength(9);
    for (const r of rechazadas) {
      expect(r.reason).toBeInstanceOf(ConflictException);
    }

    const [{ total }] = await ds.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total FROM reservas_cancha
       WHERE cancha_id = $1 AND fecha = $2 AND estado = 'CONFIRMADA'`,
      [canchaId, fecha],
    );
    expect(total).toBe('1');
  });

  it('horarios distintos de la misma cancha no se bloquean entre sí', async () => {
    const canchaId = await crearCancha(ds, sedeId);
    const fecha = enDias(4);
    const [a, b] = await usuarios(2);

    const resultados = await Promise.allSettled([
      repo.crearReservaSegura(datos(canchaId, a, fecha)),
      repo.crearReservaSegura({ ...datos(canchaId, b, fecha), horaInicio: '20:00', horaFin: '21:00' }),
    ]);

    expect(resultados.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('la base rechaza un segundo INSERT confirmado aunque se saltee el servicio', async () => {
    const canchaId = await crearCancha(ds, sedeId);
    const fecha = enDias(5);
    const [a, b] = await usuarios(2);
    const insertar = (usuarioId: string) =>
      ds.query(
        `INSERT INTO reservas_cancha
           (cancha_id, usuario_id, fecha, hora_inicio, hora_fin, estrategia_precio, precio_final)
         VALUES ($1, $2, $3, '10:00', '11:00', 'ESTANDAR', 10000)`,
        [canchaId, usuarioId, fecha],
      );

    await insertar(a.id);
    await expect(insertar(b.id)).rejects.toMatchObject({ code: '23505' });
  });

  it('una reserva cancelada libera el horario', async () => {
    const canchaId = await crearCancha(ds, sedeId);
    const fecha = enDias(6);
    const [a, b] = await usuarios(2);

    const primera = await repo.crearReservaSegura(datos(canchaId, a, fecha));
    await ds.query(
      `UPDATE reservas_cancha SET estado = 'CANCELADA', cancelada_en = now() WHERE id = $1`,
      [primera.id],
    );

    await expect(
      repo.crearReservaSegura(datos(canchaId, b, fecha)),
    ).resolves.toBeDefined();
  });
});
