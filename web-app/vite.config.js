import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://dangkyapi.hcmute.edu.vn',
        changeOrigin: true,
        secure: false,
        headers: {
          'origin': 'https://dkmh.hcmute.edu.vn',
          'referer': 'https://dkmh.hcmute.edu.vn/'
        }
      }
    }
  }
})
