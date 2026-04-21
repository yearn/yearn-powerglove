import { useQuery } from '@tanstack/react-query'
import { augmentStrategiesFromExplain, parseExplainMetadata, type RawStrategyDebtRatio } from '@/lib/explain-parser'
import { fetchStrategyDisplayNames, fetchVaultStrategies } from '@/lib/kong-strategy-names'
import { assignStrategyColors } from '@/lib/strategyColors'
import type { ReallocationData, ReallocationStrategy } from '@/types/reallocationTypes'

const REALLOCATION_API_URL = import.meta.env.VITE_PUBLIC_REALLOCATION_API_URL || ''

const TOTAL_BPS = 10000
const NORMALIZATION_TOLERANCE_BPS = 5

interface RawVaultOptimization {
  vault: string
  strategyDebtRatios: RawStrategyDebtRatio[]
  currentApr: number
  proposedApr: number
  explain: string
}

interface OptimizationSourceMeta {
  key: string
  chainId: number | null
  revision: string
  isLatestAlias: boolean
  timestampUtc: string | null
  latestMatchedTimestampUtc: string | null
}

interface VaultOptimizationRecord extends RawVaultOptimization {
  source: OptimizationSourceMeta
}

function applyKongNames(
  data: ReallocationData,
  namesByAddress: Record<string, { name: string; fromVault: boolean }>
): ReallocationData {
  if (!namesByAddress || Object.keys(namesByAddress).length === 0) return data

  return {
    ...data,
    strategies: data.strategies.map((strategy) => {
      if (!strategy.strategyAddress || strategy.isUnallocated) return strategy
      const nameInfo = namesByAddress[strategy.strategyAddress.toLowerCase()]
      if (!nameInfo) return strategy
      return { ...strategy, name: nameInfo.name }
    })
  }
}

function transformRawReallocation(
  raw: VaultOptimizationRecord,
  vaultStrategyLookup: Map<string, string>
): ReallocationData {
  const metadata = parseExplainMetadata(raw.explain)

  const { strategies: augmentedStrategies, syntheticStrategyKeysByAddress } = augmentStrategiesFromExplain(
    raw.explain,
    raw.vault,
    raw.strategyDebtRatios,
    vaultStrategyLookup
  )

  const inputStrategies = augmentedStrategies.map((s, i) => ({
    ...s,
    name: s.name?.trim() || `Strategy ${i + 1}`
  }))

  let strategies = inputStrategies
  let hasUnallocated = false
  let unallocatedBps = 0

  const totalCurrentBps = strategies.reduce((sum, s) => sum + s.currentRatio, 0)
  const totalTargetBps = strategies.reduce((sum, s) => sum + s.targetRatio, 0)
  const unallocatedCurrentBps = Math.max(0, TOTAL_BPS - totalCurrentBps)
  const unallocatedTargetBps = Math.max(0, TOTAL_BPS - totalTargetBps)

  if (unallocatedCurrentBps > NORMALIZATION_TOLERANCE_BPS || unallocatedTargetBps > NORMALIZATION_TOLERANCE_BPS) {
    hasUnallocated = unallocatedCurrentBps > NORMALIZATION_TOLERANCE_BPS
    unallocatedBps = unallocatedCurrentBps

    strategies = [
      ...strategies,
      {
        strategy: 'unallocated',
        name: 'Unallocated',
        currentRatio: unallocatedCurrentBps,
        targetRatio: unallocatedTargetBps,
        currentApr: null as number | null,
        targetApr: null as number | null
      }
    ]
  }

  const strategyKeys: string[] = []
  const usedKeys = new Set<string>()
  for (const strategy of strategies) {
    const normalizedAddress = strategy.strategy.toLowerCase()
    const baseKey = syntheticStrategyKeysByAddress.get(normalizedAddress) ?? normalizedAddress
    let resolvedKey = baseKey
    let duplicateCounter = 1
    while (usedKeys.has(resolvedKey)) {
      duplicateCounter += 1
      resolvedKey = `${baseKey}#${duplicateCounter}`
    }
    usedKeys.add(resolvedKey)
    strategyKeys.push(resolvedKey)
  }

  const colorMap = assignStrategyColors(strategyKeys)

  const normalizedStrategies: ReallocationStrategy[] = strategies.map((strategy, index) => {
    const currentApr = strategy.currentApr ?? null
    const targetApr = strategy.targetApr ?? null
    const allocationDeltaBps = strategy.targetRatio - strategy.currentRatio
    const aprDeltaBps = currentApr !== null && targetApr !== null ? targetApr - currentApr : null

    const normalizedAddress = strategy.strategy.toLowerCase()
    const baseSyntheticKey = syntheticStrategyKeysByAddress.get(normalizedAddress)
    const isUnallocated = strategy.strategy === 'unallocated'

    return {
      strategyKey: strategyKeys[index],
      strategyAddress: baseSyntheticKey || isUnallocated ? null : strategy.strategy,
      name: strategy.name!,
      isUnallocated,
      currentRatioPct: strategy.currentRatio / 100,
      targetRatioPct: strategy.targetRatio / 100,
      allocationDeltaPct: allocationDeltaBps / 100,
      currentAprPct: currentApr !== null ? currentApr / 100 : null,
      targetAprPct: targetApr !== null ? targetApr / 100 : null,
      aprDeltaPct: aprDeltaBps !== null ? aprDeltaBps / 100 : null,
      color: isUnallocated ? '#9ca3af' : (colorMap.get(strategyKeys[index]) ?? '#9ca3af')
    }
  })

  const vaultAprCurrentPct = raw.currentApr / 100
  const vaultAprProposedPct = raw.proposedApr / 100

  const timestampUtc = raw.source?.isLatestAlias
    ? raw.source.latestMatchedTimestampUtc
    : (raw.source?.timestampUtc ?? null)

  return {
    vault: raw.vault,
    vaultLabel: metadata.vaultLabel ?? `${raw.vault.slice(0, 6)}...${raw.vault.slice(-4)}`,
    chainId: metadata.chainId,
    chainName: metadata.chainName,
    tvl: metadata.tvl,
    tvlUnit: metadata.tvlUnit,
    strategies: normalizedStrategies,
    vaultAprCurrentPct,
    vaultAprProposedPct,
    vaultAprDeltaPct: vaultAprProposedPct - vaultAprCurrentPct,
    hasUnallocated,
    unallocatedBps,
    timestampUtc,
    sourceKey: raw.source?.key ?? 'api'
  }
}

