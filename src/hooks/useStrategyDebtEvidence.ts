import { useQuery } from '@tanstack/react-query'
import { type Address, formatUnits, parseAbi } from 'viem'
import type { ChainId } from '@/constants/chains'
import { CHAIN_ID_TO_BLOCK_EXPLORER } from '@/constants/chains'
import { getPublicClient } from '@/lib/public-client'

const v2VaultStrategiesAbi = parseAbi([
  'function strategies(address) view returns (uint256 performanceFee, uint256 activation, uint256 debtRatio, uint256 minDebtPerHarvest, uint256 maxDebtPerHarvest, uint256 lastReport, uint256 totalDebt, uint256 totalGain, uint256 totalLoss)'
])

const v3VaultStrategiesAbi = parseAbi([
  'function strategies(address) view returns (uint256 activation, uint256 lastReport, uint256 currentDebt, uint256 maxDebt)'
])

const DEFILLAMA_CHAIN_SLUG: Partial<Record<ChainId, string>> = {
  1: 'ethereum',
  10: 'optimism',
  100: 'xdai',
  137: 'polygon',
  250: 'fantom',
  8453: 'base',
  42161: 'arbitrum',
  747474: 'katana',
  80094: 'berachain'
}

type DefiLlamaPriceResponse = {
  coins?: Record<
    string,
    {
      price?: number
      timestamp?: number
    }
  >
}

export type StrategyDebtEvidence = {
  debtRaw: bigint | null
  debtTokens: number | null
  priceUsd: number | null
  priceTimestamp: number | null
  calculatedDebtUsd: number | null
  debtSourceUrl: string
  priceSourceUrl: string | null
}

export type StrategyDebtEvidenceParams = {
  vaultVersion: 2 | 3
  chainId: ChainId
  vaultAddress: string
  strategyAddress: string
  assetAddress: string
  assetDecimals: number
}

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '')

export function buildStrategyDebtSourceUrl(chainId: ChainId, vaultAddress: string, vaultVersion: 2 | 3 = 3): string {
  const explorer = trimTrailingSlash(CHAIN_ID_TO_BLOCK_EXPLORER[chainId])
  const readAnchor = chainId === 1 && vaultVersion === 3 ? '#readContract#F34' : '#readContract'
  return `${explorer}/address/${vaultAddress}${readAnchor}`
}

export function buildDefiLlamaPriceUrl(chainId: ChainId, assetAddress: string): string | null {
  const chainSlug = DEFILLAMA_CHAIN_SLUG[chainId]
  if (!chainSlug) return null

  return `https://coins.llama.fi/prices/current/${chainSlug}:${assetAddress.toLowerCase()}`
}

async function fetchDefiLlamaPrice(priceSourceUrl: string | null, coinKey: string | null) {
  if (!priceSourceUrl || !coinKey) return { priceUsd: null, priceTimestamp: null }

  try {
    const response = await fetch(priceSourceUrl)
    if (!response.ok) return { priceUsd: null, priceTimestamp: null }

    const payload = (await response.json()) as DefiLlamaPriceResponse
    const pricePoint = payload.coins?.[coinKey]
    const priceUsd = pricePoint?.price

    return {
      priceUsd: typeof priceUsd === 'number' && Number.isFinite(priceUsd) && priceUsd >= 0 ? priceUsd : null,
      priceTimestamp:
        typeof pricePoint?.timestamp === 'number' && Number.isFinite(pricePoint.timestamp) ? pricePoint.timestamp : null
    }
  } catch {
    return { priceUsd: null, priceTimestamp: null }
  }
}

export async function fetchStrategyDebtEvidence({
  vaultVersion,
  chainId,
  vaultAddress,
  strategyAddress,
  assetAddress,
  assetDecimals
}: StrategyDebtEvidenceParams): Promise<StrategyDebtEvidence> {
  const chainSlug = DEFILLAMA_CHAIN_SLUG[chainId]
  const coinKey = chainSlug ? `${chainSlug}:${assetAddress.toLowerCase()}` : null
  const priceSourceUrl = buildDefiLlamaPriceUrl(chainId, assetAddress)

  const [debtResult, priceResult] = await Promise.allSettled([
    getPublicClient(chainId).readContract({
      address: vaultAddress as Address,
      abi: vaultVersion === 2 ? v2VaultStrategiesAbi : v3VaultStrategiesAbi,
      functionName: 'strategies',
      args: [strategyAddress as Address]
    }),
    fetchDefiLlamaPrice(priceSourceUrl, coinKey)
  ])

  const debtRaw = debtResult.status === 'fulfilled' ? (debtResult.value[vaultVersion === 2 ? 6 : 2] ?? null) : null
  const parsedDebt = debtRaw === null ? null : Number(formatUnits(debtRaw, assetDecimals))
  const debtTokens = parsedDebt !== null && Number.isFinite(parsedDebt) ? parsedDebt : null
  const { priceUsd, priceTimestamp } =
    priceResult.status === 'fulfilled' ? priceResult.value : { priceUsd: null, priceTimestamp: null }

  return {
    debtRaw,
    debtTokens,
    priceUsd,
    priceTimestamp,
    calculatedDebtUsd: debtTokens !== null && priceUsd !== null ? debtTokens * priceUsd : null,
    debtSourceUrl: buildStrategyDebtSourceUrl(chainId, vaultAddress, vaultVersion),
    priceSourceUrl
  }
}

export function useStrategyDebtEvidence(params: StrategyDebtEvidenceParams, enabled: boolean) {
  return useQuery({
    queryKey: [
      'strategy-debt-evidence',
      params.vaultVersion,
      params.chainId,
      params.vaultAddress.toLowerCase(),
      params.strategyAddress.toLowerCase(),
      params.assetAddress.toLowerCase(),
      params.assetDecimals
    ],
    queryFn: () => fetchStrategyDebtEvidence(params),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false
  })
}
