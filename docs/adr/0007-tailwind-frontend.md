# ADR 0007: Tailwind CSS v4 como sistema de estilos del frontend

## Estado

Aceptada

## Contexto

El frontend (Vite + React) inicialmente usaba CSS plano organizado por
archivos (`variables.css`, `global.css`) con clases manuales por
componente. Al generar un diseño visual completo para la sección `/admin`
mediante una herramienta de diseño basada en IA (Figma Make), el
resultado exportado utilizaba Tailwind CSS v4 (vía `@tailwindcss/vite`,
configuración CSS-first sin `tailwind.config.js`) junto con la librería
de íconos `lucide-react`. Se evaluó traducir manualmente esos estilos a
CSS plano equivalente, o adoptar Tailwind como el sistema de estilos del
proyecto completo.

## Decisión

Utilizaremos **Tailwind CSS v4** como sistema de estilos para todo el
frontend, migrando el CSS plano existente. Los tokens de diseño (colores,
radios, tipografía) se centralizan en `src/styles/theme.css` mediante
variables CSS y el bloque `@theme inline` de Tailwind v4, replicando la
paleta violeta eléctrico (#8B2EFF) / negro (#0A0A0A) / blanco definida
para la identidad visual del proyecto.

## Consecuencias

- (+) Permite incorporar directamente el output de herramientas de
  diseño basadas en IA (Figma Make) sin una capa de traducción manual
  propensa a errores o pérdida de fidelidad visual.
- (+) Tailwind v4 no requiere archivo de configuración JS separado; los
  tokens conviven en un único archivo CSS (`theme.css`), reduciendo
  superficie de configuración.
- (+) Clases utilitarias aceleran la construcción de nuevas pantallas
  manteniendo consistencia visual (espaciados, radios, colores) sin
  reinventar nombres de clase por componente.
- (-) Los componentes JSX quedan más verbosos (clases utilitarias largas
  inline) comparado con clases semánticas cortas del CSS plano anterior.
- (-) Requiere migrar los componentes ya construidos con CSS plano
  (`Layout.tsx`, `CrearStaff.tsx` al momento de este ADR) para mantener
  consistencia visual en todo el proyecto — migración pendiente,
  documentada como deuda técnica.

## Cumplimiento

Verificable en `client/vite.config.ts` (plugin `tailwindcss()`),
`client/src/styles/theme.css` (tokens y `@theme inline`), y el uso de
clases utilitarias en `Login.tsx`, `AdminLayout.tsx`, `GerenteDashboard.tsx`
y `RecepcionistaDashboard.tsx`.

## Notas

Pendiente: migrar `Layout.tsx` (header de socios/externos) y
`CrearStaff.tsx` de CSS plano a Tailwind para unificar el sistema de
estilos en la totalidad del frontend.
