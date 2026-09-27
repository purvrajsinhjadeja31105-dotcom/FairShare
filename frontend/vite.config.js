import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server forwards /api and /socket.io to the local backend, so a phone on the same Wi-Fi
// only needs the laptop's address (http://<laptop-ip>:5173). The Origin header is rewritten to the
// laptop's own origin so the backend's CORS list doesn't need every LAN address.
const BACKEND = 'http://localhost:5000'
const asLocalOrigin = (proxy) => {
  const rewrite = (proxyReq) => proxyReq.setHeader('origin', 'http://localhost:5173')
  proxy.on('proxyReq', rewrite)
  proxy.on('proxyReqWs', rewrite)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': { target: BACKEND, configure: asLocalOrigin },
      '/socket.io': { target: BACKEND, ws: true, configure: asLocalOrigin },
    },
  },
})
