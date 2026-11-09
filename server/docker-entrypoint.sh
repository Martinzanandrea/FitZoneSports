#!/bin/sh
# Arranque del contenedor de la API: aplica las migraciones pendientes, carga
# los datos de prueba si la base está vacía (SEED=true) y levanta la API.
set -e

node db/migrar.js subir

if [ "${SEED:-false}" = "true" ]; then
  node db/migrar.js seed
fi

exec node dist/main.js
