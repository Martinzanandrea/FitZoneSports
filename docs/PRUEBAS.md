# QA FitZone Sports — Reporte Sprint 5 (FT1-30)

Probado en **producción** (https://fit-zone-sports.vercel.app) por Máximo Retamoso. Usé las cuentas de socio, recepcionista, GS y GG.

## Pruebas de uso

| # | Rol | Prueba | Esperado | Resultado |
| --- | --- | --- | --- | --- |
| U1 | Todos | Registrar usuario nuevo con mail propio | Llega el mail y verifica | OK — registro 201 como EXTERNO; mail real recibido (Brevo) y cuenta verificada con el link ("¡Email verificado!"). Gates validados: login bloquea sin verificar, token inválido → 400 |
| U2 | Todos | Login, recargar, logout y reabrir | Sesión persiste; al cerrar no se entra con Atrás | OK — dashboard tras recarga; logout redirige a /login y `/auth/me` da 401 |
| U3 | Externo | Comprar membresía con pago aprobado (incl. doble clic) | Pasa a Socio; con doble clic, un solo cobro | OK — con cuenta fresca de prueba: pago 201, pasó a SOCIO, MENSUAL 13/10→13/11, un solo cobro de $12.500. Cuenta dada de baja al cerrar (baja lógica). Doble clic probado en cuenta propia con plan vigente: sin cobro duplicado (solo los 2 pagos viejos de agosto) |
| U4 | Externo | Pago rechazado con simulación | Mensaje claro, nada persiste | OK — botón "Simular pago rechazado (solo testing)" visible; mensaje "El pago fue rechazado..."; pagos 3=3 y vigencia intacta |
| U5 | Socio | Mis pagos + comprobante PDF | Monto/fecha/DNI correctos, abre en celular | OK — historial con 3 pagos; PDF descarga 200 (`application/pdf`, 2644 bytes). Nota: `POST /:id/comprobante` como socio da 403 (solo staff genera); la descarga del existente funciona |
| U6 | Socio | Reservar clase, cancelarla, lista de espera | Cupos se actualizan; al liberarse avisa | OK — reserva 201 (Spinning 2026-10-19) + cancelación 201; sin restos. Lista de espera no testeable solo (requiere clase llena + 2 personas) |
| U7 | Socio | Reservar cancha en horario libre | Ocupado no elegible, precio esperado | OK — cotización $25.500 `SOCIO_DESCUENTO` (base $30.000 −15%); reserva 201 + cancelación 201, nada ocupado |
| U8 | Recep. | Escanear QR de socio activo y vencido + egreso | Autoriza/deniega según membresía; aforo live | OK — QR 200 + código corto; sesión vieja abierta rechazada con 409 (RN-01); ingreso 201, aforo 1/30 en vivo, egreso 201. Caso "vencido" cubierto por código (doble chequeo) |
| U9 | GG | Aviso masivo + dar de baja clase con reservas | Avisados por ambos medios | OK en sandbox (masivo real no ejecutado a propósito): clase TEST creada, reservada y dada de baja → 4 ocurrencias + 1 reserva canceladas, socio avisado ("Clase cancelada"). Aviso individual a 1 usuario: panel recibido + mail aceptado |
| U10 | GS | Pagos: filtrar y revisar totales | Total = suma de filas | OK — 13/13 pagos de su sede (scope correcto); 272.750 = 102.750 + 170.000 |
| U11 | Todos | Celular + agregar a inicio | Nada tapado; sesión persiste desde el icono | PARCIAL — `manifest.webmanifest` 200 + `viewport` OK; instalación no testeable sin dispositivo |

## Pruebas de seguridad

| # | Rol | Prueba | Esperado | Resultado |
| --- | --- | --- | --- | --- |
| S1 | Sin sesión | Pegar URL privada | Redirige a login | OK — `/admin/gerente` → `/admin/login` |
| S2 | Socio | Pegar URL de gerente/recepción | Bloqueado | OK — rebota a `/login` (mejorable: ideal `/dashboard`) |
| S3 | GS | Ver pagos/usuarios de otra sede | Solo su sede | OK — 13/13 de FitZone Central + totales coherentes |
| S4 | Socio | Comprobante ajeno cambiando el ID | 404, no se muestra | OK — UUID aleatorio → 404 |
| S5 | Todos | Texto raro (`<b>hola</b>`, comillas) en buscadores | Se muestra como texto | OK vía API (LIKE escapado, 200 sin ejecución) y en UI (tipado en buscador, 0 tags renderizados) |
| S6 | Todos | Débiles/muy largas + muchos intentos | Mensajes claros + límite | OK — 400 claros; al 6.º intento seguido: 429 (throttle activo) |
| S7 | Todos | Provocar errores (URL mala, datos inválidos) | Sin rutas SQL ni stack | OK — 404 propia, sin fugas |
| S8 | Avanzado | F12: respuestas de sesión/usuario, cookie HttpOnly+Secure | Sin secretos; cookie no visible en JS | OK — `document.cookie` no expone `token` (HttpOnly); Secure por código en prod |
| S9 | Avanzado | Swagger en producción | No accesible | OK — `/api` → 404 |

## Casos simultáneos y fechas

| #   | Prueba                                      | Esperado                         | Resultado                                      |
| --- | ------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| C1 | Dos socios, última plaza (cuenta regresiva) | Solo una confirma, sin sobrecupo | PARCIAL — sin clase casi llena no hay última plaza real. Variante ejecutada: 2 reservas en paralelo a la misma ocurrencia (2 sesiones) → ambas RESERVADA, sin duplicados; ambas canceladas. Última plaza real requiere coordinación |
| C2  | Clases entre 21:00 y 24:00                  | No aparecen / horario argentino  | OK — la más tardía es 16:30; nada en 21–24     |

## Limpieza post-pruebas (verificada en base el 13/10)

- Usuario de prueba dado de baja (no entra más); su membresía y pago mock quedan como historial.
- Reservas de prueba: todas CANCELADA; clase TEST desactivada.
- Sesiones: ninguna abierta. Nada ocupa turnos, cupos ni accesos.
- Queda historial normal de auditoría/notificaciones de las pruebas.

## Hallazgos

- **Hallazgo 1 — Alta:** si se compra o renueva con una membresía ACTIVA vigente, el sistema crea otra ACTIVA encima sin cerrar la anterior (visto en el código de `renovar()`). Por eso U3 se probó con cuenta fresca sin solapamiento. Hay que corregirlo antes de habilitar compras en ese caso.
- **Hallazgo 2 — Alta (parcialmente verificado):** el cobro online se hace fuera de la transacción. Doble clic probado en cuenta propia con plan vigente: sin cobro duplicado. Queda pendiente el caso con cuenta sin membresía (test automatizado con mock).
- **Menor:** el recepcionista ve ceros en Membresías porque el backend le responde 403 (la página no se rompe). Habría que alinear la ruta a solo gerentes.
- **Menor:** al entrar como socio a una URL de admin te manda al login en vez de a tu panel. Bloquea igual, pero confunde.
- **Menor:** generar comprobante como dueño da 403 (solo staff); la descarga del ya existente anda bien.

## Reportes cargados (uno por problema)

```text
Título: recepcionista ve ceros en Membresías
Gravedad: Media
Rol con el que probaste: Recepcionista (sede Central)
Dispositivo y navegador: PC, Chrome (navegador automatizado)
Pasos para reproducirlo:
1. Entrar como recepcionista.
2. Abrir /admin/membresias.
3. Mirar los contadores.
Resultado esperado: ver las membresías de su sede o un mensaje de sin permiso.
Resultado obtenido: la API responde 403 y la página muestra ceros.
Captura o video: (adjuntar)
Frecuencia: Siempre
Hora aproximada: 2026-10-13 (sirve para buscar en los logs)
```

```text
Título: entrar como socio a URL de admin rebota al login en vez de a tu panel
Gravedad: Baja
Rol con el que probaste: Socio
Dispositivo y navegador: PC, Chrome (navegador automatizado)
Pasos para reproducirlo:
1. Entrar como socio.
2. Pegar /admin/gerente en la barra.
Resultado esperado: bloqueo con redirección a tu panel.
Resultado obtenido: bloquea bien pero manda a /login.
Captura o video: (adjuntar)
Frecuencia: Siempre
Hora aproximada: 2026-10-13 (sirve para buscar en los logs)
```

```text
Título: generar comprobante como dueño responde 403
Gravedad: Baja
Rol con el que probaste: Socio
Dispositivo y navegador: PC, Chrome (navegador automatizado)
Pasos para reproducirlo:
1. Entrar como socio con pagos.
2. POST /pagos/:id/comprobante.
Resultado esperado: genera o mensaje claro de que solo staff genera.
Resultado obtenido: 403 sin mensaje de ayuda (la descarga del existente anda bien).
Captura o video: (adjuntar)
Frecuencia: Siempre
Hora aproximada: 2026-10-13 (sirve para buscar en los logs)
```

Gravedades (para decidir qué se arregla primero):

- **Crítica** — no se puede registrar, entrar, pagar o reservar; se ven datos ajenos o hay permisos rotos.
- **Alta** — una función importante falla pero hay un camino alternativo, o hay datos/importes incorrectos.
- **Media** — error visible que no impide usar el sitio, mensajes confusos o problemas en celular.
- **Baja** — ortografía, alineaciones, detalles estéticos.
