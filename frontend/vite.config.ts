import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Bind to all interfaces for WSL access from Windows
    port: 5173
    // No proxy needed - frontend connects directly to backend at http://localhost:8000
    // CORS is configured on the backend to allow localhost:5173
  }
})
