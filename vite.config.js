import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: 'localhost'
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'mediapipe': ['@mediapipe/face_mesh'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'leaflet': ['leaflet', 'react-leaflet']
        }
      }
    }
  }
})
