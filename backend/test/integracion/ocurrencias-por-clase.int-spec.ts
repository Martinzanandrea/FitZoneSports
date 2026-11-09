import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClasesService } from '../../src/clases/clases.service';
import { Clase, ClaseOcurrencia, Instructor, Sede } from '../../src/entities';
import { TipoActor } from '../../src/entities/enums';
import type { UsuarioAutenticado } from '../../src/auth/types/usuario-autenticado.type';
import { conectar, crearSede, crearUsuario, enDias } from './base-de-pruebas';

// GET /clases/ocurrencias: todas las clases visibles en una sola consulta.
// La pantalla de reservas del socio hacía un pedido por clase; con las 100
// clases de los datos de prueba superaba el límite de la API (429).
describe('Ocurrencias agrupadas por clase (Postgres real)', () => {
  let ds: DataSource;
  let service: ClasesService;
  let sedeA: string;
  let sedeB: string;
  let claseA: string;
  let claseInactiva: string;
  let claseB: string;

  const socio: UsuarioAutenticado = {
    id: 'socio',
    tipoActor: TipoActor.SOCIO,
    email: 's@prueba.test',
    sedeId: null,
  };

  beforeAll(async () => {
    ds = await conectar();
    service = new ClasesService(
      ds.getRepository(Clase),
      ds.getRepository(Sede),
      ds.getRepository(Instructor),
      ds.getRepository(ClaseOcurrencia),
      ds,
      {} as never,
      {} as never,
      { emit: () => true } as never,
    );
    sedeA = await crearSede(ds);
    sedeB = await crearSede(ds);
    const [instructor] = await ds.query<{ id: string }[]>(
      `INSERT INTO instructores (nombre) VALUES ('Instructor') RETURNING id`,
    );
    const clase = async (sedeId: string, activa: boolean) => {
      const [c] = await ds.query<{ id: string }[]>(
        `INSERT INTO clases (sede_id, tipo_clase, instructor_id, capacidad, horas_semanales_totales, activa)
         VALUES ($1, 'Yoga', $2, 10, 1, $3) RETURNING id`,
        [sedeId, instructor.id, activa],
      );
      for (const d of [1, 2, 3]) {
        await ds.query(
          `INSERT INTO clase_ocurrencia (clase_id, fecha, hora_inicio, hora_fin) VALUES ($1, $2, '10:00', '11:00')`,
          [c.id, enDias(d)],
        );
      }
      return c.id;
    };
    claseA = await clase(sedeA, true);
    claseInactiva = await clase(sedeA, false);
    claseB = await clase(sedeB, true);

    // Dos reservas en la primera fecha de la clase A.
    const [oc] = await ds.query<{ id: string }[]>(
      `SELECT id FROM clase_ocurrencia WHERE clase_id = $1 ORDER BY fecha LIMIT 1`,
      [claseA],
    );
    for (let i = 0; i < 2; i++) {
      const u = await crearUsuario(ds, 'SOCIO', sedeA);
      await ds.query(`INSERT INTO reservas_clase (ocurrencia_id, usuario_id) VALUES ($1, $2)`, [oc.id, u]);
    }
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('el socio ve las clases activas de todas las sedes, con el cupo ocupado', async () => {
    const r = await service.listarOcurrenciasPorClase(enDias(0), enDias(7), undefined, socio);

    expect(r[claseA]).toHaveLength(3);
    expect(r[claseB]).toHaveLength(3);
    expect(r[claseInactiva]).toBeUndefined();
    expect(r[claseA][0].cupoOcupado).toBe(2);
    expect(r[claseA][1].cupoOcupado).toBe(0);
  });

  it('el recepcionista queda acotado a su sede aunque pida otra', async () => {
    const recep: UsuarioAutenticado = {
      id: 'r',
      tipoActor: TipoActor.RECEPCIONISTA,
      email: 'r@prueba.test',
      sedeId: sedeB,
    };
    const r = await service.listarOcurrenciasPorClase(enDias(0), enDias(7), sedeA, recep);
    expect(Object.keys(r)).toContain(claseB);
    expect(r[claseA]).toBeUndefined();
  });

  it('rechaza rangos inválidos o de más de 31 días', async () => {
    await expect(
      service.listarOcurrenciasPorClase(enDias(0), enDias(40), undefined, socio),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.listarOcurrenciasPorClase('09/11/2026', enDias(1), undefined, socio),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
