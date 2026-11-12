# Evidencia de requisitos no funcionales (FT1-117)

Un archivo por requisito. Cada uno separa lo **medido o verificado** de lo **pendiente**, y no declara aprobada ninguna prueba que no se haya ejecutado.

| Requisito | Archivo | Estado de la evidencia |
|---|---|---|
| RNF-01 · Acceso sin conexión | [RNF-01-acceso-sin-conexion.md](RNF-01-acceso-sin-conexion.md) | Pruebas automatizadas existentes; prueba manual ejecutada en producción el 11/11/2026 (camino feliz); **casos negativos y verificación en base sin ejecutar** |
| RNF-02 · Sin datos de tarjeta | [RNF-02-sin-datos-de-tarjeta.md](RNF-02-sin-datos-de-tarjeta.md) | Verificado en el esquema y en el código |
| RNF-03 · Latencia | [RNF-03-latencia.md](RNF-03-latencia.md) | Medido el 12/11/2026 en base local de prueba: consulta de disponibilidad con 200 repeticiones (p95 22,62 ms con reservas y 22,48 ms sin reservas) y otros cinco endpoints con 50; cumple el umbral propuesto de 300 ms (fijado por el equipo). **Falta:** medir con Node 22, con concurrencia y sobre un entorno desplegado |
| RNF-04 · Alta de sede sin detener el sistema | [RNF-04-alta-de-sede.md](RNF-04-alta-de-sede.md) | Verificación en ejecución pasada el 12/11/2026 en base local de prueba (un alta con la API en marcha, sonda de 17 consultas sin fallos, sede visible y sesión previa válida). **Falta:** repetirla con carga concurrente y en un entorno desplegado |
| Transversal · Secretos | [escaneo-secretos.md](escaneo-secretos.md) | Escaneo del historial completo |

Los scripts y los resultados medidos están en [`medicion/`](medicion/). Los scripts **escriben datos** en la base a la que apunta el backend: se niegan a correr sin `--base-de-prueba` y contra una API o base que no sea local. Nunca apuntarlos a Supabase ni a producción.
