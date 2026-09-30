# ADR 0010: Verificación de email obligatoria con Resend, en vez de migrar a Auth0

## Estado

Aceptado

## Contexto

El registro público no verificaba que el email ingresado existiera o
perteneciera realmente a quien se registraba — cualquiera podía crear
una cuenta con un email inventado o ajeno. Se evaluó dos caminos para
cerrar esta brecha: migrar el sistema de autenticación completo a
Auth0 (que incluye verificación de email de fábrica), o agregar
verificación de email como una pieza aditiva sobre el sistema propio
de JWT + cookie httpOnly ya construido y documentado (ADR 0005).

## Decisión

Vamos a implementar verificación de email obligatoria sin reemplazar
el sistema de autenticación existente. Al registrarse, la cuenta se
crea con emailVerificado en false, y se envía un link de confirmación
mediante Resend (proveedor de email transaccional), usando el mismo
mecanismo de token JWT que ya usa el QR de acceso (mismo JWT_SECRET,
con un campo tipo: 'email-verificacion' para que no se confunda con
otros tokens del sistema, expiración de 24hs). El login queda
bloqueado con un error distinguible ('EMAIL_NO_VERIFICADO') hasta que
el usuario confirme el link. Existe un endpoint de reenvío con rate
limiting y respuesta siempre genérica, para evitar enumeración de
usuarios registrados. Se descartó Auth0 explícitamente: hubiera
significado reemplazar el login dual (cliente/staff), el mecanismo de
sede-scope construido sobre el payload del JWT propio, e invalidar la
arquitectura ya defendida en el ADR 0005, por un beneficio funcional
que no lo ameritaba — verificar un email no requiere delegar todo el
sistema de identidad a un tercero.

## Consecuencias

Cierra la brecha real (cuentas con emails falsos) sin tocar ni
arriesgar el sistema de autenticación ya probado en múltiples
auditorías de seguridad de este proyecto. El costo es una dependencia
externa nueva: si Resend falla al enviar, el registro igual se
completa (a propósito, para no bloquear la creación de cuenta por un
problema de un tercero), pero el usuario queda sin el link hasta
pedir un reenvío manual. Al agregar la columna emailVerificado con
default false, fue necesario "perdonar" explícitamente a todos los
usuarios ya existentes antes del cambio (UPDATE manual) — de lo
contrario, cualquier cuenta creada antes de este
