import { useQueries, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, CircleHelp, XCircle } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { formatCurrency, formatTvlDisplay } from '@/lib/formatters'
import { fetchKongVaultSnapshotRaw } from '@/lib/kong-vault-client'
import { getStrategyRiskLevel } from '@/lib/strategy-risk'
import {
  type AllocationCheck,
  type AllocationStatus,
  getTrancheAllocationHealth,
  worstAllocationStatus
} from '@/lib/tranche-allocation-health'
import {
  fetchMorphoVaultLookthrough,
  fetchPawnLooperRates,
  YVUSD_MORPHO_VAULT_ADDRESS
} from '@/lib/yvusd-reporting-client'
import exposures from '@/mock-data/tranche-allocation-exposures.json'

const TrancheStrategyResearch = lazy(() =>
  import('./TrancheStrategyResearch').then((module) => ({ default: module.TrancheStrategyResearch }))
)

function amount(value: number, unit: AllocationCheck['unit']) {
  if (unit === 'percent') return `${(value * 100).toFixed(2)}%`
  if (unit === 'usd') return formatCurrency(value)
  if (unit === 'multiple') return `${value.toFixed(1)}×`
  return `${value} days`
}

const statusColors: Record<AllocationStatus, string> = {
  'Within limit': 'text-emerald-700',
  'Near limit': 'text-amber-700',
  Breach: 'text-red-700',
  'Needs data': 'text-muted-foreground'
}

