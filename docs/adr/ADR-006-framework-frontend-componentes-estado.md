# ADR-006 — React con Vite, componentes con Atomic Design y estado global con Context

- **Estado:** Aceptado
- **Fecha:** 2026-10-11
- **Autor:** Retamoso, Máximo
- **Sprint:** 5

## Contexto

El sistema tiene dos caras: el portal responsive del socio y la consola de administración del personal, con pantallas distintas por rol. Hacía falta un framework con ecosistema maduro, un catálogo de componentes reutilizables (Unidad IV) y una forma de compartir el estado de sesión (usuario, rol, sede) entre todas las pantallas. React y Vite se habían elegido en el ADR 0003 original (hoy ADR-005); la organización de componentes se decidió al reorganizar `shared/components` (FT1-32).

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué se descartó |
|---|---|---|---|
| **React 19 + Vite + Tailwind 4, Atomic Design, Context API** | Ecosistema y experiencia del equipo; build rápido; átomos, moléculas y organismos reutilizables entre portal y consola; Context alcanza para el estado que es realmente global (sesión) | Context re-renderiza a todos los consumidores; la consistencia del catálogo depende de la disciplina del equipo | Elegida |
| Vue 3 + Pinia | Curva suave, store oficial | Menos experiencia previa del equipo | Costo de aprendizaje |
| Redux Toolkit / Zustand para todo el estado | Una sola fuente de verdad explícita, devtools | Boilerplate para datos que son locales de cada pantalla (listados, formularios) | El único estado realmente global es la sesión |
| Librería de componentes (MUI, Chakra) | Componentes listos y accesibles | Estética genérica y difícil de adaptar al diseño propio; peso del bundle | Se prefirió un catálogo propio con Atomic Design |

## Decisión

Usamos **React 19 con Vite y TypeScript**, estilos con **Tailwind CSS 4** y un catálogo propio organizado con **Atomic Design** en `frontend/src/shared/components/` (`atoms/`, `molecules/`, `organisms/`, documentado en su README). El **estado global** es la sesión, en `AuthContext` (usuario, rol, sede, sincronizado entre pestañas); el resto del estado vive en cada pantalla. La comunicación con la API está aislada en una **capa de servicio** por módulo (`modules/*/*.api.ts`) sobre una única instancia de axios (`api/axios.ts`) que maneja cookie de sesión, timeouts y sesión vencida.

## Consecuencias

- **Positivas:** una sola fuente de verdad para la sesión; los componentes no llaman a axios directamente; portal y consola comparten átomos y moléculas.
- **Negativas:** sin store global para datos de dominio, dos pantallas que muestran lo mismo lo piden dos veces; Context no escala a estado muy dinámico.
- **Deuda asumida:** si apareciera estado compartido entre muchas pantallas (por ejemplo, carrito o datos offline del terminal, ver ADR-003), convendría sumar un store (Zustand) o una caché de servidor (TanStack Query).

## Requisitos relacionados

Unidad IV
