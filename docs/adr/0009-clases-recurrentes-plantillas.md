# ADR 0009: Clases grupales como plantillas recurrentes, no eventos únicos

## Estado

Aceptado

## Contexto

El modelo original de `clases` representaba cada clase como un evento
único con fecha y hora fija (horario_inicio/horario_fin como
timestamptz puntual), obligando al Gerente a crear una fila nueva por
cada ocurrencia. En la operación real de un gimnasio, las clases
grupales (Yoga, Spinning, etc.) son recurrentes semanales y persisten
indefinidamente hasta que se decide discontinuarlas, sin una fecha de
fin planificada de antemano — el enunciado original (RF-06 a RF-08)
no específica este comportamiento ni si una sede permite clases
simultáneas, dejando ambas decisiones abiertas.

## Decisión

Vamos a modelar las clases como plantillas recurrentes semanales
(tipo, instructor, sede, horas semanales totales), a partir de las
cuales el sistema genera automáticamente las ocurrencias reservables
concretas (fechas puntuales) manteniendo siempre una ventana móvil de
semanas futuras generadas, sin intervención manual del Gerente. Al
definir una plantilla, el Gerente indica solo las horas semanales
totales; el sistema sugiere combinaciones de días (1 a 5), calculando
las horas por día con redondeo a la media hora más cercana, y propone
automáticamente en qué días y horarios concretos ubicarlas según los
huecos libres de la sede — todo editable por el Gerente antes de
confirmar. Asumimos que cada sede tiene una única "sala" compartida
para clases grupales: nunca dos clases ocurren en simultáneo en la
misma sede, y el pool de horas semanales disponibles (definido por el
horario de apertura de la sede) se comparte entre todas sus clases.

## Consecuencias

El Gerente planifica en términos de "cuántas horas semanales" en lugar
de crear eventos uno por uno, reflejando cómo se gestiona un gimnasio
real. Las reservas (RF-07) siguen atadas a una ocurrencia concreta
(fecha y hora puntual), preservando la semántica de "reservá hasta
48hs antes" y "cancelá hasta 2hs antes" sin ambigüedad. Como
contrapartida, el supuesto de sala única es una decisión nuestra no
respaldada por el enunciado original: si en el futuro una sede
necesitara ofrecer clases simultáneas en espacios distintos, haría
falta introducir un concepto de "sala" o "espacio" que hoy no existe,
lo cual implicaría revisar este ADR. La generación automática de
ocurrencias hacia adelante requiere un mecanismo recurrente (cron) que
mantenga la ventana de semanas futuras, sumando una pieza de
infraestructura que el modelo anterior no necesitaba.
