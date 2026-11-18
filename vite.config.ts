import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import vaultPage from './api/vault-page'
import { proxyYearnData } from './api/yearn-data'

const DEFAULT_YEARN_DATA_API = 'https://yearn-data-api-preview.vercel.app'

const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1']

const parseAllowedHosts = (value?: string): string[] =>
  (value ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

const yvUsdAprProxy = {
  '^/api/yvusd/aprs/?(?:\\?|$)': {
    target: 'https://yvusd-api.yearn.fi',
    changeOrigin: true,
    rewrite: () => '/api/aprs'
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = [...DEFAULT_ALLOWED_HOSTS, ...parseAllowedHosts(env.LOCAL_VITE_ALLOWED_HOSTS)]
  const yearnDataApiTarget =
    env.VITE_YEARN_DATA_API_TARGET || env.VITE_PUBLIC_YEARN_DATA_API_URL || DEFAULT_YEARN_DATA_API
  const statsApiProxy: ProxyOptions = {
    async bypass(req, res) {
      if (!res) return false
      const response = {
        setHeader: (name: string, value: string) => res.setHeader(name, value),
        status: (status: number) => ({
          json: (body: unknown) => {
            res.statusCode = status
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(body))
          }
        })
      }
      await proxyYearnData(req, response, {
        target: yearnDataApiTarget,
        token: env.YEARN_DATA_API_PROTECTION_BYPASS
      })
      // Tell Vite the response was handled after its host check, without proxying it again.
      return req.url ?? '/'
    }
  }
  const proxy = { ...yvUsdAprProxy, '/api/': statsApiProxy }

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
            proxy
          }
        : {},
    preview: {
      allowedHosts,
      proxy: {
        ...proxy,
        '^/vaults/[1-9][0-9]*/0x[a-fA-F0-9]{40}/?(?:\\?|$)': {
          async bypass(req, res) {
            if (!req.url || !res) return false
            const [, , chainId, address] = req.url.split('?')[0].split('/')
            await vaultPage({ method: req.method, query: { chainId, address } }, res)
            return req.url
          }
        }
      }
    }
  }
})
