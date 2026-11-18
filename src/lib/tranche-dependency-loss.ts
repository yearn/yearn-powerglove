import policy from '@/mock-data/tranche-allocation-policy.json'

export function policyLossRate(score: number | null): number | null {
  if (score === null || !Number.isInteger(score) || score < 1 || score > 5) return null
  return policy.lossRateByRiskScore[String(score) as keyof typeof policy.lossRateByRiskScore]
}

/** Upstream _link formula. Missing inputs must never become zero losses or 1× leverage. */
export function dependencyPositionLoss({
  capital,
  score,
  leverage,
  weight,
  exitDiscount
}: {
  capital: number
  score: number | null
  leverage: number | null
  weight: number | null
  exitDiscount: number | null
}): number | null {
  const baseRate = policyLossRate(score)
  if (
    baseRate === null ||
    !Number.isFinite(capital) ||
    capital < 0 ||
    leverage === null ||
    !Number.isFinite(leverage) ||
    leverage < 1 ||
    weight === null ||
    !Number.isFinite(weight) ||
    weight < 0 ||
    weight > 1 ||
    exitDiscount === null ||
    !Number.isFinite(exitDiscount) ||
    exitDiscount < 0 ||
    exitDiscount > 1
  )
    return null
  return Math.min(capital * leverage * weight * Math.min(baseRate + exitDiscount, 1), capital * weight)
}
