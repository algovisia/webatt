import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue2';
import { VitePWA } from 'vite-plugin-pwa';

const APP_NAME = 'WebAtt - Absen';
const APP_SHORT_NAME = 'WebAtt';
const APP_DESCRIPTION = 'Aplikasi absensi karyawan WebAtt yang tetap bekerja saat offline.';
const THEME_COLOR = '#DC2626';
const DEFAULT_API_BASE_URL = 'https://sdm.visualdata.co.id/api';

const normalizeBasePath = value => {
  if (!value) {
    return '/';
  }
  let normalized = value.trim();
  if (!normalized) {
    return '/';
  }
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  if (!normalized.endsWith('/')) {
    normalized = `${normalized}/`;
  }
  normalized = normalized.replace(/\/{2,}/g, '/');
  return normalized || '/';
};

const withBase = (base, path = '') => {
  const cleanPath = path.replace(/^\//, '');
  return `${base}${cleanPath}`;
};

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const basePath = normalizeBasePath(
    env.VITE_BASE_PATH || env.APP_BASE_PATH || env.BASE_PATH || '/'
  );
  const apiBaseUrl =
    env.VITE_API_BASE_URL ||
    env.APP_API_BASE_URL ||
    env.API_BASE_URL ||
    DEFAULT_API_BASE_URL;
  let apiOrigin;
  try {
    apiOrigin = new URL(apiBaseUrl).origin;
  } catch {
    apiOrigin = new URL(DEFAULT_API_BASE_URL).origin;
  }
  const apiOriginPattern = new RegExp(`^${escapeRegex(apiOrigin)}`);

  return {
    base: basePath,
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: APP_NAME,
          short_name: APP_SHORT_NAME,
          description: APP_DESCRIPTION,
          theme_color: THEME_COLOR,
          background_color: '#ffffff',
          display: 'standalone',
          start_url: withBase(basePath),
          scope: withBase(basePath),
          orientation: 'portrait',
          icons: [
            {
              src: withBase(basePath, 'pwa-192x192.png'),
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: withBase(basePath, 'pwa-512x512.png'),
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: apiOriginPattern,
              handler: 'NetworkFirst',
              method: 'GET',
              options: {
                cacheName: 'webatt-api-cache',
                networkTimeoutSeconds: 8,
                cacheableResponse: {
                  statuses: [0, 200]
                },
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 15 * 60
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          suppressWarnings: true,
          navigateFallback: 'index.html'
        }
      })
    ],
    server: {
      host: true
    }
  };
});
