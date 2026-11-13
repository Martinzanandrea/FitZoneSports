# Bitácora — Retamoso, Máximo — Rol P4

Bitácora individual según la plantilla del Anexo C. Organizo las sesiones por el sprint cuya ventana contiene la fecha de cada una (ventanas de `docs/planificacion`). Cuando la actividad es de otra unidad que la del sprint, lo aclaro al inicio de la entrada. La fecha de cada entrada es la de la actividad registrada. Cuando el commit o el cierre de Jira ocurrió después, lo indico como evidencia posterior.

Usuario de Git: `maxi` (maxiretamosotrotta@gmail.com).

Distingo mis implementaciones de las tareas en las que participé definiendo reglas, revisando o probando código integrado por otro integrante. Los commits del equipo permiten localizar ese resultado, pero no acreditan por sí solos la fecha ni las horas de mi participación. Conservo las horas de las sesiones ya registradas; no las calculo a partir de la cantidad de commits. Las ampliaciones de este documento explican esas sesiones y no representan sesiones adicionales.

## Sprint 1 — Arquitectura — Unidad I — 2026-08-13 al 2026-08-27

### 2026-08-24 · 3 h

**Tarjeta(s) Jira:** FT1-9 (2 pts) y FT1-16 (3 pts), ambas asignadas a MR

**Actividad**

Participé del debate grupal sobre Monolito Modular vs Microservicios (FT1-9). Sostuve las transacciones ACID para RN-02 como criterio decisivo: si dos personas intentan reservar el mismo turno, no alcanza con que ambas consultas de disponibilidad respondan correctamente; la comprobación y la escritura tienen que quedar coordinadas. Relacioné esa necesidad con el tamaño reducido del equipo y el tiempo disponible para integrar y desplegar el sistema.

La alternativa de separar servicios permitía desplegar y escalar cada dominio por separado, pero agregaba coordinación entre reservas y pagos. El monolito modular nos permitía mantener esos cambios dentro de una transacción local. El costo aceptado fue desplegar y escalar la API como una unidad y sostener los límites entre módulos mediante el diseño del código.

**Decisión**

Acordamos un monolito modular con NestJS, documentado en [ADR-001](../adr/ADR-001-estilo-arquitectonico.md) (en esa fecha, ADR-0002) (FT1-16). El criterio fue simplificar la garantía transaccional: los bloqueos y las restricciones de la base siguen siendo necesarios.

**Problema o bloqueo**

Al principio hubo posiciones distintas en el equipo. Acordamos una matriz que comparó integridad transaccional, tamaño del equipo y complejidad de despliegue.

**Commits**

La evidencia vinculada a esta sesión figura en los commits del equipo que se detallan abajo.

**Evidencia del equipo**

- `e22cde0` Adrs (martin)

Trabajo de diseño: el debate y el contenido del [ADR-001](../adr/ADR-001-estilo-arquitectonico.md) (en esa fecha, ADR-0002) se acordaron con el equipo por mensajes; el ADR lo integró Martín al repositorio.

---

## Sprint 2 — Frameworks — Unidad II — 2026-09-03 al 2026-09-17

### 2026-09-10 · 4 h

**Tarjeta(s) Jira:** FT1-37 (4 pts)

**Actividad**

Definición de las reglas del módulo de Gimnasio y Acceso (RF-04, RF-05, RN-01) junto con Martín: QR dinámico que vence a los 60 segundos, código corto de 6 dígitos de un solo uso como alternativa, control de aforo por sede y sesión única por usuario. Martín implementó el módulo; yo lo probé con cuentas de prueba (generación del QR, validación por código y aforo) y le reporté los ajustes necesarios.

Separé tres responsabilidades al revisar el recorrido: emitir una credencial temporal para el socio, decidir si corresponde autorizar el ingreso y reflejar la ocupación de la sede. Poder generar un QR no demuestra que el ingreso deba aceptarse: al usarlo todavía tienen que cumplirse la vigencia de la membresía, el aforo y la ausencia de otra sesión abierta. El código corto permite completar el ingreso cuando no se utiliza la cámara, pero no debe saltear esas reglas.

**Decisión**