export function useReallocationData(vaultAddress: string): {
  data: ReallocationData | null
  isLoading: boolean
} {
  const { data, isLoading, error } = useQuery<ReallocationData | null, Error>({
    queryKey: ['reallocation', vaultAddress.toLowerCase()],
    queryFn: async () => {
      if (!REALLOCATION_API_URL) return null

      const response = await fetch(`${REALLOCATION_API_URL}?vault=${vaultAddress.toLowerCase()}`)
      if (!response.ok) {
        console.warn(`[reallocation] API returned ${response.status} for vault ${vaultAddress}`)
        return null
      }

      const raw = (await response.json()) as VaultOptimizationRecord | null
      if (!raw || !raw.strategyDebtRatios) {
        console.warn(`[reallocation] No strategyDebtRatios in response for vault ${vaultAddress}`)
        return null
      }

      const chainId = raw.source?.chainId ?? parseExplainMetadata(raw.explain).chainId ?? null
      const strategyAddresses = raw.strategyDebtRatios.map((s) => s.strategy).filter(Boolean)

      const [vaultStrategyLookup, namesByAddress] = await Promise.all([
        chainId !== null
          ? fetchVaultStrategies(chainId, vaultAddress).catch((err) => {
              console.warn('[reallocation] fetchVaultStrategies failed', err)
              return new Map()
            })
          : Promise.resolve(new Map()),
        chainId !== null && strategyAddresses.length > 0
          ? fetchStrategyDisplayNames(chainId, strategyAddresses).catch((err) => {
              console.warn('[reallocation] fetchStrategyDisplayNames failed', err)
              return {}
            })
          : Promise.resolve({}),
      ])

      const baseData = transformRawReallocation(raw, vaultStrategyLookup)
      return applyKongNames(baseData, namesByAddress)
    },
    staleTime: 10 * 60 * 1000,
    enabled: Boolean(vaultAddress),
    retry: 1,
  })

  if (error) {
    console.warn(`[reallocation] query error for vault ${vaultAddress}:`, error)
  }

  return {
    data: data ?? null,
    isLoading,
  }
}
