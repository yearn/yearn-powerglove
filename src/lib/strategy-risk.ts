import type { KongVaultSnapshot } from '@/types/kong'

// A strategy's aggregate rating is distinct from the individual scoring dimensions.
export function getStrategyRiskLevel(snapshot: Pick<KongVaultSnapshot, 'risk'> | null | undefined): number | null {
  const raw = snapshot?.risk?.riskLevel
  if (raw === null || raw === undefined || raw === '') return null
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null
}