JWT firmado de corta vida con revalidación en el servidor, en vez de un QR estático que se puede fotografiar y compartir.

**Problema o bloqueo**

Entre emitir el QR y escanearlo podían pasar hasta 60 segundos. Si la membresía vencía en ese lapso, la firma todavía podía ser válida. Por eso acordamos volver a consultar la membresía al registrar el ingreso. Para calcular el aforo se cuentan las sesiones abiertas de la sede. El índice único parcial cumple otra función: impide que el mismo usuario tenga dos sesiones abiertas.

**Commits**

La evidencia vinculada a esta sesión figura en los commits del equipo que se detallan abajo.

**Evidencia del equipo**

- `7862d54` Creacion de modulos y entidades (martin)
- `23cf2ff` fix: consistencia de layout en panel Gerente, bugs de sede-scope y métricas de accesos (martin)
- `f4bbfdc` feat: verificación de email, panel de Socio completo, QR con código corto, y fixes pre-producción (martin)

---

### 2026-09-12 · 5 h

**Tarjeta(s) Jira:** FT1-40 (6 pts) y FT1-42 (5 pts)

**Actividad**

Definición con Martín del funcionamiento de los pagos (RF-13, RF-14) y de los módulos de soporte (sedes, franjas, precios e instructores): pasarela simulada que devuelve un token, membresía creada solo con el pago aprobado, paso de externo a socio y comprobante PDF por pago. Martín los implementó; yo los probé con cuentas de prueba (pago de membresía, pago de cancha, comprobante, alta de sedes y precios).

Revisé el pago como un recorrido entre módulos: el importe sale de las reglas del servidor, la pasarela simulada informa aprobación o rechazo y el comprobante permite consultar el resultado. También relacioné sedes, franjas y precios con las reservas: son datos que condicionan qué se puede reservar y cuánto corresponde cobrar. Mi aporte fue la definición y la comprobación funcional; la implementación de los servicios corresponde a Martín.

**Decisión**

Sostuve que los montos se calculen en el servidor: una modificación del cuerpo enviado por el navegador no debe alterar el precio de la reserva. Las clases quedan incluidas en la membresía y su reserva requiere vigencia (RN-03). Las decisiones se desarrollan en [ADR-010](../adr/ADR-010-medios-de-pago-y-tokenizacion.md), [ADR-015](../adr/ADR-015-flujo-membresia-y-pago.md) y [ADR-016](../adr/ADR-016-montos-calculados-en-servidor.md).

**Problema o bloqueo**

El doble clic al pagar podía cobrar dos veces. Martín lo resolvió con un bloqueo de la fila y verificando si ya había un pago (el segundo intento recibe 409); en las pruebas verifiqué que no se duplica el cobro.

Ese resultado no acredita cualquier combinación de compra y reintento. El reporte posterior del 13/10 distingue la compra con cuenta nueva del doble clic con membresía vigente y deja pendiente el doble clic sin membresía. Conservo esa limitación para no presentar una comprobación parcial como prueba general de idempotencia.

**Commits**

La evidencia vinculada a esta sesión figura en los commits del equipo que se detallan abajo.

**Evidencia del equipo**

- `7862d54` Creacion de modulos y entidades (martin)
- `13b0d95` feat: selectores personalizados, catálogo de tipos de cancha completo, y diseño del rol Gerente de Sede (martin)
- `f07fa62` feat: jerarquía de roles, rediseño liquid glass y flujo Externo a Socio (martin)
- `26dfa17` feat: notificaciones, gestión de clases, historial de pagos, comprobantes y endurecimiento de seguridad (martin)

---

### 2026-09-14 · 3 h

**Tarjeta(s) Jira:** FT1-22 (5 pts)

**Actividad**

Redacción de [ADR-017](../adr/ADR-017-auditoria-en-dos-capas.md) (en esa fecha, ADR-0008) sistema de auditoría en dos capas (FT1-22): interceptor con @Auditable para contexto de app + trigger en Postgres sobre pagos para cubrir cambios directos, con redacción automática de secretos.

**Decisión**

Propuse usar el interceptor para registrar el contexto de la aplicación y el trigger de PostgreSQL para auditar los cambios directos sobre pagos.

