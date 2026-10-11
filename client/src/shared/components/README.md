# Sistema de diseño: Atomic Design (FT1-32)

`shared/components` se organiza en tres niveles. Reglas:

1. **Átomos** (`atoms/`): piezas mínimas sin lógica de negocio
   (botones, etiquetas, avatar, selects, tooltips). Un archivo por componente.
2. **Moléculas** (`molecules/`): combinaciones con un propósito
   (tarjetas, estados de carga/error/vacío, paginación, encabezados).
3. **Organismos** (`organisms/`): bloques completos (layouts y shell público).
4. Cada nivel tiene `index.ts` (barrel): se importa desde la carpeta,
   nunca con rutas profundas a archivos sueltos.
5. Lo que no es componente no vive acá: `formatMoney` está en
   `shared/utils/formatMoney.ts`.
6. Los componentes de un módulo (ej. `LectorQr`, `CampanitaNotificaciones`)
   quedan en su módulo: Atomic ordena lo **compartido**, no prohíbe
   lo específico.
7. Limpieza incluida: `ui.tsx` se partió en sus piezas (era un cajón),
   se eliminó el `Donut` duplicado sin uso y los muertos `Reveal`/`Layout`.

| Nivel | Archivos |
|---|---|
| atoms | Avatar, Badge, Button, Chip, Donut, IconButton, ProgressBar, SectionTitle, Select, Tooltip |
| molecules | BackButton, Card, EmptyState, ErrorState, LoadingState, MetricCard, MiniChart, PageHeader, Pagination, Ranking, SectionHeader, StatCard |
| organisms | AdminLayout, BannerCookies, Landing, PublicLayout |
