import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
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
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // A production build has no proxy: it must be told where the API lives (set it in Vercel)
  if (command === 'build' && !/^https?:\/\//.test(env.VITE_API_BASE_URL || '')) {
    throw new Error('VITE_API_BASE_URL must be the full API address for a production build, e.g. https://your-api.onrender.com/api')
  }

  return {
    plugins: [react()],
    server: {
      host: true,
      proxy: {
        '/api': { target: BACKEND, configure: asLocalOrigin },
        '/socket.io': { target: BACKEND, ws: true, configure: asLocalOrigin },
      },
    },
  }
})