El motivo fue que cada alternativa aislada dejaba un hueco: el interceptor conoce al usuario autenticado, pero no ve un cambio directo en la base; el trigger registra el cambio sobre la tabla, pero no tiene el mismo contexto de usuario de la aplicación. La combinación cubre ambos recorridos a costa de mantener dos mecanismos y consultar dos fuentes al investigar un pago.

**Problema o bloqueo**

El detalle JSON podía guardar tokens. La corrección del equipo incorporó redacción de secretos y una migración.

La auditoría debía permitir reconstruir una operación sin convertir el registro en una copia de credenciales. Distingo la decisión que documenté de la corrección implementada por el equipo: la migración de redacción `008-redactar-secretos-auditoria.sql` llegó en `26dfa17`, el 09/10. Por tanto, no presento esa limpieza posterior como código terminado en esta sesión del 14/09.

**Commits**

La evidencia vinculada a esta sesión figura en los commits del equipo que se detallan abajo.

**Evidencia del equipo**

- `1802fc4` feat: sistema de auditoría, panel de Recepción completo y fixes de membresías (martin)
- `068e8b6` Documentacion y correccion de adrs (martin)

---

## Sprint 3 — Patrones — Unidad III — 2026-09-15 al 2026-09-24

### 2026-09-18 · 3 h

**Tarjeta(s) Jira:** FT1-26 (4 pts)

**Actividad**

Definí con Martín cómo armar el documento de justificación de los tres patrones del sistema: Strategy en el precio dinámico (RF-11), Observer en la lista de espera (RF-08) y Repository con bloqueo pesimista contra la sobreventa (RN-02). Para cada uno, qué problema resuelve, por qué se eligió frente a las alternativas y qué costo tiene. La redacción la hizo casi toda Martín.

**Decisión**

Documentar para cada patrón el porqué y la alternativa descartada, en lugar de solo describir la implementación.

**Problema o bloqueo**

Al repasar los patrones para justificarlos noté que la primera versión de Strategy no era polimórfica de verdad, porque el calculador conocía las clases concretas. Cuando revisamos esto, el refactor ya estaba hecho en `2c6c8d7` (15/09): las estrategias se inyectan por el token PRICING_STRATEGIES y el Repository quedó con interfaz e implementación en memoria para las pruebas. Así que la justificación la escribimos sobre esa versión y no sobre la primera.

**Commits**

La evidencia vinculada a esta sesión figura en los commits del equipo que se detallan abajo.

**Evidencia del equipo**

- `cdca2b6` Creacion de logica de negocio detras del modulo "Canchas" (martin)
- `5552f69` Modulo clase,instructores,membresia creados (martin)
- `2c6c8d7` feat: implementar funcionalidad para cambiar contraseña y mejorar gestión de reservas. Corregir errores en los patrones (oberserver,repository,listener) (martin)
- `23cf2ff` fix: consistencia de layout en panel Gerente, bugs de sede-scope y métricas de accesos (martin)

---

## Sprint 4 — Componentes — Unidad IV — 2026-09-15 al 2026-10-08

### 2026-10-05 · 2 h

**Tarjeta(s) Jira:** FT1-48

**Actividad**

Definí con Martín el contenido y el diseño de la landing pública multipágina (inicio, clases, canchas, sedes, nosotros, con navegación compartida), que programó él. Al probar la navegación encontré que al cambiar de ruta la página no volvía arriba, y lo arreglé con un componente global `ScrollToTop`. El arreglo se integró el 11/10.

**Decisión**

Un layout público único (PublicLayout) en vez de repetir la navegación en cada página, y un arreglo global del scroll en vez de parchear página por página.

**Problema o bloqueo**

Al bajar en una página pública y entrar a otra desde el menú, la nueva página aparecía a mitad del contenido. Comparé esa navegación con una recarga de la misma página y ubiqué el problema en el cambio de ruta. Monté `ScrollToTop` dentro de `BrowserRouter` para restablecer la posición cuando cambia la ruta, con una sola implementación para la navegación.

Usé `useLocation` para leer `pathname`. El efecto llama a `window.scrollTo(0, 0)` cuando cambia ese valor. Así, el menú y el historial del navegador pasan por el mismo comportamiento. La comprobación de este caso consiste en bajar en una página, cambiar de ruta desde el menú y verificar que la siguiente abra arriba.

