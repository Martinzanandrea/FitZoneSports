import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../../src/entities';

// Conexión real a Postgres para las pruebas de integración (sin dobles).
export async function conectar(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: ALL_ENTITIES,
    synchronize: false,
    // Pool amplio: las pruebas de concurrencia abren varias transacciones a la vez.
    extra: { max: 20 },
  });
  return ds.initialize();
}

const HASH_DE_PRUEBA = '$2b$10$jMoR/Ev942johopriZfb2OruKceGTYLqQS.PmEVfEoJiE3YbON7wS';

let contador = 0;
const unico = () => `${Date.now()}${++contador}`;

export async function crearSede(ds: DataSource, aforo = 50): Promise<string> {
  const [fila] = await ds.query<{ id: string }[]>(
    `INSERT INTO sedes (nombre, direccion, aforo_maximo) VALUES ($1, 'Calle 1', $2) RETURNING id`,
    [`Sede ${unico()}`, aforo],
  );
  return fila.id;
}

export async function crearUsuario(
  ds: DataSource,
  tipo: 'SOCIO' | 'EXTERNO' | 'RECEPCIONISTA',
  sedeId: string,
): Promise<string> {
  const u = unico();
  const [fila] = await ds.query<{ id: string }[]>(
    `INSERT INTO usuarios (tipo_actor, dni, nombre, apellido, email, password_hash, sede_id, email_verificado)
     VALUES ($1, $2, 'Prueba', 'Integración', $3, $4, $5, true) RETURNING id`,
    [tipo, u.slice(-9), `${tipo.toLowerCase()}${u}@prueba.test`, HASH_DE_PRUEBA, sedeId],
  );
  return fila.id;
}

// Membresía vigente hoy (en fechas de Argentina) para un socio.
export async function darMembresiaVigente(
  ds: DataSource,
  usuarioId: string,
  sedeId: string,
): Promise<void> {
  await ds.query(
    `INSERT INTO membresias (usuario_id, plan, estado, fecha_inicio, fecha_fin, sede_alta_id)
     VALUES ($1, 'MENSUAL', 'ACTIVO',
             (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 1,
             (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + 29, $2)`,
    [usuarioId, sedeId],
  );
}

export async function crearCancha(ds: DataSource, sedeId: string): Promise<string> {
  const [tipo] = await ds.query<{ id: string }[]>(
    `SELECT id FROM tipos_cancha WHERE nombre = 'Paddle'`,
  );
  const [fila] = await ds.query<{ id: string }[]>(
    `INSERT INTO canchas (sede_id, nombre, tipo_id, costo_hora_base) VALUES ($1, $2, $3, 10000) RETURNING id`,
    [sedeId, `Cancha ${unico()}`, tipo.id],
  );
  return fila.id;
}

// Fecha (AAAA-MM-DD) dentro de n días, para turnos que todavía no empezaron.
export function enDias(n: number): string {
  const d = new Date(Date.now() + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}
