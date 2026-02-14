import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Bind to all interfaces for WSL access from Windows
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/events': { target: 'http://localhost:8000', changeOrigin: true },
      '/stream': { target: 'http://localhost:8000', changeOrigin: true }
    }
  }
})
