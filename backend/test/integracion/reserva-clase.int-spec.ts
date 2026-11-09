import { DataSource, In } from 'typeorm';
import { TypeOrmBookingClaseRepository } from '../../src/clases/booking-clase.repository';
import { Usuario } from '../../src/entities';
import { EstadoResClase } from '../../src/entities/enums';
import { conectar, crearSede, crearUsuario, enDias } from './base-de-pruebas';

// Mismo criterio que RN-02, aplicado al cupo de una clase (RF-07, RF-08):
// cuando muchos socios reservan a la vez el último lugar, la base termina con
// exactamente "capacidad" reservas y el resto queda en lista de espera.
describe('Cupo de clases bajo concurrencia (Postgres real)', () => {
  let ds: DataSource;
  let repo: TypeOrmBookingClaseRepository;
  let sedeId: string;

  beforeAll(async () => {
    ds = await conectar();
    repo = new TypeOrmBookingClaseRepository(ds);
    sedeId = await crearSede(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  async function ocurrenciaConCapacidad(capacidad: number): Promise<string> {
    const [instructor] = await ds.query<{ id: string }[]>(
      `INSERT INTO instructores (nombre) VALUES ('Instructor de prueba') RETURNING id`,
    );
    const [clase] = await ds.query<{ id: string }[]>(
      `INSERT INTO clases (sede_id, tipo_clase, instructor_id, capacidad, horas_semanales_totales)
       VALUES ($1, 'Spinning', $2, $3, 1) RETURNING id`,
      [sedeId, instructor.id, capacidad],
    );
    const [oc] = await ds.query<{ id: string }[]>(
      `INSERT INTO clase_ocurrencia (clase_id, fecha, hora_inicio, hora_fin)
       VALUES ($1, $2, '19:00', '20:00') RETURNING id`,
      [clase.id, enDias(2)],
    );
    return oc.id;
  }

  it('12 socios a la vez para 5 lugares: 5 reservadas y 7 en lista de espera', async () => {
    const ocurrenciaId = await ocurrenciaConCapacidad(5);
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) ids.push(await crearUsuario(ds, 'SOCIO', sedeId));
    const socios = await ds.getRepository(Usuario).findBy({ id: In(ids) });

    const reservas = await Promise.all(
      socios.map((usuario) => repo.reservarSegura({ ocurrenciaId, usuario })),
    );

    const reservadas = reservas.filter((r) => r.estado === EstadoResClase.RESERVADA);
    const enEspera = reservas.filter((r) => r.estado === EstadoResClase.LISTA_ESPERA);
    expect(reservadas).toHaveLength(5);
    expect(enEspera).toHaveLength(7);

    const [{ total }] = await ds.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total FROM reservas_clase
       WHERE ocurrencia_id = $1 AND estado = 'RESERVADA'`,
      [ocurrenciaId],
    );
    expect(total).toBe('5');
  });

  it('el mismo socio dos veces a la vez: una reserva y un 409', async () => {
    const ocurrenciaId = await ocurrenciaConCapacidad(10);
    const usuario = await ds
      .getRepository(Usuario)
      .findOneByOrFail({ id: await crearUsuario(ds, 'SOCIO', sedeId) });

    const resultados = await Promise.allSettled([
      repo.reservarSegura({ ocurrenciaId, usuario }),
      repo.reservarSegura({ ocurrenciaId, usuario }),
    ]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
