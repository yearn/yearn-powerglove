import { lastSimulationPoint, trancheSimulation } from '@/lib/tranche-mock-data'
import exposures from '@/mock-data/tranche-allocation-exposures.json'
import inputs from '@/mock-data/tranche-allocation-inputs.json'
import policy from '@/mock-data/tranche-allocation-policy.json'

export type AllocationStatus = 'Within limit' | 'Near limit' | 'Breach' | 'Needs data'
export type AllocationCheck = {
  rule: number
  name: string
  value: number | null
  limit: number | null
  direction: 'min' | 'max'
  unit: 'percent' | 'usd' | 'multiple' | 'days'
  status: AllocationStatus
  detail: string
}

export function allocationStatus(
  value: number | null,
  limit: number | null,
  direction: 'min' | 'max'
): AllocationStatus {
  if (value === null || limit === null || !Number.isFinite(value) || !Number.isFinite(limit)) return 'Needs data'
  if (direction === 'max') {
    if (value > limit) return 'Breach'
    return value >= limit * (1 - policy.warningMargin) ? 'Near limit' : 'Within limit'
  }
  if (value < limit) return 'Breach'
  return value <= limit * (1 + policy.warningMargin) ? 'Near limit' : 'Within limit'
}

export function worstAllocationStatus(statuses: AllocationStatus[]): AllocationStatus {
  const order: AllocationStatus[] = ['Within limit', 'Near limit', 'Needs data', 'Breach']
  return statuses.reduce(
    (worst, status) => (order.indexOf(status) > order.indexOf(worst) ? status : worst),
    'Within limit'
  )
}

