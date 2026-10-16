import type { KongVaultListItem } from '@/types/kong'
import type { CanonicalVaultFee } from './canonical-fees'
import type { ChainFeeHistoryPoint } from './chain-fee-history'
import { canonicalDecimalToNumber, type FeeHistoryPeriod, feeHistoryBoundary } from './fee-history'

export const VAULT_TYPE_SERIES = [
  { key: 'v3', label: 'V3 Allocators & Strategies', shortLabel: 'V3', color: '#0052ff' },
  { key: 'v2-factory', label: 'V2 Factory Vaults', shortLabel: 'V2 Factory', color: '#8b5cf6' },
  { key: 'v2-legacy', label: 'V2 Legacy Allocators', shortLabel: 'V2 Legacy', color: '#f59e0b' },
  { key: 'v1', label: 'V1', shortLabel: 'V1', color: '#16a34a' },
  { key: 'v2-unclassified', label: 'V2 Unclassified', shortLabel: 'V2 Unknown', color: '#64748b' },
  { key: 'other', label: 'Other', shortLabel: 'Other', color: '#ec4899' }
] as const

type VaultType = (typeof VAULT_TYPE_SERIES)[number]['key']

export function classifyVaultType(vault: CanonicalVaultFee, catalog: Map<string, KongVaultListItem>): VaultType {
  switch (vault.contractFamily) {
    case 'yearn-v3-allocator':
    case 'yearn-v3-tokenized-strategy':
      return 'v3'
    case 'yearn-v1-vault':
      return 'v1'
    case 'yearn-v2-vault': {
      const metadata = catalog.get(`${vault.chainId}:${vault.address.toLowerCase()}`)
      if (metadata?.type === 'Automated Yearn Vault') return 'v2-factory'
      if (metadata?.type === 'Yearn Vault' || metadata?.type === 'Experimental Yearn Vault') return 'v2-legacy'
      return 'v2-unclassified'
    }
    default:
      return 'other'
  }
}

export function buildVaultTypeFeeSeries(
  histories: CanonicalVaultFee[][],
  periods: FeeHistoryPeriod[],
  catalog: KongVaultListItem[]
) {
  const indexed = new Map(catalog.map((vault) => [`${vault.chainId}:${vault.address.toLowerCase()}`, vault]))
  const groups = histories.map((vaults) => vaults.map((vault) => ({ vault, type: classifyVaultType(vault, indexed) })))
  const presentTypes = new Set(groups.flatMap((group) => group.map(({ type }) => type)))
  const series = VAULT_TYPE_SERIES.filter((item) => presentTypes.has(item.key))
  const empty = () => Object.fromEntries(series.map((item) => [item.key, 0]))
  const periodic = periods.map(({ period }, index): ChainFeeHistoryPoint => {
    const point = { period, earnings: empty(), fees: empty() }
    for (const { vault, type } of groups[index] ?? []) {
      point.earnings[type] += canonicalDecimalToNumber(vault.lifetimeEarnings.netYieldUsd) ?? 0
      point.fees[type] += canonicalDecimalToNumber(vault.totalFeesPaidUsd) ?? 0
    }
    return point
  })
  const totals = { earnings: empty(), fees: empty() }
  const first = periods[0]
  const cumulative: ChainFeeHistoryPoint[] = first
    ? [{ period: feeHistoryBoundary(first, 'start'), earnings: empty(), fees: empty() }]
    : []
  periodic.forEach((point, index) => {
    for (const item of series) {
      totals.earnings[item.key] += point.earnings[item.key]
      totals.fees[item.key] += point.fees[item.key]
    }
    cumulative.push({
      period: feeHistoryBoundary(periods[index], 'end'),
      earnings: { ...totals.earnings },
      fees: { ...totals.fees }
    })
  })
  return {
    series,
    periodic,
    cumulative,
    totals: series.map((item) => ({ ...item, earnings: totals.earnings[item.key], fees: totals.fees[item.key] }))
  }
}
