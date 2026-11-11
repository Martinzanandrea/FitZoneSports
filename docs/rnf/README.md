# Evidencia de requisitos no funcionales (FT1-117)

Un archivo por requisito. Cada uno separa lo **medido o verificado** de lo **pendiente**, y no declara aprobada ninguna prueba que no se haya ejecutado.

| Requisito | Archivo | Estado de la evidencia |
|---|---|---|
| RNF-01 · Acceso sin conexión | [RNF-01-acceso-sin-conexion.md](RNF-01-acceso-sin-conexion.md) | Pruebas automatizadas existentes; **prueba manual de punta a punta sin ejecutar** (casillas vacías) |
| RNF-02 · Sin datos de tarjeta | [RNF-02-sin-datos-de-tarjeta.md](RNF-02-sin-datos-de-tarjeta.md) | Verificado en el esquema y en el código |
| RNF-03 · Latencia | [RNF-03-latencia.md](RNF-03-latencia.md) | Script de medición listo; **sin cifras registradas** (la corrida completa no terminó) |
| RNF-04 · Alta de sede sin detener el sistema | [RNF-04-alta-de-sede.md](RNF-04-alta-de-sede.md) | Diseño y seed de 25 sedes; **verificación en ejecución sin correr** |
| Transversal · Secretos | [escaneo-secretos.md](escaneo-secretos.md) | Escaneo del historial completo |

Los scripts y los resultados medidos están en [`medicion/`](medicion/). Los scripts **escriben datos** en la base a la que apunta el backend: se niegan a correr sin `--base-de-prueba` y contra una API o base que no sea local. Nunca apuntarlos a Supabase ni a producción.
