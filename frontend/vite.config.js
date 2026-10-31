import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: {
    proxy: {
      "/api": {
        // 127.0.0.1 avoids Windows IPv6 localhost (::1) connection refused.
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
})
