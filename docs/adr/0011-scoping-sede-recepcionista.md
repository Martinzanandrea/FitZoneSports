# ADR 0008: Scoping por sede para el rol Recepcionista

## Estado

Aceptado

## Contexto

El modelo de datos permite que un `RECEPCIONISTA` esté asignado a una sede específica (`usuarios.sede_id`), pero el control de acceso implementado hasta este punto solo restringía por **rol** (vía `RolesGuard`), no por **pertenencia a sede**. Esto permitía que cualquier Recepcionista autenticado creara, editara o gestionara recursos (validación de accesos, reservas, cobros en efectivo) de sedes distintas a la suya — un Recepcionista de la sede Norte podía operar sobre la sede Central sin restricción, contradiciendo el modelo de negocio real (un Recepcionista/Admin de sede gestiona únicamente su propia sucursal).

Adicionalmente, el registro público de usuarios (`POST /usuarios`) permitía que cualquier persona sin autenticar se autoasignara el rol `GERENTE` o `RECEPCIONISTA`, al aceptar `tipoActor` como cualquier valor del enum sin restricción — un riesgo de seguridad crítico detectado durante pruebas manuales con Postman.

## Decisión

Vamos a usar un mecanismo de scoping por sede (`assertSedeScope`, un helper aplicado a nivel de servicio) que restringe las operaciones de un `RECEPCIONISTA` exclusivamente a la sede indicada en su propio registro de usuario, propagada a través del JWT (`sedeId` en el payload). El rol `GERENTE` queda exento de esta restricción y opera sobre cualquier sede. En paralelo, vamos a separar la creación de usuarios en dos flujos: el registro público (`POST /usuarios`) queda restringido a los roles `SOCIO`/`EXTERNO` únicamente, y vamos a introducir un endpoint protegido (`POST /usuarios/staff`, exclusivo para `GERENTE` autenticado) para el alta de personal interno (`RECEPCIONISTA`/`GERENTE`).

## Consecuencias

Con esto un Recepcionista no puede validar accesos, gestionar reservas ni registrar cobros en efectivo de una sede distinta a la propia porque el backend rechaza la operación con `403 Forbidden` sin importar lo que el frontend permita, y además se cierra el vector de escalación de privilegios donde cualquier visitante podía autoasignarse un rol interno. El scoping se resuelve centralizado en la capa de servicio mediante el helper reutilizable `assertSedeScope` en lugar de duplicar la condición en cada método, pero requiere que el JWT lleve `sedeId` y que `JwtStrategy.validate()` consulte la base de datos en cada request agregando una consulta adicional, un trade-off aceptado porque también permite reflejar cambios de estado del usuario (desactivación, cambio de sede) sin esperar la expiración del token. También aparece el caso del primer `GERENTE` del sistema, que no puede crearse vía `POST /usuarios/staff` al requerir ya estar autenticado como `GERENTE`, por lo que se resuelve mediante una cuenta semilla creada antes de aplicar esta restricción. Todo es verificable en `src/auth/helpers/sede-scope.helper.ts` y su aplicación en `AccesoService`, `ReservasCanchaService`, `ReservasClaseService` y `PagosService`, junto con la separación de endpoints en `UsuariosController` (`POST /usuarios` vs `POST /usuarios/staff` con `@Roles(TipoActor.GERENTE)`). La cuenta semilla debe documentarse y sus credenciales rotarse antes de cualquier entrega o despliegue compartido, dado que fue creada en una ventana donde el registro público aún no tenía esta restricción.
