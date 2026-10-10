import 'reflect-metadata';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { ROLES_KEY } from './auth/decorators/roles.decorator';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

// Auditoría automática de TODOS los controladores: ningún endpoint autenticado
// puede quedar sin @Roles (RolesGuard deja pasar a cualquier rol si no hay),
// ni usar @Roles sin RolesGuard (sería decorativo). Los públicos son una lista
// cerrada: sumar uno nuevo obliga a tocar este archivo y justificarlo.
const PUBLICOS = new Set([
  'AppController.getHello',
  'AuthController.login',
  'AuthController.logout',
  'CanchasController.findAllPublico',
  'ClasesController.resumenPublico',
  'PreciosController.findAllPublico',
  'SedesController.findAllPublico',
  'TiposCanchaController.findPublicos',
  'UsuariosController.create', // registro público (el rol lo fuerza el servicio)
  'UsuariosController.reenviarVerificacion',
  'UsuariosController.verificarEmail',
]);

function controladores(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) controladores(ruta, acc);
    else if (nombre.endsWith('.controller.ts')) acc.push(ruta);
  }
  return acc;
}

interface Endpoint {
  id: string;
  jwt: boolean;
  rolesGuard: boolean;
  roles: string[] | undefined;
}

function recolectar(): Endpoint[] {
  const salida: Endpoint[] = [];
  for (const archivo of controladores(__dirname)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modulo = require(archivo) as Record<string, unknown>;
    for (const valor of Object.values(modulo)) {
      if (typeof valor !== 'function') continue;
      if (Reflect.getMetadata(PATH_METADATA, valor) === undefined) continue;
      const proto = (valor as { prototype: Record<string, unknown> }).prototype;
      for (const nombre of Object.getOwnPropertyNames(proto)) {
        const handler = proto[nombre];
        if (typeof handler !== 'function') continue;
        if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined)
          continue;
        const guards = [
          ...((Reflect.getMetadata(GUARDS_METADATA, valor) as unknown[]) ?? []),
          ...((Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ??
            []),
        ];
        salida.push({
          id: `${(valor as { name: string }).name}.${nombre}`,
          jwt: guards.includes(JwtAuthGuard),
          rolesGuard: guards.includes(RolesGuard),
          roles: (Reflect.getMetadata(ROLES_KEY, handler) ??
            Reflect.getMetadata(ROLES_KEY, valor)) as string[] | undefined,
        });
      }
    }
  }
  return salida;
}

describe('Auditoría de endpoints: @Roles explícito en todos', () => {
  const endpoints = recolectar();

  it('encuentra los endpoints (la auditoría no está vacía)', () => {
    expect(endpoints.length).toBeGreaterThan(80);
  });

  it('todo endpoint autenticado tiene RolesGuard y al menos un rol', () => {
    const sinRoles = endpoints
      .filter((e) => e.jwt && (!e.rolesGuard || !e.roles?.length))
      .map((e) => e.id);
    expect(sinRoles).toEqual([]);
  });

  it('todo endpoint sin autenticación está en la lista cerrada de públicos', () => {
    const noListados = endpoints
      .filter((e) => !e.jwt && !PUBLICOS.has(e.id))
      .map((e) => e.id);
    expect(noListados).toEqual([]);
  });

  it('la lista de públicos no tiene entradas que ya no existen', () => {
    const ids = new Set(endpoints.map((e) => e.id));
    expect([...PUBLICOS].filter((p) => !ids.has(p))).toEqual([]);
  });
});
