# Estructura del frontend frente al punto 4 de los lineamientos (FT1-131)

Este documento compara la estructura real de `frontend/src` con la que proponen los lineamientos de entrega (punto 4) y explica por qué el equipo organizó el código por módulos. No hubo que mover ni renombrar código: todo lo que se afirma acá se verificó recorriendo `frontend/src`, `routes/AppRoutes.tsx` y `package.json` el 12/11/2026.

## 1. Estructura real

```
frontend/src/
  api/          axios.ts (instancia única de axios), clasificarError.ts
  modules/      una carpeta por funcionalidad (14): acceso, admin, auth, canchas, clases,
                inicio, instructores, legal, membresias, notificaciones, pagos, precios,
                sedes, usuarios
  shared/       components/{atoms,molecules,organisms}, hooks, layout, types, utils
  routes/       AppRoutes.tsx, ProtectedRoute.tsx, ScrollToTop.tsx
  styles/       hojas de estilo (variables, tema, público, operarios, auth, etc.)
  assets/, test/, App.tsx, main.tsx
```

## 2. Tabla de correspondencia

| Lineamientos | Dónde vive en el repositorio | Evidencia verificable | Correspondencia |
|---|---|---|---|
| `src/portal` (portal responsive del socio) | No hay carpeta `portal`. Las pantallas del socio están en la carpeta `pages/` de cada módulo y se agrupan por ruta bajo el layout `ClienteShell` | `routes/AppRoutes.tsx`: rutas `/dashboard` (`inicio/pages/Dashboard.tsx`, que muestra `SocioInicio` o `ExternoInicio` según el rol), `/mi-qr` y `/qr` (`acceso/pages/MiQr.tsx`), `/pagos` (`pagos/pages/MisPagos.tsx`), `/membresia` (`membresias/pages/MiMembresia.tsx`), `/mi-cuenta` (`usuarios/pages/Configuracion.tsx`), `/notificaciones` (`notificaciones/pages/MisNotificaciones.tsx`), `/reservar-clases` (`clases/pages/ReservarClases.tsx`) y `/reservar-canchas` (`canchas/pages/ReservarCanchas.tsx`). Además, `/completar-membresia` (`membresias/pages/CompletarMembresia.tsx`) va protegida pero fuera del shell. El shell es `shared/layout/ClienteShell.tsx` sobre `shared/layout/AppShell.tsx` | Parcial: equivalente por rutas y layout, no por carpeta |
| `src/portal`, parte responsive | Layout adaptable más PWA | `index.html` con `viewport` (`width=device-width`); `AppShell.tsx` usa `useMediaQuery('(max-width: 1024px)')` para el modo móvil; hay reglas `@media` en `styles/*.css` y en `index.css`/`App.css`; `vite.config.ts` usa `VitePWA` (manifest y service worker) | Sí, como capacidad del layout; no es una carpeta |
| `src/admin` (consola de administración) | `modules/admin/` (`pages/`: `GerenteDashboard`, `SedeDashboard`, `RecepcionistaDashboard`, `Reportes`, `CanchasPage`, `ReservasPage`, `CalendarioSede`, `ConfiguracionClases`, etc.; `components/ActividadReciente.tsx`; `admin.api.ts`) más pantallas de personal que viven en otros módulos | `routes/AppRoutes.tsx`: todo lo que está bajo `/admin` usa `AdminLayout` (`shared/components/organisms/AdminLayout.tsx`) y `ProtectedRoute` con `allowedRoles` y `loginPath="/admin/login"`. Pantallas bajo `/admin` que no están en `modules/admin`: `usuarios` (`PersonalPage`, `ClientesPage`, `CrearStaff`), `sedes` (`SedesPage`, `SedeDetalle`), `canchas` (`GestionReservasCanchas`, `ConfiguracionTiposCancha`), `clases` (`GestionReservasClases`), `instructores` (`CrearInstructor`, `InstructorDetalle`), `pagos` (`CobrarEfectivo`, `HistorialPagos`), `membresias` (`ListadoMembresias`), `precios` (`EditarPrecios`), `notificaciones` (`EnviarNotificaciones`) y `acceso` (`ControlAcceso`, `DentroSede`, `MetricasAccesos`) | Parcial: `modules/admin` contiene una parte; el resto de la consola está repartido por módulo y se reconoce por la ruta `/admin` |
| `src/components` (átomos, moléculas, organismos) | `shared/components/atoms`, `molecules` y `organisms` | Atoms: `Avatar`, `Badge`, `Button`, `Chip`, `Donut`, `IconButton`, `ProgressBar`, `SectionTitle`, `Select`, `Tooltip`. Molecules: `BackButton`, `Card`, `EmptyState`, `ErrorState`, `LoadingState`, `MetricCard`, `MiniChart`, `PageHeader`, `Pagination`, `Ranking`, `SectionHeader`, `StatCard`. Organisms: `AdminLayout`, `AvisoActualizacion`, `AvisoErroresGlobales`, `BannerCookies`, `BannerSinConexion`, `BotonInstalar`, `BotonVolverApp`, `ErrorBoundary`, `Landing`, `PublicLayout`. Cada nivel tiene `index.ts` y la regla está en `shared/components/README.md` | Sí, con otra ruta (`shared/components` en lugar de `components`) |
| `src/services` (capa de servicio contra la API) | `api/axios.ts` (instancia única) y un archivo `*.api.ts` por módulo | `api/axios.ts` define `baseURL` (`VITE_API_URL`), `withCredentials: true` y el interceptor de respuestas. 13 servicios: `acceso.api.ts`, `admin.api.ts`, `auth.api.ts`, `canchas.api.ts`, `clases.api.ts`, `instructores.api.ts`, `membresias.api.ts`, `notificaciones.api.ts`, `push.api.ts`, `pagos.api.ts`, `precios.api.ts`, `sedes.api.ts` y `usuarios.api.ts`, cada uno en su módulo. Ninguna página importa la instancia `api` directamente | Sí en la función; no hay carpeta `services` |
| `src/store` (estado global) | `modules/auth/AuthContext.tsx` (Context API) | `AuthContext` guarda usuario, rol, sede y estado de la sesión, y se consume con `useAuth()` (44 importaciones). Hay un segundo contexto, `PushContext`, en `notificaciones/hooks/usePushNotificaciones.ts`, con `PushProvider`. El resto del estado es local de cada pantalla (`useState`). Hooks compartidos en `shared/hooks` (`useTitulo`, `useAhora`, `useEstadoConexion`, `useModoStandalone`, etc.) | Parcial: no hay carpeta ni librería de store; el estado global es la sesión |