**Commits**

- `b3ec7c3` fix(client): volver arriba al cambiar de ruta publica

**Evidencia del equipo**

- `9f46ceb` feat(landing): landing pública multi-página + rediseño completo del área de Socio (martin)

---

### 2026-10-06 · 4 h

**Tarjeta(s) Jira:** FT1-32 (4 pts)

**Actividad**

Desarmé `ui.tsx` y reorganicé los componentes compartidos con Atomic Design (FT1-32). Dejé diez piezas básicas en `atoms`, doce combinaciones en `molecules` y los layouts en `organisms`. Moví `formatMoney` a `shared/utils` porque formatea datos que pueden usar distintas vistas. Revisé los importadores antes de retirar las piezas duplicadas o sin uso y documenté dónde ubicar componentes nuevos.

**Decisión**

Separé los componentes en archivos y mantuve un índice de exportaciones por nivel. El objetivo era ordenar los imports y conservar el comportamiento de la interfaz. Ver [ADR-006](../adr/ADR-006-framework-frontend-componentes-estado.md).

**Problema o bloqueo**

Después de mover los archivos, el build marcó dos errores en rutas relativas y en un import desde un archivo índice. Corregí los imports y el build volvió a pasar.

**Commits**

- `772b856` refactor(client): FT1-32 reorganizar shared/components con Atomic Design (commit del 11/10)

---

## Sprint 5 — Testing y CI/CD — Unidad V — 2026-10-09 al 2026-10-22

### 2026-10-11 · 2 h

Esta fecha cae en el Sprint 5. La actividad corresponde a la Unidad IV (rol Gerente de Sede; la tarjeta FT1-50 está en el Sprint 4).

**Tarjeta(s) Jira:** FT1-50 (5 pts), subtarea FT1-53

**Actividad**

Discutí con Martín las pantallas del nuevo rol Gerente de Sede, que programó él. Las verifiqué con una cuenta de prueba: login, panel propio y las 10 pantallas del rol (personal, canchas, clases, reservas, reportes, pagos, membresías, instructores y acceso), cargando los datos de su sede.

**Decisión**

Cerrar la tarea como Listo después de una verificación funcional por rol, y no solo revisando el código.

**Problema o bloqueo**

En la verificación encontré algunas cosas para corregir y se las pasé a Martín. También revisé el alcance por sede: el gerente de sede solo ve datos de su sede en personal, reservas y reportes.

**Commits**

La evidencia vinculada a esta sesión figura en los commits del equipo que se detallan abajo.

**Evidencia del equipo**

- `13b0d95` feat: selectores personalizados, catálogo de tipos de cancha completo, y diseño del rol Gerente de Sede (martin)
- `f07fa62` feat: jerarquía de roles, rediseño liquid glass y flujo Externo a Socio (martin)

La tarjeta está en el sprint 4 aunque la verificación se cerró el 11/10, después de la fecha de fin del sprint.

---

### 2026-10-13 · 4 h

**Tarjeta(s) Jira:** FT1-30 (6 pts), FT1-61, FT1-62 y FT1-56

**Actividad**

Ejecuté pruebas manuales en producción con cuentas de prueba por rol y registré los resultados y los casos parciales en [docs/PRUEBAS.md](../PRUEBAS.md) (FT1-56). Con una cuenta nueva comprobé que el pago respondía 201, cambiaba el rol de Externo a Socio y generaba un solo cobro. El doble clic lo probé por separado con una cuenta que ya tenía un plan vigente. Al cerrar la sesión de pruebas verifiqué que no quedaran sesiones de acceso ni reservas abiertas de la prueba.

**Decisión**

probar contra producción (como pide el plan) con cuentas de prueba, cancelando/cerrando todo lo creado en el acto; no ejecutar mail masivo por riesgo a socios reales.

**Problema o bloqueo**

No encontré una clase con una sola plaza disponible para reproducir ese caso en producción. La prueba en paralelo se ejecutó sin duplicados, pero el caso de la última plaza quedó parcial. Confirmé que el límite de intentos de ingreso se activa en el sexto intento de login.

