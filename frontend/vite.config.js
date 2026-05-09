import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.local lives at the repo root (one level up from frontend/).
const envDir = path.resolve(__dirname, '..');

/**
 * Templates frontend/public/firebase-messaging-sw.js by substituting the
 * __FIREBASE_*__ placeholders with real values from .env.local at build time.
 * This keeps the SW source clean (no inline secrets) and ensures the deployed
 * SW initialises Firebase correctly.
 */
function fcmSwTemplaterPlugin(env) {
  const swSourcePath = path.resolve(__dirname, 'public/firebase-messaging-sw.js');
  return {
    name: 'fcm-sw-templater',
    apply: 'build',
    generateBundle() {
      if (!fs.existsSync(swSourcePath)) return;
      const raw = fs.readFileSync(swSourcePath, 'utf8');
      const filled = raw
        .replace(/__FIREBASE_API_KEY__/g, env.VITE_FIREBASE_API_KEY || '')
        .replace(/__FIREBASE_AUTH_DOMAIN__/g, env.VITE_FIREBASE_AUTH_DOMAIN || '')
        .replace(/__FIREBASE_PROJECT_ID__/g, env.VITE_FIREBASE_PROJECT_ID || '')
        .replace(/__FIREBASE_STORAGE_BUCKET__/g, env.VITE_FIREBASE_STORAGE_BUCKET || '')
        .replace(/__FIREBASE_MESSAGING_SENDER_ID__/g, env.VITE_FIREBASE_MESSAGING_SENDER_ID || '')
        .replace(/__FIREBASE_APP_ID__/g, env.VITE_FIREBASE_APP_ID || '');
      this.emitFile({ type: 'asset', fileName: 'firebase-messaging-sw.js', source: filled });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const tunnelMode = !!env.VITE_TUNNEL_MODE;

  return {
    envDir,
    plugins: [
      react(),
      fcmSwTemplaterPlugin(env),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        devOptions: { enabled: false },
        // FCM ships its own SW; we don't want Workbox precaching it or claiming
        // its scope.
        includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
        manifest: {
          name: 'SafeCircles',
          short_name: 'SafeCircles',
          description: 'Real-time safety companion for verified women walking together',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0B132B',
          theme_color: '#0B132B',
          categories: ['safety', 'social', 'travel'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            { name: 'Dashboard', url: '/dashboard', description: 'Open SafeCircles dashboard' },
            { name: 'My Trips', url: '/trips', description: 'View your trips' },
            { name: 'Profile', url: '/profile', description: 'View your profile' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}'],
          globIgnores: [
            '**/frames/**',
            '**/crepe/**',
            '**/vad/**',
            '**/mediapipe/**',
            '**/firebase-messaging-sw.js',
          ],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/__/,
            /^\/firebase-messaging-sw\.js$/,
          ],
          runtimeCaching: [
            // Google Fonts — long-lived, infrequent updates
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts-stylesheets' },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // OpenStreetMap / CARTO tiles — used by Leaflet maps
            {
              urlPattern: /^https:\/\/.+\.tile\.openstreetmap\.org\//,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'osm-tiles',
                expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /^https:\/\/.+\.basemaps\.cartocdn\.com\//,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'cartocdn-tiles',
                expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
              },
            },
            // Cloudinary scroll frames — content-addressed, cache aggressively
            {
              urlPattern: /^https:\/\/res\.cloudinary\.com\/dbltkxnne\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'cloudinary-frames',
                expiration: {
                  maxEntries: 700,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                  purgeOnQuotaError: true,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Heavy local assets (CREPE / VAD / MediaPipe) when actually fetched
            {
              urlPattern: ({ url }) => /\/(crepe|vad|mediapipe)\//.test(url.pathname),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'media-assets',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            // Firebase APIs — never cache; SDK manages its own IndexedDB cache
            {
              urlPattern: ({ url }) =>
                /\.(googleapis|firebaseio|firebaseinstallations|firebaseapp)\.com$/.test(url.hostname) ||
                /^(firestore|identitytoolkit|securetoken|firebaseinstallations)\./.test(url.hostname),
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
    server: {
      port: 3000,
      host: 'localhost',
      allowedHosts: ['.loca.lt', '.ngrok-free.app', '.ngrok.io', '.trycloudflare.com'],
      hmr: tunnelMode ? { protocol: 'wss', clientPort: 443 } : undefined,
      watch: {
        // Don't pin chokidar file descriptors on ~100 MB of static assets.
        ignored: [
          '**/public/frames/**',
          '**/public/crepe/**',
          '**/public/vad/**',
          '**/public/mediapipe/**',
        ],
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'mediapipe': ['@mediapipe/face_mesh'],
            'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/messaging'],
            'leaflet': ['leaflet', 'react-leaflet'],
            'tfjs': ['@tensorflow/tfjs'],
            'vad': ['@ricky0123/vad-web', 'onnxruntime-web'],
          },
        },
      },
    },
  };
});
