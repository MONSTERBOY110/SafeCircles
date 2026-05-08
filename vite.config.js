import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Read .env.local etc. so VITE_TUNNEL_MODE is available here.
  const env = loadEnv(mode, process.cwd(), '');
  const tunnelMode = !!env.VITE_TUNNEL_MODE;

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: 'localhost',
      // Allow localtunnel / ngrok / cloudflared subdomains to proxy to this dev server.
      allowedHosts: ['.loca.lt', '.ngrok-free.app', '.ngrok.io', '.trycloudflare.com'],
      // When VITE_TUNNEL_MODE is set, point the HMR WebSocket at the page host on 443
      // so the browser connects back through the tunnel (wss://<tunnel>.trycloudflare.com).
      // Without this, the client tries wss://<tunnel>:3000 which isn't reachable.
      hmr: tunnelMode ? { protocol: 'wss', clientPort: 443 } : undefined,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'mediapipe': ['@mediapipe/face_mesh'],
            'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'leaflet': ['leaflet', 'react-leaflet'],
            'tfjs': ['@tensorflow/tfjs'],
            'vad': ['@ricky0123/vad-web', 'onnxruntime-web']
          }
        }
      }
    }
  };
})
