import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1']

const parseAllowedHosts = (value?: string): string[] =>
  (value ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

const yvUsdAprProxy = {
  '/api/yvusd/aprs': {
    target: 'https://yvusd-api.yearn.fi',
    changeOrigin: true,
    rewrite: () => '/api/aprs'
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = [...DEFAULT_ALLOWED_HOSTS, ...parseAllowedHosts(env.LOCAL_VITE_ALLOWED_HOSTS)]

  return {
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
            proxy: yvUsdAprProxy
          }
        : {},
    preview: {
      allowedHosts,
      proxy: yvUsdAprProxy
    }
  }
})
