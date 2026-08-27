const BASIS_POINTS = 10_000
const COMPOUNDING_PERIODS_PER_YEAR = 52

const finiteOrNull = (value: number | null | undefined): number | null =>
  value !== null && value !== undefined && Number.isFinite(value) ? value : null

export const aprToWeeklyApy = (apr: number): number =>
  (1 + apr / COMPOUNDING_PERIODS_PER_YEAR) ** COMPOUNDING_PERIODS_PER_YEAR - 1

export const weeklyApyToApr = (apy: number): number =>
  ((1 + apy) ** (1 / COMPOUNDING_PERIODS_PER_YEAR) - 1) * COMPOUNDING_PERIODS_PER_YEAR

export const deriveNetAprFromGrossApr = (
  grossApr: number | null | undefined,
  managementFeeBps = 0,
  performanceFeeBps = 0
): number | null => {
  const normalizedGrossApr = finiteOrNull(grossApr)
  if (normalizedGrossApr === null) return null

  const managementFee = Math.max(0, managementFeeBps) / BASIS_POINTS
  const performanceFee = Math.min(Math.max(0, performanceFeeBps), BASIS_POINTS) / BASIS_POINTS

  return Math.max(normalizedGrossApr - managementFee, 0) * (1 - performanceFee)
}

export const resolveOracleRates = ({
  netApy,
  netApr,
  grossApr,
  managementFeeBps = 0,
  performanceFeeBps = 0
}: {
  netApy?: number | null
  netApr?: number | null
  grossApr?: number | null
  managementFeeBps?: number
  performanceFeeBps?: number
}): { netApr: number; netApy: number } | null => {
  const publishedNetApy = finiteOrNull(netApy)
  const publishedNetApr = finiteOrNull(netApr)
  if (publishedNetApy !== null) {
    return {
      netApr: publishedNetApr ?? weeklyApyToApr(publishedNetApy),
      netApy: publishedNetApy
    }
  }
  if (publishedNetApr !== null) {
    return { netApr: publishedNetApr, netApy: aprToWeeklyApy(publishedNetApr) }
  }

  const derivedNetApr = deriveNetAprFromGrossApr(grossApr, managementFeeBps, performanceFeeBps)
  return derivedNetApr === null ? null : { netApr: derivedNetApr, netApy: aprToWeeklyApy(derivedNetApr) }
}

export const resolveOracleNetApy = (input: Parameters<typeof resolveOracleRates>[0]): number | null =>
  resolveOracleRates(input)?.netApy ?? null
