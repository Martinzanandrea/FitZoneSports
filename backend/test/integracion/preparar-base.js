// Deja la base de pruebas de integración en blanco y con el esquema al día,
// usando las mismas migraciones que producción (db/migrar.js). Corre una vez
// antes de toda la suite.
//
// La base sale de DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD y DB_NAME. Por
// seguridad se exige INTEGRACION_DB=true: así nunca se borra por error la
// base de desarrollo o la de Supabase.
const { execFileSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  if (process.env.INTEGRACION_DB !== 'true') {
    throw new Error(
      'Las pruebas de integración borran la base indicada en DB_*. ' +
        'Definí INTEGRACION_DB=true para confirmar que es una base de pruebas.',
    );
  }
  // Las variables tienen que venir del entorno (no de backend/.env, que apunta
  // a Supabase) y nunca a un host de Supabase.
  const host = process.env.DB_HOST ?? '';
  if (!host || !process.env.DB_NAME || host.includes('supabase')) {
    throw new Error(
      'Definí DB_HOST y DB_NAME de una base de pruebas local (no Supabase).',
    );
  }
  const migrar = path.join(__dirname, '..', '..', 'db', 'migrar.js');
  const opciones = { stdio: 'inherit', env: { ...process.env, DB_SSL: process.env.DB_SSL ?? 'false' } };
  execFileSync('node', [migrar, 'revertir', '999'], opciones);
  execFileSync('node', [migrar, 'subir'], opciones);
};