function Status({ status }: { status: AllocationStatus }) {
  const Icon = { 'Within limit': CheckCircle2, 'Near limit': AlertTriangle, Breach: XCircle, 'Needs data': CircleHelp }[
    status
  ]
  return (
    <span className={`flex items-center justify-end gap-1.5 text-xs ${statusColors[status]}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {status}
    </span>
  )
}

function LimitBar({
  value,
  limit,
  direction,
  label,
  unit = 'percent'
}: {
  value: number | null
  limit: number | null
  direction: 'min' | 'max'
  label: string
  unit?: AllocationCheck['unit']
}) {
  if (value === null || limit === null)
    return <div aria-label={`${label}: not assessed`} className="h-2.5 bg-[#f1f1f1]" />
  const scale = Math.max(value * 1.15, limit * 1.4)
  return (
    <div
      role="img"
      aria-label={label}
      aria-description={`${amount(value, unit)}, ${direction === 'min' ? 'minimum' : 'maximum'} ${amount(limit, unit)}`}
      className="relative h-2.5 bg-[#f1f1f1]"
    >
      <span className="absolute inset-y-0 left-0 bg-[#0657f9]" style={{ width: `${(value / scale) * 100}%` }} />
      <span className="absolute inset-y-[-4px] w-px bg-[#151515]" style={{ left: `${(limit / scale) * 100}%` }} />
    </div>
  )
}

function CapitalSplit({ report }: { report: ReturnType<typeof getTrancheAllocationHealth> }) {
  const juniorTotal = report.juniorCapital + report.inputs.cooldownWithdrawalsUsd
  const juniorShare = juniorTotal / report.tvl
  const seniorShare = 1 - juniorShare
  const eligibleShare = report.juniorCapital / report.tvl
  const cooldownShare = report.inputs.cooldownWithdrawalsUsd / report.tvl
  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-3 text-xs tabular-nums">
        <div>
          <div className="text-muted-foreground">Junior + Equity</div>
          <div className="mt-1 font-medium">
            {formatTvlDisplay(juniorTotal)} · {amount(juniorShare, 'percent')}
          </div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground">Senior</div>
          <div className="mt-1 font-medium">
            {formatTvlDisplay(report.tvl - juniorTotal)} · {amount(seniorShare, 'percent')}
          </div>
        </div>
      </div>
      <div
        role="img"
        aria-label="Junior and Senior capital split"
        aria-description={`Junior and Equity ${amount(juniorShare, 'percent')}, Senior ${amount(seniorShare, 'percent')}; healthy minimum ${amount(report.policy.juniorShareMin, 'percent')} excludes cooldown withdrawals.`}
        className="relative flex h-2.5 w-full bg-[#f1f1f1]"
      >
        <span className="h-full bg-[#0657f9]" style={{ width: `${eligibleShare * 100}%` }} />
        <span
          title={`${formatCurrency(report.inputs.cooldownWithdrawalsUsd)} in cooldown`}
          className="h-full bg-white"
          style={{
            width: `${cooldownShare * 100}%`,
            backgroundImage: 'repeating-linear-gradient(135deg, #ffffff, #ffffff 2px, #0657f9 2px, #0657f9 3px)'
          }}
        />
        <span className="h-full bg-blue-200" style={{ width: `${seniorShare * 100}%` }} />
        <span
          title="15% healthy minimum"
          className="absolute inset-y-[-4px] w-px bg-[#151515]"
          style={{ left: `${report.policy.juniorShareMin * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-1 text-[11px] text-muted-foreground">
        <span>
          Min {amount(report.policy.juniorShareMin, 'percent')} · eligible{' '}
          <span>{amount(eligibleShare, 'percent')}</span>
        </span>
        <span>Striped: {formatTvlDisplay(report.inputs.cooldownWithdrawalsUsd)} in cooldown</span>
      </div>
    </div>
  )
}

function StrategyConcentration({
  report,
  legend = false
}: {
  report: ReturnType<typeof getTrancheAllocationHealth>
  legend?: boolean
}) {
  const colors = ['#0657f9', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']
  const strategies = [...report.exposures.strategies].sort((a, b) => b.allocationUsd - a.allocationUsd)
  const segments = strategies.map((strategy, index) => ({ ...strategy, color: colors[index % colors.length] }))
  if (report.exposures.idleUsd > 0)
    segments.push({ address: 'idle', name: 'Idle capital', allocationUsd: report.exposures.idleUsd, color: '#eff6ff' })
  if (legend)
    return (
      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {segments.map((strategy) => (
          <li key={strategy.address} className="flex items-start justify-between gap-3">
            <span className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0" style={{ backgroundColor: strategy.color }} />
              {strategy.name}
            </span>
            <span className="shrink-0 tabular-nums text-foreground">
              {amount(strategy.allocationUsd / report.exposures.totalAllocationUsd, 'percent')}
            </span>
          </li>
        ))}
      </ul>
    )
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-between gap-1 tabular-nums">
        <span>
          Largest dependency{' '}
          {amount(Math.max(...report.dependencies.map((dependency) => dependency.exposureShare)), 'percent')}
        </span>
        <span className="text-muted-foreground">Max {amount(report.policy.dependencyShareMax, 'percent')}</span>
      </div>
      <div
        role="img"
        aria-label="Strategy allocation concentration"
        aria-description="All strategy allocations as shares of captured AUM. The black tick marks the 30% dependency cap; shared dependencies must be aggregated across strategies."
        className="relative flex h-2.5 w-full"
      >
        {segments.map((strategy) => (
          <span
            key={strategy.address}
            data-allocation-segment
            title={`${strategy.name}: ${amount(strategy.allocationUsd / report.exposures.totalAllocationUsd, 'percent')}`}
            className="h-full"
            style={{
              width: `${(strategy.allocationUsd / report.exposures.totalAllocationUsd) * 100}%`,
              backgroundColor: strategy.color
            }}
          />
        ))}
        <span
          title="30% maximum dependency concentration"
          className="absolute inset-y-[-4px] w-px bg-black"
          style={{ left: `${report.policy.dependencyShareMax * 100}%` }}
        />
      </div>
    </div>
  )
}

function DependencyLossDetails({ report }: { report: ReturnType<typeof getTrancheAllocationHealth> }) {
  return (
    <section aria-label="Single-dependency loss assumptions" className="space-y-3 text-foreground">
      <p className="text-muted-foreground">
        Provisional dependency rating = highest available Kong strategy risk level among its mapped strategies. Missing
        strategy ratings keep coverage incomplete. These are proxies, not dependency ratings approved by risk.
      </p>
      <p className="text-muted-foreground">
        Policy loss rates: risk 1 → 10%, 2 → 25%, 3 → 50%, 4 → 75%, 5 → 100%. These are stress assumptions, not failure
        probabilities. Base loss = min(capital × leverage × affected share × policy rate, capital × affected share).
        Exit losses are still unknown and excluded from the base calculation.
      </p>
      {report.provisionalLoss.maxKnownBaseLoss !== null &&
        report.provisionalLoss.maxKnownBaseLoss > report.juniorCapital * report.policy.dependencyLossMax && (
          <p className="text-red-700">
            The known-input base loss exceeds the cap under these provisional assumptions. Missing inputs still prevent
            a complete assessment.
          </p>
        )}
      <div className="overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">Provisional dependency loss inputs</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {['Dependency', 'Kong proxy', 'Policy rate', 'Known-input base loss', 'Coverage before exit losses'].map(
                (label) => (
                  <th key={label} className="whitespace-nowrap py-2 pr-4 font-normal">
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {report.provisionalLoss.dependencies.map((dependency) => (
              <tr key={dependency.name} className="border-b border-border last:border-0">
                <th scope="row" className="py-2 pr-4 font-medium">
                  {dependency.name}
                </th>
                <td className="whitespace-nowrap py-2 pr-4">
                  {dependency.score === null ? 'Needs rating' : `${dependency.score}/5 · provisional`}
                </td>
                <td className="whitespace-nowrap py-2 pr-4">
                  {dependency.lossRate === null ? 'Needs rating' : amount(dependency.lossRate, 'percent')}
                </td>
                <td className="whitespace-nowrap py-2 pr-4">
                  {dependency.baseLoss === null ? 'Not calculated' : formatCurrency(dependency.baseLoss)}
                </td>
                <td className="py-2 pr-4">
                  {dependency.complete ? 'Base inputs available' : 'Incomplete ratings or exposure inputs'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2">
        {report.provisionalLoss.dependencies.map((dependency) => (
          <details key={dependency.name} className="border-t border-border pt-2">
            <summary className="cursor-pointer">{dependency.name} · position inputs</summary>
            <div className="overflow-x-auto">
              <table className="w-full text-left tabular-nums">
                <thead>
                  <tr className="text-muted-foreground">
                    {['Strategy / rating source', 'Leverage / source', 'Affected share / source', 'Base loss'].map(
                      (label) => (
                        <th key={label} className="py-2 pr-4 font-normal">
                          {label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {dependency.links.map((link) => (
                    <tr key={link.strategy.address} className="border-t border-border">
                      <th scope="row" className="min-w-[180px] py-2 pr-4 font-medium">
                        {link.strategy.name}
                        <div className="mt-1 text-muted-foreground font-normal">
                          {link.score === null
                            ? {
                                loading: 'Kong rating loading…',
                                unavailable: 'Kong rating unavailable',
                                missing: 'Kong rating missing',
                                available: 'Kong rating missing'
                              }[link.ratingState]
                            : `Kong ${link.score}/5`}
                          {link.ratingObservedAt
                            ? ` · ${new Date(link.ratingObservedAt).toLocaleString('en-US', { timeZoneName: 'short' })}`
                            : ''}
                        </div>
                      </th>
                      <td className="min-w-[180px] py-2 pr-4">
                        {link.leverage === null ? 'Unknown' : `${link.leverage.toFixed(2)}×`}
                        <div className="mt-1 text-muted-foreground">{link.leverageSource}</div>
                      </td>
                      <td className="min-w-[180px] py-2 pr-4">
                        {link.weight === null ? 'Unknown' : amount(link.weight, 'percent')}
                        <div className="mt-1 text-muted-foreground">{link.weightSource}</div>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4">
                        {link.baseLoss === null ? 'Not calculated' : formatCurrency(link.baseLoss)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dependency.missingRatings.length > 0 && (
              <p className="mt-2 text-muted-foreground">
                Missing Kong ratings: {dependency.missingRatings.join('; ')}.
              </p>
            )}
          </details>
        ))}
      </div>
      <p className="text-muted-foreground">
        Current Kong and QTOV observations are applied to the November 1, 2026 debt snapshot. Pawn leverage is measured
        onchain; Morpho collateral shares come from current borrower-market allocations. Direct Morpho and Pendle
        positions use provisional 1× leverage from their QTOV types. Full-position route shares are structural
        assumptions, not measured balances. Unresolved Katana and Grove look-through stays unknown.
      </p>
      <p className="text-muted-foreground">
        Morpho collateral links describe lender exposure to borrower collateral, not direct token holdings. Issuer,
        oracle and bridge overlap is not fully mapped. Known-input base losses exclude unmeasured positions and exit
        discounts; the complete check stays Needs data. Other allocation checks retain their existing inputs.
      </p>
    </section>
  )
}

export function TrancheAllocationHealth() {
  const [researchOpen, setResearchOpen] = useState(false)
  const ratings = useQueries({
    queries: exposures.strategies.map((strategy) => ({
      queryKey: ['strategy-risk', 1, strategy.address.toLowerCase()],
      queryFn: () => fetchKongVaultSnapshotRaw(1, strategy.address),
      staleTime: 60_000,
      retry: 1
    }))
  })
  const pawn = useQuery({
    queryKey: ['strategy-reporting', 'pawn-looper'],
    queryFn: fetchPawnLooperRates,
    staleTime: 60_000,
    retry: 1
  })
  const morpho = useQuery({
    queryKey: ['strategy-reporting', 'morpho', YVUSD_MORPHO_VAULT_ADDRESS],
    queryFn: () => fetchMorphoVaultLookthrough(YVUSD_MORPHO_VAULT_ADDRESS),
    staleTime: 60_000,
    retry: 1
  })
  const report = getTrancheAllocationHealth(
    Object.fromEntries(
      exposures.strategies.map((strategy, index) => {
        const query = ratings[index]
        const score = getStrategyRiskLevel(query.data)
        const timestamp = Number(query.data?.blockTime)
        return [
          strategy.address.toLowerCase(),
          {
            score,
            observedAt: Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null,
            state: query.isPending
              ? 'loading'
              : query.isError
                ? 'unavailable'
                : score === null
                  ? 'missing'
                  : 'available'
          }
        ]
      })
    ),
    { pawn: pawn.data, morpho: morpho.data }
  )
  const riskStatus = worstAllocationStatus(report.riskGroups.map((group) => group.status))
  return (
    <section aria-label="Allocation health" className="w-full bg-white">
      <div className="grid grid-cols-2 gap-4 border-b border-border px-4 py-3 text-xs sm:grid-cols-4">
        <div className="text-muted-foreground">
          TVL<div className="mt-1 text-sm font-medium text-foreground">{formatTvlDisplay(report.tvl)}</div>
        </div>
        <div className="text-muted-foreground">
          Junior risk budget
          <div className="mt-1 text-sm font-medium text-foreground">{formatTvlDisplay(report.juniorCapital)}</div>
        </div>
        <div className="text-muted-foreground">
          Yield owed
          <div className="mt-1 text-sm font-medium text-foreground">{amount(report.requiredYield, 'percent')}</div>
        </div>
        <div className="text-muted-foreground">
          Reliable yield needed
          <div className="mt-1 text-sm font-medium text-foreground">{amount(report.reliableYieldMin, 'percent')}</div>
        </div>
      </div>
      {report.checks.slice(0, 8).map((check) => (
        <details key={check.rule} className="group border-b border-border">
          <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0657f9] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px] [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2 text-sm">
              <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180" />
              {check.name}
            </div>
            <div className="col-span-2 row-start-2 min-w-0 space-y-2 text-xs sm:col-span-1 sm:row-start-auto">
              {check.rule === 8 ? (
                <CapitalSplit report={report} />
              ) : check.rule === 2 ? (
                <StrategyConcentration report={report} />
              ) : (
                <>
                  <div className="flex flex-wrap justify-between gap-1 tabular-nums">
                    <span className={check.value === null ? 'text-muted-foreground' : 'font-medium'}>
                      {check.rule === 1 && report.provisionalLoss.maxKnownBaseLoss !== null
                        ? `Known-input base: ${formatCurrency(report.provisionalLoss.maxKnownBaseLoss)}`
                        : check.value === null
                          ? 'Not available'
                          : amount(check.value, check.unit)}
                    </span>
                    <span className="text-muted-foreground">
                      {check.limit === null
                        ? check.rule === 5
                          ? 'Policy unresolved'
                          : 'Requirement incomplete'
                        : `${check.direction === 'min' ? 'Min' : 'Max'} ${amount(check.limit, check.unit)}`}
                    </span>
                  </div>
                  <LimitBar
                    value={check.rule === 1 ? report.provisionalLoss.maxKnownBaseLoss : check.value}
                    limit={check.limit}
                    direction={check.direction}
                    label={check.name}
                    unit={check.unit}
                  />
                </>
              )}
            </div>
            <Status status={check.status} />
          </summary>
          <div className="px-4 pb-4 text-xs leading-relaxed text-muted-foreground">
            {check.rule === 1 ? <DependencyLossDetails report={report} /> : check.detail}
            {check.rule === 2 && <StrategyConcentration report={report} legend />}
            {check.rule === 7 && check.limit === null && (
              <p className="mt-1">
                Known lower bound: {formatCurrency(report.cash24hFloor)}, before holder concentration and withdrawal
                queues.
              </p>
            )}
            {check.rule !== 1 && check.rule !== 2 && <span className="ml-1">Rule {check.rule}.</span>}
          </div>
        </details>
      ))}
      <details className="group border-b border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0657f9] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <ChevronDown aria-hidden="true" className="h-3 w-3 transition-transform group-open:rotate-180" />
            Risk concentration
          </span>
          <Status status={riskStatus} />
        </summary>
        <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
          {report.riskGroups.map((group) => (
            <div key={group.score} className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Risk {group.score} or higher</span>
                <span className="text-muted-foreground">
                  {amount(group.value, 'percent')} / max {group.limit * 100}%
                </span>
              </div>
              <LimitBar
                value={group.value}
                limit={group.limit}
                direction="max"
                label={`Risk ${group.score} or higher`}
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Actual strategy debts grouped by mock risk scores and mappings; each strategy counts once per cumulative
            band. Gross leverage and collateral look-through are not measured. Rule 12.
          </p>
        </div>
      </details>
      <details className="group border-b border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0657f9] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <ChevronDown aria-hidden="true" className="h-3 w-3 transition-transform group-open:rotate-180" />
            Dependency exposure &amp; headroom
          </span>
          <Status status={worstAllocationStatus(report.dependencies.map((dependency) => dependency.status))} />
        </summary>
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {[
                  'Dependency (mock mapping)',
                  'Actual strategy exposure',
                  'Dependency loss',
                  'Remaining headroom',
                  'Status'
                ].map((title) => (
                  <th key={title} className="whitespace-nowrap py-2 pr-4 font-normal">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.dependencies.map((dependency) => (
                <tr key={dependency.name} className="border-b border-border last:border-0">
                  <th scope="row" className="whitespace-nowrap py-3 pr-4 font-medium">
                    {dependency.name}
                    <div className="mt-1 max-w-[220px] whitespace-normal text-[11px] font-normal text-muted-foreground">
                      {dependency.strategies.map((strategy) => strategy.name).join(' + ')}
                    </div>
                  </th>
                  <td className="whitespace-nowrap py-3 pr-4 tabular-nums">
                    {formatCurrency(dependency.exposure)}{' '}
                    <span className="text-muted-foreground">({amount(dependency.exposureShare, 'percent')})</span>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 tabular-nums">
                    {dependency.loss === null ? 'Needs data' : formatCurrency(dependency.loss)}{' '}
                    <span className="text-muted-foreground">
                      ({dependency.lossRate === null ? 'Needs rating' : amount(dependency.lossRate, 'percent')})
                    </span>
                  </td>
                  <td
                    className={`whitespace-nowrap py-3 pr-4 tabular-nums ${dependency.headroom !== null && dependency.headroom < 0 ? 'text-red-700' : ''}`}
                  >
                    {dependency.headroom === null ? 'Not assessed' : formatCurrency(dependency.headroom)}
                  </td>
                  <td className="whitespace-nowrap py-3">
                    <Status status={dependency.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Actual USD strategy debt is counted once per provisional mapped dependency; shared dependencies overlap.
            Dependency ratings and measured gross exposures are incomplete, so loss and combined headroom are not
            assessed. Concentration uses the allocation snapshot total; loss caps use simulated Junior + Equity capital.
            Headroom reflects rules 1 and 2 only.
          </p>
        </div>
      </details>
      <details className="group border-b border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0657f9] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <ChevronDown aria-hidden="true" className="h-3 w-3 transition-transform group-open:rotate-180" />
            Cooldown &amp; allocation controls
          </span>
          <Status status={worstAllocationStatus(report.checks.slice(8).map((check) => check.status))} />
        </summary>
        <div className="space-y-3 px-4 pb-4 text-xs">
          {report.checks.slice(8).map((check) => (
            <div key={check.rule}>
              <div className="font-medium">
                {check.name} · <span className={statusColors[check.status]}>{check.status}</span>
              </div>
              <div className="my-2 flex justify-between tabular-nums">
                <span>{check.value === null ? 'Not available' : amount(check.value, check.unit)}</span>
                <span className="text-muted-foreground">
                  {check.limit === null
                    ? 'Not set'
                    : `${check.direction === 'min' ? 'Min' : 'Max'} ${amount(check.limit, check.unit)}`}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {check.detail} Rule {check.rule}.
              </p>
            </div>
          ))}
        </div>
      </details>
      <details className="group border-b border-border" onToggle={(event) => setResearchOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0657f9] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <ChevronDown aria-hidden="true" className="h-3 w-3 transition-transform group-open:rotate-180" />
            Strategy types &amp; measured inputs
          </span>
          <span className="text-xs text-muted-foreground">Kong / QTOV</span>
        </summary>
        {researchOpen && (
          <Suspense fallback={<p className="px-4 pb-4 text-xs text-muted-foreground">Loading strategy research…</p>}>
            <TrancheStrategyResearch />
          </Suspense>
        )}
      </details>
      <div className="flex flex-wrap justify-between gap-2 p-4 text-xs text-muted-foreground">
        <span>
          Mock queue: $150K in cooldown. These illustrative inputs do not change simulated returns. The captured
          allocations above may differ from the live strategy list below.
        </span>
        <a href={report.policy.source} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          Guideline source ↗
        </a>
      </div>
    </section>
  )
}
