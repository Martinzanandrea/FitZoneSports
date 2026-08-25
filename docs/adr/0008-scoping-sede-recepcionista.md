# ADR 0008: Scoping por sede para el rol Recepcionista

## Estado

Aceptada

## Contexto

El modelo de datos permite que un `RECEPCIONISTA` esté asignado a una
sede específica (`usuarios.sede_id`), pero el control de acceso
implementado hasta este punto solo restringía por **rol** (vía
`RolesGuard`), no por **pertenencia a sede**. Esto permitía que
cualquier Recepcionista autenticado creara, editara o gestionara
recursos (validación de accesos, reservas, cobros en efectivo) de
sedes distintas a la suya — un Recepcionista de la sede Norte podía
operar sobre la sede Central sin restricción, contradiciendo el modelo
de negocio real (un Recepcionista/Admin de sede gestiona únicamente su
propia sucursal).

Adicionalmente, el registro público de usuarios (`POST /usuarios`)
permitía que cualquier persona sin autenticar se autoasignara el rol
`GERENTE` o `RECEPCIONISTA`, al aceptar `tipoActor` como cualquier valor
del enum sin restricción — un riesgo de seguridad crítico detectado
durante pruebas manuales con Postman.

## Decisión

Utilizaremos un mecanismo de **scoping por sede** (`assertSedeScope`,
un helper aplicado a nivel de servicio) que restringe las operaciones de
un `RECEPCIONISTA` exclusivamente a la sede indicada en su propio
registro de usuario, propagada a través del JWT (`sedeId` en el
payload). El rol `GERENTE` queda exento de esta restricción y opera
sobre cualquier sede.

En paralelo, se separa la creación de usuarios en dos flujos: el
registro público (`POST /usuarios`) queda restringido a los roles
`SOCIO`/`EXTERNO` únicamente, y se introduce un endpoint protegido
(`POST /usuarios/staff`, exclusivo para `GERENTE` autenticado) para el
alta de personal interno (`RECEPCIONISTA`/`GERENTE`).

## Consecuencias

- (+) Un Recepcionista no puede validar accesos, gestionar reservas, ni
  registrar cobros en efectivo de una sede distinta a la propia — el
  backend rechaza la operación con `403 Forbidden` independientemente
  de lo que el cliente (frontend) permita o no en su UI.
- (+) Cierra el vector de escalación de privilegios donde cualquier
  visitante sin autenticar podía autoasignarse un rol interno.
- (+) El scoping se resuelve en la capa de servicio (no en el
  controller ni en la base de datos), centralizando la lógica en un
  único helper reutilizable (`assertSedeScope`) en lugar de duplicar la
  condición en cada método afectado.
- (-) Requiere que el JWT lleve `sedeId` en el payload y que
  `JwtStrategy.validate()` consulte la base de datos en cada request
  (en lugar de confiar únicamente en el contenido firmado del token),
  agregando una consulta adicional por request autenticado — trade-off
  aceptado porque también resuelve la necesidad de reflejar cambios de
  estado del usuario (desactivación, cambio de sede) sin esperar a la
  expiración del token.
- (-) Introduce un caso especial de "huevo y la gallina": el primer
  `GERENTE` del sistema no puede crearse a través de `POST /usuarios/staff`
  (requiere ya estar autenticado como `GERENTE`). Se resuelve mediante
  una cuenta semilla creada antes de aplicar esta restricción.

## Cumplimiento

Verificable en `src/auth/helpers/sede-scope.helper.ts`
(`assertSedeScope`), su aplicación en `AccesoService`,
`ReservasCanchaService`, `ReservasClaseService` y `PagosService`, y la
separación de endpoints en `UsuariosController`
(`POST /usuarios` vs `POST /usuarios/staff` con `@Roles(TipoActor.GERENTE)`).

## Notas

La cuenta semilla (primer Gerente) debe documentarse y sus credenciales
rotarse antes de cualquier entrega o despliegue compartido con
terceros, dado que fue creada en una ventana donde el registro público
aún no tenía esta restricción aplicada.
