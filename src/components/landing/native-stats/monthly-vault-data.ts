import { deriveVaultType } from '@/lib/kong-vault-derivation'
import type { KongVaultListItem } from '@/types/kong'
import { getVaultDisplayType } from '@/utils/vaultDataUtils'
import type { CanonicalVaultFee, CanonicalVaultHistoryFee } from './canonical-fees'
import { canonicalDecimalToNumber, type FeeHistoryPeriod } from './fee-history'

export function completedFeeMonths(now: number): FeeHistoryPeriod[] {
  const date = new Date(now * 1000)
  return Array.from({ length: 12 }, (_, index) => {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 12 + index, 1))
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
    return {
      period: start.toISOString().slice(0, 7),
      startTimestamp: start.getTime() / 1000,
      endTimestamp: end.getTime() / 1000
    }
  })
}
export const monthlyVaultKey = (vault: Pick<CanonicalVaultFee, 'chainId' | 'address'>) =>
  `${vault.chainId}:${vault.address.toLowerCase()}`
export type MonthlyFeeVault = Pick<CanonicalVaultFee, 'chainId' | 'address' | 'name'> &
  Pick<KongVaultListItem, 'type' | 'kind' | 'vaultType' | 'apiVersion' | 'v3' | 'isHidden'> & {
    contractFamily?: string
  }
export interface MonthlyVaultRow {
  vault: MonthlyFeeVault
  vaultType: string
  months: Array<number | null>
  total: number | null
}
export function buildMonthlyVaultRows(
  catalog: CanonicalVaultFee[],
  histories: CanonicalVaultHistoryFee[][],
  metadata: MonthlyFeeVault[] = [],
  metric: 'fees' | 'earnings' = 'fees'
): MonthlyVaultRow[] {
  const published = new Map([...catalog, ...histories.flat()].map((vault) => [monthlyVaultKey(vault), vault]))
  const vaults = new Map<string, MonthlyFeeVault>(published)
  const groupedMembers = new Set(
    [...published.values()].flatMap((vault) =>
      (vault.memberAddresses ?? [])
        .filter((address) => address.toLowerCase() !== vault.address.toLowerCase())
        .map((address) => monthlyVaultKey({ chainId: vault.chainId, address }))
    )
  )
  for (const vault of metadata) {
    const key = monthlyVaultKey(vault)
    if (groupedMembers.has(key)) continue
    vaults.set(key, { ...published.get(key), ...vault, name: published.get(key)?.name || vault.name })
  }
  const months = histories.map((rows) => new Map(rows.map((vault) => [monthlyVaultKey(vault), vault])))
  return [...vaults]
    .filter(([, vault]) => vault.isHidden !== true)
    .map(([key, vault]) => {
      const values = months.map((rows) => {
        const row = rows.get(key)
        if (row)
          return canonicalDecimalToNumber(metric === 'fees' ? row.totalFeesPaidUsd : row.lifetimeEarnings?.netYieldUsd)
        const known = published.get(key)
        return known && (metric === 'fees' || canonicalDecimalToNumber(known.lifetimeEarnings?.netYieldUsd) !== null)
          ? 0
          : null
      })
      return {
        vault,
        vaultType: monthlyVaultType(vault),
        months: values,
        total: values.some((value) => value === null)
          ? null
          : values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      }
    })
}
export function monthlyUsd(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.abs(value) < 0.5 ? 0 : value)
}

export function monthlyVaultType(vault: MonthlyFeeVault): string {
  return getVaultDisplayType({
    name: vault.name ?? '',
    apiVersion:
      vault.apiVersion ??
      (vault.contractFamily === 'yearn-v2-vault' || vault.contractFamily === 'yearn-v1-vault' ? '0' : ''),
    vaultType: deriveVaultType({
      ...vault,
      v3: vault.v3 || vault.contractFamily === 'yearn-v3-allocator',
      tokenizedStrategy: vault.contractFamily === 'yearn-v3-tokenized-strategy'
    })
  }).replace(/ Vault$/, '')
}
