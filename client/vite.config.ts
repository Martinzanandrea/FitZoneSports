import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Colores tomados de los tokens de src/styles/theme.css (--bg: #071a1d).
const COLOR_FONDO = '#071a1d';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': el usuario decide cuándo actualizar (sin skipWaiting automático).
      registerType: 'prompt',
      // Service worker desactivado en desarrollo.
      devOptions: { enabled: false },
      manifest: {
        name: 'FitZone Sports',
        short_name: 'FitZone',
        lang: 'es-AR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: COLOR_FONDO,
        background_color: COLOR_FONDO,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Solo estáticos del build (JS, CSS, íconos, fuentes locales). Sin HTML de datos ni imágenes de landing.
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        globIgnores: ['images/**', 'robots.txt', 'sitemap.xml'],
        // Fallback SPA para navegaciones; no aplica a sw.js, manifest, la API ni rutas de archivos.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/sw\.js$/,
          /^\/workbox-.*\.js$/,
          /^\/manifest\.webmanifest$/,
          /^\/api\//,
          /\/[^/?]+\.[^/]+$/,
        ],
        cleanupOutdatedCaches: true,
        // Todo lo que no es del propio origen (API en otro origen) o cuelga de /api va siempre a red,
        // sin cachear nada: sesión, QR, pagos y comprobantes viajan con credenciales.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => !sameOrigin || url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
