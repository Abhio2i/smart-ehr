import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_API_BASE_URL || env.API_BASE_URL || 'https://api.ihp.ind.in';

  return {
    base: '/epcr/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        devOptions: {
          enabled: false
        },
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          // Pre-cache assets but EXCLUDE html so index.html is always fetched fresh from Nginx
          globPatterns: ['**/*.{js,css,ico,png,svg}'],
          // Redirect all page route requests to /epcr/index.html when offline
          navigateFallback: '/epcr/index.html',

          // Bypass offline fallbacks for Spring Boot API controllers
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-cache',
              },
            },
          ],
        },
        manifest: {
          name: 'Med ePCR Clinical Portal',
          short_name: 'Med ePCR',
          description: 'Secure, offline-first HIPAA-compliant clinical ePCR assurance platform.',
          theme_color: '#1a3c8f',
          icons: [
            {
              src: 'favicon.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: 'favicon.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ]
        }
      })
    ],
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor';
            if (id.includes('node_modules/@reduxjs') || id.includes('node_modules/react-redux')) return 'redux';
            if (id.includes('node_modules/recharts')) return 'charts';
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/framer-motion')) return 'ui';
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          // Rewrite Set-Cookie domain so browser stores cookies under localhost:5173
          cookieDomainRewrite: { '*': '' },
        },
        '/files': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
})
