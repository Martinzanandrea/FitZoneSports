/* Lista todos los endpoints con su guard y sus @Roles (solo lectura, no arranca el servidor).
 *   npx ts-node -r tsconfig-paths/register scripts/listar-endpoints.ts
 */
import 'reflect-metadata';
import { glob } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  const raiz = join(__dirname, '..', 'src');
  const archivos: string[] = [];
  for await (const f of glob('**/*.controller.ts', { cwd: raiz })) {
    archivos.push(join(raiz, f));
  }
  const filas: string[] = [];
  for (const archivo of archivos.sort()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modulo = require(archivo) as Record<string, unknown>;
    for (const valor of Object.values(modulo)) {
      if (typeof valor !== 'function') continue;
      const base = Reflect.getMetadata('path', valor) as string | undefined;
      if (base === undefined) continue;
      const proto = (valor as { prototype: Record<string, unknown> }).prototype;
      for (const nombre of Object.getOwnPropertyNames(proto)) {
        const h = proto[nombre];
        if (nombre === 'constructor' || typeof h !== 'function') continue;
        const metodo = Reflect.getMetadata('method', h) as number | undefined;
        if (metodo === undefined) continue;
        const ruta = Reflect.getMetadata('path', h) as string;
        const guards = [
          ...((Reflect.getMetadata('__guards__', valor) as { name: string }[]) ?? []),
          ...((Reflect.getMetadata('__guards__', h) as { name: string }[]) ?? []),
        ].map((g) => g.name);
        const roles = (Reflect.getMetadata('roles', h) ??
          Reflect.getMetadata('roles', valor)) as string[] | undefined;
        const verbo = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'][metodo] ?? String(metodo);
        filas.push(
          [
            `${verbo} /${base}/${ruta}`.replace(/\/+/g, '/').replace(/\/$/, ''),
            guards.includes('JwtAuthGuard') ? 'JWT' : 'PÚBLICO',
            roles ? roles.join(',') : '(sin @Roles)',
            `${(valor as { name: string }).name}.${nombre}`,
          ].join(' | '),
        );
      }
    }
  }
  console.log(filas.join('\n'));
}

void main();
