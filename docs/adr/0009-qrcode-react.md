# ADR 0009: qrcode.react para el renderizado del QR dinámico en el cliente

## Estado

Aceptada

## Contexto

El backend genera el QR dinámico de acceso (RF04) como un JWT firmado con
expiración de 60 segundos (`AccesoService.generarQr`). El frontend
necesita renderizar ese token como una imagen QR real, escaneable por
el dispositivo del recepcionista. Se evaluó dibujar el patrón QR "a
mano" (como hizo el generador de diseño usado como referencia visual,
con un patrón determinístico basado en hash del string) contra usar una
librería especializada que implemente el estándar QR real.

## Decisión

Utilizaremos `qrcode.react` (componente `QRCodeSVG`) para renderizar el
JWT del backend como código QR en el cliente, en lugar de cualquier
aproximación dibujada a mano.

## Consecuencias

- (+) Genera un QR real, válido según el estándar (con corrección de
  errores, capacidad de datos correcta para strings largos como un
  JWT), escaneable por cualquier lector estándar.
- (+) El patrón dibujado a mano usado como referencia de diseño no era
  un QR real — no habría sido legible por un escáner, solo una
  aproximación visual. Usarlo en producción habría roto la funcionalidad
  central de RF04.
- (+) Librería liviana, sin dependencias de servidor (renderiza
  client-side como SVG).
- (-) Suma una dependencia externa más al bundle del frontend (impacto
  mínimo, es una librería chica).

## Cumplimiento

Verificable en `client/package.json` (dependencia `qrcode.react`) y en
`client/src/modules/acceso/pages/MiQr.tsx`, donde `<QRCodeSVG value={qrToken} />`
recibe directamente el JWT devuelto por `GET /acceso/qr/:usuarioId`, sin
transformación intermedia.

## Notas

Ninguna.