## 3. Justificación de la organización por módulos

- **Carpetas por funcionalidad en la aplicación.** Cada módulo (`modules/pagos`, `modules/canchas`, etc.) agrupa sus páginas, su servicio `*.api.ts`, sus tipos y sus componentes específicos. Una funcionalidad como "pagos" tiene pantallas del socio (`MisPagos`) y del personal (`CobrarEfectivo`, `HistorialPagos`) que comparten tipos y servicio; separarlas en `portal/` y `admin/` obligaría a duplicar o a cruzar carpetas. La separación entre portal y consola se resuelve por rutas, layout y rol (`ClienteShell`/`ROLES_CLIENTE` frente a `AdminLayout`/`ROLES_STAFF`).
- **Atomic Design dentro del kit compartido.** Lo reutilizable entre portal y consola vive en `shared/components` ordenado en átomos, moléculas y organismos (FT1-32). Los componentes propios de un módulo (por ejemplo `LectorQr` o `CampanitaNotificaciones`) quedan en su módulo: Atomic ordena lo compartido, no prohíbe lo específico (`shared/components/README.md`, regla 6).
- **Estado y servicios.** El estado verdaderamente global es la sesión, por eso alcanza con Context; los componentes no llaman a axios directamente y usan la capa `*.api.ts` sobre una única instancia de axios.
- **Decisión registrada.** Está en [ADR-006](../adr/ADR-006-framework-frontend-componentes-estado.md): React 19 con Vite y Tailwind 4, Atomic Design en `frontend/src/shared/components/`, estado global en `AuthContext` y capa de servicio por módulo (`modules/*/*.api.ts`). El ADR descarta Redux Toolkit y Zustand porque el único estado global es la sesión, y deja como deuda sumar un store (Zustand) o una caché de servidor (TanStack Query) si apareciera estado compartido entre muchas pantallas.

## 4. Diferencias con la estructura propuesta

Estas diferencias son literales: un evaluador que busque las carpetas por nombre no las va a encontrar.

1. **No existen las carpetas `src/portal`, `src/admin`, `src/components`, `src/services` ni `src/store`.** El código está en `src/modules`, `src/shared`, `src/api` y `src/routes`.
2. **Portal y consola no se separan por carpetas de primer nivel.** Solo `modules/admin` es exclusivo de la consola. Las pantallas del socio no tienen carpeta propia: están en `pages/` de cada módulo, mezcladas con las del personal en `canchas`, `clases`, `pagos`, `membresias`, `usuarios`, `notificaciones` y `acceso`. Se distinguen por la ruta (`/admin/...` frente al resto) y por el layout.
3. **Hay un tercer grupo que los lineamientos no nombran:** las pantallas públicas (`/`, `/clases`, `/canchas`, `/sedes`, `/nosotros`, `/terminos`) con `PublicLayout`, más `/login`, `/admin/login`, `/registro` y `/verificar-email`.
4. **Los componentes no están todos en un solo lugar.** El kit compartido está en `shared/components`, pero hay componentes específicos en `modules/*/components` (acceso, admin, membresías, notificaciones, pagos) y los layouts de página en `shared/layout` (`AppShell`, `ClienteShell`), fuera de `organisms`.
5. **La capa de servicio está distribuida.** No hay una carpeta única: `api/axios.ts` es la base y los servicios son 13 archivos `*.api.ts` dentro de cada módulo. Se llaman `.api.ts`, no "services".
6. **No hay store global propiamente dicho.** `package.json` no incluye Redux, Zustand ni TanStack Query. El estado global es el contexto de sesión `AuthContext` (y `PushContext` para las notificaciones push). Los datos de dominio (listados, formularios) son estado local de cada pantalla, y los datos del terminal sin conexión (`acceso/offline`, IndexedDB) los maneja el hook `useModoOffline` solo dentro de `ControlAcceso`. Esto es una decisión del ADR-006 y no un faltante, pero no hay carpeta `store`.
7. **Carpetas que los lineamientos no mencionan:** `routes`, `styles`, `assets`, `test`, `shared/hooks`, `shared/types`, `shared/utils`.
8. **Responsive:** el portal es responsive por el layout (`AppShell`, `@media` en los estilos) y es instalable como PWA. No hay una carpeta o paquete aparte que lo identifique, y esta verificación fue de código, no de pruebas en dispositivos.

## 5. Observaciones sobre la documentación existente

- `frontend/src/shared/components/README.md` listaba solo 4 organismos (`AdminLayout`, `BannerCookies`, `Landing`, `PublicLayout`) aunque `organisms/` tiene 10 componentes (más un test y el `index.ts`). **Quedó corregido:** la regla 3 y la tabla del README ahora describen y listan los 10 organismos, y los conteos de átomos (10) y moléculas (12) también coinciden con las carpetas.
- El README raíz y el manual técnico describen el frontend solo en términos generales: `frontend/  portal del socio y consola de administración (React)`.
