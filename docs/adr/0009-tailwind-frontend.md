# ADR 0007: Tailwind CSS v4 como sistema de estilos del frontend

## Estado

Aceptado

## Contexto

El frontend (Vite + React) inicialmente usaba CSS plano organizado por archivos (`variables.css`, `global.css`) con clases manuales por componente. Al generar un diseño visual completo para la sección `/admin` mediante una herramienta de diseño basada en IA (Figma Make), el resultado exportado utilizaba Tailwind CSS v4 (vía `@tailwindcss/vite`, configuración CSS-first sin `tailwind.config.js`) junto con la librería de íconos `lucide-react`. Se evaluó traducir manualmente esos estilos a CSS plano equivalente, o adoptar Tailwind como el sistema de estilos del proyecto completo.

## Decisión

Vamos a usar Tailwind CSS v4 como sistema de estilos para todo el frontend, migrando el CSS plano existente. Los tokens de diseño (colores, radios, tipografía) se centralizan en `src/styles/theme.css` mediante variables CSS y el bloque `@theme inline` de Tailwind v4, replicando la paleta violeta eléctrico (#8B2EFF) / negro (#0A0A0A) / blanco definida para la identidad visual del proyecto.

## Consecuencias

Esta adopción permite incorporar directamente el output de herramientas de diseño basadas en IA sin una capa de traducción manual propensa a errores, evita un archivo de configuración JS separado al convivir los tokens en un único `theme.css`, y acelera la construcción de nuevas pantallas manteniendo consistencia visual en espaciados, radios y colores. A cambio los componentes JSX quedan más verbosos por las clases utilitarias inline frente a clases semánticas cortas, y queda como deuda técnica migrar los componentes que aún usan CSS plano (`Layout.tsx`, `CrearStaff.tsx` al momento de este ADR) para unificar el sistema en todo el frontend. La implementación es verificable en `client/vite.config.ts` con el plugin `tailwindcss()`, en `client/src/styles/theme.css` con los tokens y `@theme inline`, y en el uso de clases utilitarias en `Login.tsx`, `AdminLayout.tsx`, `GerenteDashboard.tsx` y `RecepcionistaDashboard.tsx`, quedando pendiente completar la migración de `Layout.tsx` y `CrearStaff.tsx`.
