import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

const DEFAULT_YEARN_DATA_API = 'https://yearn-data-api-preview-aqh9st2lq-rossgalloways-projects.vercel.app'

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
  const yearnDataApiTarget =
    env.VITE_YEARN_DATA_API_TARGET || env.VITE_PUBLIC_YEARN_DATA_API_URL || DEFAULT_YEARN_DATA_API
  // This token is server-only. Never give it a VITE_ prefix or include it in browser fetches.
  const hostedDataProxy = {
    ...proxyTo(yearnDataApiTarget),
    ...(env.YEARN_DATA_API_PROTECTION_BYPASS && new URL(yearnDataApiTarget).hostname.endsWith('.vercel.app')
      ? { headers: { 'x-vercel-protection-bypass': env.YEARN_DATA_API_PROTECTION_BYPASS } }
      : {})
  }
  const statsApiProxy = {
    '/api/audit/tree': hostedDataProxy,
    '/api/audit': proxyTo(yearnTvlApiTarget),
    '/api/analytics': hostedDataProxy,
    '/api/comparison/defillama-comparable': hostedDataProxy,
    '/api/comparison': hostedDataProxy,
    '/api/tvl/graph': hostedDataProxy,
    '/api/tvl/overlap': proxyTo(yearnTvlApiTarget),
    '/api/tvl/vaults': proxyTo(yearnTvlApiTarget),
    '/api/tvl': hostedDataProxy,
    '/api/fees/stack': hostedDataProxy,
    '/api/fees': hostedDataProxy,
    '/api/profitability': hostedDataProxy
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
