import { getAddress } from 'viem'
import type { ChainId } from '@/constants/chains'
import type { YDaemonVault } from '@/types/ydaemon'

const DEFAULT_CHAIN_IDS = [1, 10, 137, 146, 250, 8453, 42161, 747474] as const

type RawStrategy = {
  address?: string
  netAPR?: unknown
  apr?: {
    netAPR?: unknown
  }
} | null

type RawVault = {
  address?: string
  chainID?: number | string
  apr?: {
    forwardAPR?: {
      netAPR?: unknown
    }
  }
  strategies?: RawStrategy[] | null
} | null

const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_PUBLIC_YDAEMON_URL
  if (!url) {
    throw new Error('VITE_PUBLIC_YDAEMON_URL is not defined')
  }
  return url.replace(/\/$/, '')
}

const safeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeVault = (raw: RawVault): YDaemonVault | null => {
  if (!raw?.address || !raw.chainID) {
    return null
  }

  const strategies =
    Array.isArray(raw.strategies) && raw.strategies.length > 0
      ? raw.strategies
          .map((strategy) => {
            if (!strategy?.address) return null
            return {
              address: getAddress(strategy.address),
              netAPR: safeNumber(strategy.netAPR ?? strategy.apr?.netAPR)
            }
          })
          .filter(Boolean)
      : []

  return {
    address: getAddress(raw.address),
    chainID: Number(raw.chainID) as ChainId,
    apr: {
      forwardAPR: {
        netAPR: safeNumber(raw.apr?.forwardAPR?.netAPR)
      }
    },
    strategies: strategies as YDaemonVault['strategies']
  }
}

const buildVaultsQuery = (chainIds?: number[]) => {
  const params = new URLSearchParams({
    hideAlways: 'true',
    orderBy: 'featuringScore',
    orderDirection: 'desc',
    strategiesDetails: 'withDetails',
    strategiesCondition: 'inQueue',
    limit: '2500'
  })

  params.set('chainIDs', (chainIds && chainIds.length > 0 ? chainIds : DEFAULT_CHAIN_IDS).join(','))

  return params.toString()
}

export async function fetchYDaemonVaults(chainIds?: number[]): Promise<YDaemonVault[]> {
  const baseUrl = getBaseUrl()
  const response = await fetch(`${baseUrl}/vaults?${buildVaultsQuery(chainIds)}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch yDaemon vaults: ${response.statusText}`)
  }

  const data = (await response.json()) as unknown
  if (!Array.isArray(data)) {
    return []
  }

  return data.map((vault) => normalizeVault(vault as RawVault)).filter(Boolean) as YDaemonVault[]
}

export async function fetchYDaemonVault(chainId: ChainId, address: string): Promise<YDaemonVault | null> {
  const baseUrl = getBaseUrl()
  const checksummedAddress = getAddress(address)
  const url = `${baseUrl}/${chainId}/vaults/${checksummedAddress}?${new URLSearchParams({
    strategiesDetails: 'withDetails',
    strategiesCondition: 'inQueue'
  }).toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error(`Failed to fetch yDaemon vault ${chainId}:${checksummedAddress}`)
  }

  const data = (await response.json()) as unknown
  return normalizeVault(data as RawVault)
}