export function getTrancheAllocationHealth() {
  const balances = lastSimulationPoint.tranches
  const tvl = balances.senior.nav + balances.junior.nav + balances.equity.nav
  // Illustrative risk inputs affect this assessment only, never the returns simulation.
  const cooldownWithdrawals = inputs.cooldownWithdrawalsUsd
  const juniorCapital = balances.junior.nav + balances.equity.nav - cooldownWithdrawals
  const annualObligations = (['senior', 'junior', 'equity'] as const).reduce(
    (sum, id) => sum + (balances[id].nav * trancheSimulation.config.targetBps[id]) / 10000,
    0
  )
  const requiredYield = annualObligations / tvl
  const dependencies = inputs.dependencies.map((dependency) => {
    const strategies = exposures.strategies.filter((strategy) => {
      const mapping =
        inputs.strategyDependencies[strategy.address.toLowerCase() as keyof typeof inputs.strategyDependencies]
      return mapping?.includes(dependency.name)
    })
    const exposure = strategies.reduce((sum, strategy) => sum + strategy.allocationUsd, 0)
    const exposureShare = exposure / exposures.totalAllocationUsd
    const loss = exposure * dependency.lossRate
    const exposureCap = Math.min(
      exposures.totalAllocationUsd * policy.dependencyShareMax,
      (juniorCapital * policy.dependencyLossMax) / dependency.lossRate
    )
    return {
      ...dependency,
      strategies,
      exposureShare,
      exposure,
      loss,
      headroom: exposureCap - exposure,
      status: worstAllocationStatus([
        allocationStatus(exposureShare, policy.dependencyShareMax, 'max'),
        allocationStatus(loss, juniorCapital * policy.dependencyLossMax, 'max')
      ])
    }
  })
  const riskGroups = Object.entries(policy.riskGroupCaps).map(([score, limit]) => {
    const amount = exposures.strategies.reduce((sum, strategy) => {
      const affected = dependencies.some(
        (dependency) =>
          dependency.riskScore >= Number(score) &&
          dependency.strategies.some((item) => item.address === strategy.address)
      )
      return sum + (affected ? strategy.allocationUsd : 0)
    }, 0)
    const value = amount / exposures.totalAllocationUsd
    return { score: Number(score), value, limit, status: allocationStatus(value, limit, 'max') }
  })
  const yieldCoverage = inputs.reliableYield / requiredYield
  const newStrategyLimit = ((juniorCapital * policy.dependencyLossMax) / inputs.newStrategyLossRate) * 0.25
  const rows: Omit<AllocationCheck, 'status'>[] = [
    {
      rule: 8,
      name: 'Junior capital',
      value: juniorCapital / tvl,
      limit: policy.juniorShareMin,
      direction: 'min',
      unit: 'percent',
      detail:
        'Junior + Equity, excluding withdrawals in cooldown. Mock queue: $150,000 excluded from the risk budget. Includes economically booked locked profits.'
    },
    {
      rule: 1,
      name: 'Single-dependency loss',
      value: Math.max(...dependencies.map((dependency) => dependency.loss)),
      limit: juniorCapital * policy.dependencyLossMax,
      direction: 'max',
      unit: 'usd',
      detail:
        'Actual strategy debt amounts are aggregated using illustrative dependency mappings. Loss rates are mock assumptions. Gross leverage, collateral look-through and exit discounts are not measured; this is not a verified risk assessment.'
    },
    {
      rule: 2,
      name: 'Dependency concentration',
      value: Math.max(...dependencies.map((dependency) => dependency.exposureShare)),
      limit: policy.dependencyShareMax,
      direction: 'max',
      unit: 'percent',
      detail:
        'Exposure shares use actual debt amounts divided by the captured allocation snapshot total, not simulated TVL. Dependency mappings remain illustrative; shared dependencies overlap. Internal loop leverage and collateral exposures are not measured.'
    },
    {
      rule: 3,
      name: 'Stress-scenario loss',
      value: juniorCapital * inputs.stressLossAsJuniorShare,
      limit: juniorCapital * policy.stressLossMax,
      direction: 'max',
      unit: 'usd',
      detail:
        'Mock combined USD stress loss equals 70% of the junior risk budget, below but within 10% of its 75% cap. This is an assumed scenario result, not a measured stress test.'
    },
    {
      rule: 4,
      name: 'Reliable yield coverage',
      value: yieldCoverage,
      limit: policy.reliableYieldCoverMin,
      direction: 'min',
      unit: 'multiple',
      detail:
        'Mock reliable yield is 6.40%, excluding assumed incentives, compared with current simulated target obligations. This is an illustrative forward-yield assumption.'
    },
    {
      rule: 5,
      name: 'Locked-in income · 60 days',
      value: inputs.lockedIncome60dUsd,
      limit: null,
      direction: 'min',
      unit: 'usd',
      detail:
        'Policy unresolved: GUIDELINES.md requires 25% of the next 60 days’ obligations; rules.yaml specifies 50%. Needs confirmed policy, maturities and contractual income. Vault profit-unlock balances do not count as locked-in future income.'
    },
    {
      rule: 6,
      name: 'Cash · one transaction',
      value: balances.senior.nav * inputs.instantCashAsSeniorShare,
      limit: balances.senior.nav * policy.instantSeniorMin,
      direction: 'min',
      unit: 'usd',
      detail:
        'Mock immediately withdrawable cash is 8.5% of Senior after assumed liquidity haircuts, below the 10% requirement.'
    },
    {
      rule: 7,
      name: 'Cash · within 24 hours',
      value: inputs.cash24hUsd,
      limit:
        Math.max(inputs.topThreeSeniorHoldingsUsd, balances.senior.nav * policy.dailySeniorMin) +
        inputs.juniorWithdrawalsDue7dUsd,
      direction: 'min',
      unit: 'usd',
      detail:
        'Mock 24-hour liquidity is $3M. Required: max($2.5M top-three Senior holders, 25% of Senior) plus $150K Junior withdrawals due in seven days. All liquidity and holder inputs are illustrative.'
    },
    {
      rule: 9,
      name: 'Cooldown coverage',
      value: inputs.cooldownDays,
      limit: Math.max(inputs.longestExitDays, inputs.lossRecognitionDays),
      direction: 'min',
      unit: 'days',
      detail:
        'Mock 14-day cooldown exceeds both the 10-day longest position exit and seven-day loss-recognition delay. These are scenario assumptions.'
    },
    {
      rule: 10,
      name: 'New-strategy sizing',
      value: inputs.newStrategyAmountUsd,
      limit: newStrategyLimit,
      direction: 'max',
      unit: 'usd',
      detail:
        'Mock strategy introduced two weeks ago: $650K allocated, near its initial four-week cap of 25% of the rule 1 maximum. Assumed dependency loss rate: 50%.'
    },
    {
      rule: 11,
      name: 'Target-rate review',
      value: yieldCoverage,
      limit: policy.reliableYieldCoverMin,
      direction: 'min',
      unit: 'multiple',
      detail:
        'Mock target review completed October 22, 2026, with 6.40% reliable yield. The current 5% targets pass the coverage check in this illustrative review.'
    }
  ]
  return {
    policy,
    date: lastSimulationPoint.date,
    tvl,
    juniorCapital,
    requiredYield,
    reliableYieldMin: requiredYield * policy.reliableYieldCoverMin,
    cash24hFloor: balances.senior.nav * policy.dailySeniorMin,
    checks: rows.map(
      (row): AllocationCheck => ({ ...row, status: allocationStatus(row.value, row.limit, row.direction) })
    ),
    inputs,
    exposures,
    dependencies,
    riskGroups,
    // Rule 12 has four cumulative risk groups; it is assessed once, not four times.
    totalRules: 12
  }
}