En la prueba de doble clic con plan vigente no apareció otro cobro. Dejé pendiente comprobar el doble clic en una cuenta sin membresía porque la compra individual en una cuenta nueva y el doble clic con un plan vigente verificaban condiciones distintas.

**Commits**

- `5371015` docs: QA Sprint 5 — reporte de pruebas manuales en produccion (FT1-30)

---

## Sprint 6 — Móvil — Unidad VI — 2026-10-23 al 2026-11-05

_Sin sesión de trabajo propia acreditada para este sprint._

En Jira figuro como informador de [FT1-88](https://fitzone-sports.atlassian.net/browse/FT1-88) (PWA), [FT1-89](https://fitzone-sports.atlassian.net/browse/FT1-89) (notificaciones push) y [FT1-90](https://fitzone-sports.atlassian.net/browse/FT1-90) (estados sin conexión). Las tres tarjetas se cargaron el 09/11 y están asignadas a Martín. Sus commits `8963659`, `fadb12b`, `34a9ca9` y `65ecc2d` son del 18/10. Dejo estas referencias como contexto del equipo. El registro de las tarjetas ocurrió después del sprint.

## Sprint 7 — Integración — Unidad Cierre — 2026-11-06 al 2026-11-19

### 2026-11-09 · 2 h

Esta actividad corresponde a la Unidad V (Testing y CI/CD; tarjetas del Sprint 5) y se realizó durante el Sprint 7.

**Tarjeta(s) Jira:** FT1-59 y FT1-64

**Actividad**

Pruebas de integración contra PostgreSQL real para RN-01 y RN-02 (FT1-59): diez reservas simultáneas de la misma cancha confirman exactamente una, dos ingresos simultáneos del mismo socio en sedes distintas registran uno solo, y el cupo de una clase no se excede bajo concurrencia; umbral de cobertura en `package.json` y jobs de integración y Docker en el CI. Endurecimiento del QR (FT1-64): token de un solo uso con `jti` y la violación del índice de RN-01 (23505) devuelta como 409 en lugar de 500 en los tres tipos de ingreso.

**Decisión**

Probar la concurrencia contra PostgreSQL real y no solo con repositorios en memoria, porque los dobles no reproducen el SELECT … FOR UPDATE ni los índices únicos parciales. Para el QR de un solo uso, guardar los jti usados en memoria hasta que vencen (viven 60 segundos) en vez de una tabla, y traducir el error 23505 en la función común de registro del ingreso, así cubre QR, código y DNI. Ver [ADR-004](../adr/ADR-004-concurrencia-en-reservas.md) y [ADR-008](../adr/ADR-008-estrategia-de-pruebas.md).

**Problema o bloqueo**

Ese mismo día Martín subió el ingreso por DNI y chocaba con mi versión: me quedé con la suya y volví a aplicar solo el endurecimiento sobre su código. Ahí apareció que su versión traducía el 23505 únicamente para el DNI, y con QR y con código seguía saliendo 500. Además, el script de las pruebas de integración borra la base, así que le agregué un resguardo: exige INTEGRACION_DB=true y se niega a correr contra Supabase.

Para verificar el arreglo separé la reutilización del mismo QR de la carrera entre ingresos del mismo socio. La prueba del servicio comprueba que dos lecturas simultáneas del mismo QR registren un solo ingreso y que un intento fallido no consuma el token. La prueba contra PostgreSQL comprueba que dos ingresos en sedes distintas no puedan dejar abiertas dos sesiones para el mismo usuario. Así quedó cubierto tanto el uso del token como la restricción que sostiene RN-01.

En canchas agregué un caso de diez solicitudes para el mismo turno. La prueba exige una reserva confirmada y nueve respuestas 409. También cubrí dos casos para distinguir la regla de un bloqueo indiscriminado: horarios distintos de la misma cancha pueden reservarse y cancelar una reserva libera su horario. En clases usé doce solicitudes para cinco lugares y comprobé el reparto esperado entre reservas y lista de espera. Los casos están en [reserva-cancha.int-spec.ts](../../backend/test/integracion/reserva-cancha.int-spec.ts) y [reserva-clase.int-spec.ts](../../backend/test/integracion/reserva-clase.int-spec.ts).

**Commits**

- `009914b` fix(acceso): QR de un solo uso y conflicto 23505 como 409 en todos los ingresos
- `c2d8e0e` test: integración contra Postgres real para RN-01 y RN-02, y umbral de cobertura

---

### 2026-11-09 · 4 h

**Tarjeta(s) Jira:** FT1-95 a FT1-104 (y FT1-86, escaneo de secretos, que está en el sprint 5)

**Actividad**

Cierre de los requisitos de admisibilidad de la entrega: migraciones reproducibles desde una base vacía con su reversión y script de migración; datos de prueba con 25 sedes; almacenamiento de archivos intercambiable y `docker compose up --build`; contrato OpenAPI exportado; escaneo de secretos del historial completo; los diez ADR obligatorios en la plantilla del Anexo B; diagramas C4, DER, despliegue y pipeline; corrección de la carga de clases (429 con 25 sedes) y de los plazos de cancelación mostrados; integración con la reestructura backend/frontend; los tres manuales; README.

**Decisión**

Reutilicé los SQL existentes y escribí un script para aplicarlos y revertirlos en orden. Así pude conservar los índices únicos parciales, la exclusión GiST y los triggers en los mismos archivos que definen el esquema. Elegí un almacenamiento de archivos intercambiable para que Docker pudiera funcionar sin Supabase. Ver [ADR-002](../adr/ADR-002-motor-de-base-de-datos.md) y [ADR-009](../adr/ADR-009-despliegue-contenerizacion-y-reversion.md).

**Problema o bloqueo**

El arranque desde una base vacía fallaba porque la migración 002 repetía parte del esquema de la 001, faltaba contemplar `GERENTE_SEDE` y no estaba la tabla de suscripciones push. Ajusté las migraciones 001, 002 y 005 e incorporé la 011, con las reversiones correspondientes. Con el seed de 25 sedes, la pantalla de reservas de clases hacía más de 100 pedidos y recibía respuestas 429. Agrupé la consulta de ocurrencias en un solo pedido y agregué una prueba de integración para ese endpoint.

El cambio de clases tocó los dos lados de la API. En el backend agregué la consulta por rango que devuelve las ocurrencias agrupadas por clase y en el frontend cambié la carga para consumir ese resultado. El commit `6713502` deja juntos el cambio de cliente, el endpoint, el contrato OpenAPI y su prueba de integración.

Al agrupar las consultas tenía que conservar los permisos por sede. La prueba comprueba que un socio vea clases activas de todas las sedes y su cupo ocupado, y que un recepcionista siga limitado a su sede incluso si pide otra. También verifica que el endpoint rechace rangos inválidos o mayores a 31 días. [Prueba de ocurrencias](../../backend/test/integracion/ocurrencias-por-clase.int-spec.ts)

En las migraciones, el script registra cada versión en `schema_migraciones` y ejecuta los cambios dentro de transacciones. Ese registro permite saber qué SQL ya se aplicó y qué reversión corresponde. El commit `b101898` muestra el script y los archivos de reversión junto con las correcciones del esquema.

**Commits**

- `b101898` feat(db): migraciones reproducibles desde cero, con reversión y registro
- `5f5f7b6` feat(db): datos de prueba con 25 sedes, canchas, clases y usuarios de todos los roles
- `a63719c` feat(storage): almacenamiento de archivos intercambiable, con proveedor local
- `6b33468` build: levantar el sistema completo con docker compose up --build
- `ab9b759` docs(api): exportar el contrato OpenAPI a server/swagger.json
- `532fb99` ci: escaneo de secretos con gitleaks sobre todo el historial
- `849e354` docs(adr): los diez ADR obligatorios en la plantilla del Anexo B
- `74894a6` docs(diagramas): C4, DER físico, despliegue y pipeline con fuente editable
- `6713502` fix(clases): cargar las ocurrencias de todas las clases en un solo pedido
- `458225c` docs(manuales): capturas del sistema por rol para el manual de usuario
- `7a7b3a3` Merge origin/main: adaptar el trabajo a la estructura backend/ y frontend/
- `8b605ad` docs(adr): ADR-003 y ADR-007 con la implementación offline en curso
- `86452ab` fix(cliente): plazos de cancelación iguales a los que aplica el servidor
- `a5b6a03` docs(manuales): manual de usuario, de instalación y operación, y técnico
- `79faad7` docs(bitacora): bitácora individual de Máximo Retamoso en la plantilla del Anexo C
- `32a2ca8` docs(readme): los seis puntos de la sección 4.1 de los lineamientos

**Evidencia del equipo**

- `1eec536` chore(repo): adaptar estructura a lineamientos de entrega (server→backend, client→frontend) [FT1-nn] (martin)

**Revisión de bitácora (FT1-115, 09/11/2026).** Se verificaron los 38 hashes citados contra el historial de `main`. El sprint corresponde a la tarjeta de Jira y la fecha de cada entrada corresponde a la actividad registrada. Las revisiones anteriores de la bitácora quedaron en `72f4f57` y `7766707`.

---

### 2026-11-09 · 3 h

Sesión aparte de las dos anteriores del mismo día.

**Tarjeta(s) Jira:** FT1-116

**Actividad**

Reorganicé los C4 y el DER y agregué los siete diagramas UML. En la secuencia del QR offline documenté la preparación con red, la validación local y la sincronización posterior. La implementación del acceso offline está en el PR #6 de Martín. Las fuentes Mermaid y las exportaciones están en el [índice de diagramas](../diagramas/README.md).

**Decisión**

Dividí el DER en una vista general y vistas por dominio. En Acceso separé visualmente el recorrido con conexión de la validación local.

**Problema o bloqueo**

Las relaciones se cruzaban en las vistas originales y el C4 de Acceso todavía mostraba el QR offline como propuesto. La reorganización redujo los cruces y la secuencia quedó alineada con el flujo implementado.

**Commits**

- `17628fc` docs(diagramas): ordenar las vistas de FitZone

---

## Entre sprints

### 2026-09-02 · 1 h

Esta fecha cae entre el Sprint 1 (termina el 2026-08-27) y el Sprint 2 (empieza el 2026-09-03). La tarjeta FT1-15 pertenece al Sprint 2 (Unidad II).

**Tarjeta(s) Jira:** FT1-15 (1 pt); FT1-16 es del sprint 1

**Actividad**

Redacción de [ADR-012](../adr/ADR-012-repositorio-compartido-github.md) (en esa fecha, ADR-0001) GitHub como repositorio compartido (FT1-15) y de [ADR-001](../adr/ADR-001-estilo-arquitectonico.md) (en esa fecha, ADR-0002) Monolito Modular (FT1-16): ramas por integrante y versionado acoplado como costo aceptado.

Participé en la redacción del criterio de repositorio compartido: un cambio que modifica un endpoint y su consumo en el cliente se puede revisar dentro del mismo historial. Separar los repositorios habría requerido coordinar dos integraciones para ese recorrido. Dejamos las ramas como mecanismo de trabajo individual y los commits como referencia para identificar aportes y volver sobre una decisión. Martín integró los documentos; mi participación en la redacción no equivale a la autoría de sus commits.

**Decisión**

Acordamos mantener el cliente y el servidor en un repositorio para coordinar cambios de la API y la interfaz. El costo aceptado fue el versionado acoplado. Para registrar las decisiones usamos el formato de Nygard.

**Problema o bloqueo**

Después de varias iteraciones quedaron saltos en la numeración de los ADR. Para ordenar las referencias usamos el historial de Git.

Las referencias actuales usan la numeración de entrega. El documento de GitHub figura ahora como ADR-012 y lleva fecha 04/09, distinta de esta sesión registrada el 02/09; el de arquitectura es ADR-001. Mantengo esa diferencia visible: la fecha del documento integrado no reemplaza automáticamente la fecha de mi actividad.

**Commits**

La evidencia vinculada a esta sesión figura en los commits del equipo que se detallan abajo.

**Evidencia del equipo**

- `612d9ce` Documentacion y correcciones (martin)
- `068e8b6` Documentacion y correccion de adrs (martin)
- `e22cde0` Adrs (martin)

---

## Sprint 8 — Demo Day — Unidad Cierre — 2026-11-23 al 2026-11-29

_Sprint todavía no iniciado._
