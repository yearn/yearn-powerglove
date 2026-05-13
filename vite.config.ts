import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

const allowedHosts = ['localhost', '127.0.0.1', 'dev-vm.tail197cc7.ts.net']
const yearnMetricsApiTarget =
  process.env.VITE_YEARN_METRICS_API_TARGET || process.env.VITE_PUBLIC_YEARN_METRICS_API_URL || 'http://127.0.0.1:3456'
const yearnMetricsApiProxy = {
  '/api/tvl': {
    target: yearnMetricsApiTarget,
    changeOrigin: true
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [TanStackRouterVite({ target: 'react', autoCodeSplitting: true }), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server:
    process.env.NODE_ENV === 'development'
      ? {
          allowedHosts,
          proxy: yearnMetricsApiProxy
        }
      : {},
  preview: {
    allowedHosts,
    proxy: yearnMetricsApiProxy
  }
})
