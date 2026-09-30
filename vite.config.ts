import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { demoApi } from './scripts/demo-api'

// Development defaults to a server-side preview API so all three journeys can
// be tried without a database. Set NEARBUY_DEMO_AUTH=0 to use the real gateway.
export default defineConfig(({ command }) => {
  const demo = command === 'serve' && process.env.NEARBUY_DEMO_AUTH !== '0'
  return {
    plugins: [
      react(),
      ...(demo
        ? [
            {
              name: 'nearbuy-preview-api',
              configureServer: (server: import('vite').ViteDevServer) => {
                server.middlewares.use(demoApi())
              },
            },
          ]
        : []),
    ],
    define: { __NEARBUY_PREVIEW__: JSON.stringify(demo) },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: ['.e2b.app', 'localhost'],
      ...(demo
        ? {}
        : {
            proxy: { '/api': { target: process.env.API_URL ?? 'http://127.0.0.1:4000', changeOrigin: true } },
          }),
    },
    preview: { host: '0.0.0.0', port: 5173, allowedHosts: ['.e2b.app', 'localhost'] },
  }
})
