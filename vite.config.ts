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

const proxyTo = (target: string) => ({ target, changeOrigin: true })

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
  const legacyMetricsApiTarget = env.VITE_YEARN_METRICS_API_TARGET || env.VITE_PUBLIC_YEARN_METRICS_API_URL
  const yearnTvlApiTarget =
    env.VITE_YEARN_TVL_API_TARGET ||
    env.VITE_PUBLIC_YEARN_TVL_API_URL ||
    legacyMetricsApiTarget ||
    'http://127.0.0.1:3460'
  const yearnFeesApiTarget =
    env.VITE_YEARN_FEES_API_TARGET ||
    env.VITE_PUBLIC_YEARN_FEES_API_URL ||
    legacyMetricsApiTarget ||
    'http://127.0.0.1:3482'
  const yearnDataApiTarget = env.VITE_YEARN_DATA_API_TARGET || env.VITE_PUBLIC_YEARN_DATA_API_URL || yearnFeesApiTarget
  const migratedTvlApiTarget = env.VITE_YEARN_DATA_API_TARGET || env.VITE_PUBLIC_YEARN_DATA_API_URL || yearnTvlApiTarget
  const statsApiProxy = {
    '/api/audit/tree': proxyTo(migratedTvlApiTarget),
    '/api/audit': proxyTo(yearnTvlApiTarget),
    '/api/comparison/defillama-comparable': proxyTo(yearnTvlApiTarget),
    '/api/comparison': proxyTo(migratedTvlApiTarget),
    '/api/tvl/graph': proxyTo(yearnTvlApiTarget),
    '/api/tvl/overlap': proxyTo(yearnTvlApiTarget),
    '/api/tvl/vaults': proxyTo(yearnTvlApiTarget),
    '/api/tvl': proxyTo(migratedTvlApiTarget),
    '/api/fees/stack': proxyTo(yearnFeesApiTarget),
    '/api/fees': proxyTo(yearnDataApiTarget),
    '/api/profitability': proxyTo(yearnFeesApiTarget)
  }
  const appApiProxy = { ...yvUsdAprProxy, ...statsApiProxy }

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
            proxy: appApiProxy
          }
        : {},
    preview: {
      allowedHosts,
      proxy: appApiProxy
    }
  }
})
