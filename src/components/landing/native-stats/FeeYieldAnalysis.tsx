import { useContext, useMemo, useState } from 'react'
import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { fmt, pctFmt, SkeletonChart, useFetch } from './hooks'
import { StatsContext } from './StatsContext'

type Trend = 'improving' | 'declining' | 'stable' | 'insufficient_data'
type PricingConfidence = 'high' | 'medium' | 'low'
type Quadrant = 'high_tvl_high_yield' | 'high_tvl_low_yield' | 'low_tvl_high_yield' | 'low_tvl_low_yield'

interface VaultProfitability {
  address: string
  chainId: number
  name: string | null
  category: string
  tvlUsd: number | null
  annualizedFeeRevenue: number | null
  feeYield: number | null
  feeCapture: number | null
  gainYield: number | null
  trend: Trend
  trendDelta: number | null
  pricingConfidence: PricingConfidence
  reportCount: number
  avgHarvestFrequencyDays: number | null
  performanceFee: number | null
  managementFee: number | null
  totalGainUsd: number | null
  totalFeeRevenue: number | null
  quadrant: Quadrant | null
  currentPeriodFeeYield: number | null
  previousPeriodFeeYield: number | null
}

interface ProfitabilitySummary {
  protocolFeeYield: number | null
  feeCaptureRate: number | null
  medianVaultFeeYield: number | null
  totalAnnualizedFees: number | null
  totalTvl: number | null
  vaultCount: number
  lastUpdated: string
  vaults: VaultProfitability[]
  byChain: Array<{
    chain: string
    chainId: number
    tvl: number
    fees: number
    feeYield: number | null
    vaultCount: number
  }>
  byCategory: Array<{ category: string; tvl: number; fees: number; feeYield: number | null; vaultCount: number }>
  quadrants: Record<Quadrant, VaultProfitability[]>
  dataQuality: {
    highConfidenceCount: number
    mediumConfidenceCount: number
    lowConfidenceCount: number
    reportsWithPricingSource: number
    totalReports: number
  }
}

const QUADRANT_LABELS: Record<Quadrant, { label: string; color: string; desc: string }> = {
  high_tvl_high_yield: { label: 'Cash Cows', color: '#16a34a', desc: 'Protect & maintain' },
  high_tvl_low_yield: { label: 'Optimize', color: '#a16207', desc: 'Improve yield or migrate' },
  low_tvl_high_yield: { label: 'Scale Up', color: '#0657f9', desc: 'Drive more TVL' },
  low_tvl_low_yield: { label: 'Review', color: '#808080', desc: 'Consider retirement' }
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: { payload: VaultProfitability }[] }) {
  if (!active || !payload?.[0]?.payload) return null
  const v = payload[0].payload
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '0.7rem 0.85rem',
        fontSize: '0.78rem',
        lineHeight: 1.6,
        minWidth: 180
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)', fontSize: '0.82rem' }}>
        {v.name || v.address?.slice(0, 10)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: 'var(--text-2)' }}>TVL</span>
        <span style={{ color: 'var(--text)' }}>{fmt(v.tvlUsd)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: 'var(--text-2)' }}>Fee Yield</span>
        <span style={{ color: 'var(--accent)' }}>{pctFmt(v.feeYield)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: 'var(--text-2)' }}>Fees (ann.)</span>
        <span style={{ color: 'var(--green)' }}>{fmt(v.annualizedFeeRevenue)}</span>
      </div>
    </div>
  )
}

export function FeeYieldAnalysis() {
  const { chainFilter } = useContext(StatsContext)
  const query = new URLSearchParams()
  if (chainFilter !== 'all') query.set('chainId', chainFilter)
  const { data: profData, loading, error, retry } = useFetch<ProfitabilitySummary>(`/api/profitability?${query}`)
  const [quadrantFilter, setQuadrantFilter] = useState<Quadrant | 'all'>('all')
  const scatter = useMemo(() => {
    if (!profData) return { points: [], excluded: 0 }
    const candidates = profData.vaults
      .filter((v) => chainFilter === 'all' || String(v.chainId) === chainFilter)
      .filter((v) => quadrantFilter === 'all' || v.quadrant === quadrantFilter)
    const base = candidates
      .filter(
        (v): v is VaultProfitability & { feeYield: number; tvlUsd: number; quadrant: Quadrant } =>
          v.feeYield != null &&
          v.tvlUsd != null &&
          v.quadrant != null &&
          v.feeYield >= 0 &&
          v.tvlUsd >= 1e4 &&
          v.tvlUsd <= 1e8
      )
      .filter((v) => chainFilter === 'all' || String(v.chainId) === chainFilter)
    const eligible = base
    if (eligible.length < 4)
      return {
        points: eligible.map((v) => ({ ...v, logTvl: Math.log10(v.tvlUsd) })),
        excluded: candidates.length - eligible.length
      }
    const yields = eligible.map((v) => v.feeYield).sort((a, b) => a - b)
    const q1 = yields[Math.floor(yields.length * 0.25)]
    const q3 = yields[Math.floor(yields.length * 0.75)]
    const iqr = q3 - q1
    const upper = q3 + 1.5 * iqr
    const points = eligible.filter((v) => v.feeYield <= upper).map((v) => ({ ...v, logTvl: Math.log10(v.tvlUsd) }))
    return { points, excluded: candidates.length - points.length }
  }, [profData, quadrantFilter, chainFilter])

  const scatterData = scatter.points
  const trendLine = useMemo(() => {
    if (scatterData.length < 5) return null
    const n = scatterData.length
    const { sumX, sumY, sumXY, sumX2, sumY2 } = scatterData.reduce(
      (acc, p) => ({
        sumX: acc.sumX + p.logTvl,
        sumY: acc.sumY + p.feeYield,
        sumXY: acc.sumXY + p.logTvl * p.feeYield,
        sumX2: acc.sumX2 + p.logTvl * p.logTvl,
        sumY2: acc.sumY2 + p.feeYield * p.feeYield
      }),
      { sumX: 0, sumY: 0, sumXY: 0, sumX2: 0, sumY2: 0 }
    )
    const denom = n * sumX2 - sumX * sumX
    if (denom === 0) return null
    const slope = (n * sumXY - sumX * sumY) / denom
    const intercept = (sumY - slope * sumX) / n
    const denomR = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
    const r2 = denomR === 0 ? 0 : ((n * sumXY - sumX * sumY) / denomR) ** 2
    if (r2 < 0.01) return null
    const xs = scatterData.map((p) => p.logTvl)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    return {
      points: [
        { logTvl: minX, feeYield: slope * minX + intercept },
        { logTvl: maxX, feeYield: slope * maxX + intercept }
      ],
      r2
    }
  }, [scatterData])

  if (loading && !profData) return <SkeletonChart />
  if (error)
    return (
      <div className="error-retry">
        <p>Fee yield analysis could not be loaded.</p>
        <button type="button" className="page-btn" onClick={retry}>
          Retry fee yield analysis
        </button>
      </div>
    )
  return (
    <>
      {profData && (
        <div className="card fee-chart-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            TVL vs Fee Yield
            {trendLine && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 400 }}>
                R² = {trendLine.r2.toFixed(3)}
              </span>
            )}
          </h2>
          <fieldset className="quadrant-legend" aria-label="Quadrant filter">
            {Object.entries(QUADRANT_LABELS).map(([key, { label, color, desc }]) => {
              const count = profData.quadrants[key as Quadrant]?.length || 0
              const isActive = quadrantFilter === key
              return (
                <button
                  type="button"
                  key={key}
                  className="quadrant-tag"
                  aria-pressed={isActive}
                  style={{
                    borderColor: color,
                    color,
                    cursor: 'pointer',
                    opacity: quadrantFilter === 'all' || isActive ? 1 : 0.4,
                    background: isActive ? `${color}15` : undefined
                  }}
                  onClick={() => setQuadrantFilter(quadrantFilter === key ? 'all' : (key as Quadrant))}
                >
                  {label} ({count}) <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>{desc}</span>
                </button>
              )
            })}
          </fieldset>
          <div className="chart-container fee-history-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 20, right: 20, bottom: 24, top: 10 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="logTvl"
                  name="TVL"
                  domain={[4, 8]}
                  ticks={[4, 5, 6, 7, 8]}
                  tickFormatter={(v: number) => fmt(10 ** v, 0)}
                  tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                  label={{
                    value: 'TVL (log scale)',
                    position: 'bottom',
                    fill: 'var(--text-3)',
                    fontSize: 11,
                    offset: 6
                  }}
                  stroke="var(--border)"
                  allowDataOverflow
                />
                <YAxis
                  type="number"
                  dataKey="feeYield"
                  name="Fee Yield"
                  tickFormatter={(v) => pctFmt(v)}
                  tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                  label={{
                    value: 'Fee Yield (ann.)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'var(--text-3)',
                    fontSize: 11
                  }}
                  stroke="var(--border)"
                />
                <ZAxis type="number" dataKey="annualizedFeeRevenue" range={[30, 500]} name="Fees" />
                <Tooltip content={<ScatterTooltip />} cursor={false} />
                <Scatter data={scatterData}>
                  {scatterData.map((v) => {
                    const qColor = QUADRANT_LABELS[v.quadrant]?.color || '#808080'
                    return (
                      <Cell
                        key={`${v.address}-${v.chainId}`}
                        fill={qColor}
                        fillOpacity={0.65}
                        stroke={qColor}
                        strokeWidth={1}
                      />
                    )
                  })}
                </Scatter>
                {trendLine && (
                  <Scatter
                    data={trendLine.points}
                    line={{ stroke: '#a16207', strokeWidth: 2, strokeDasharray: '6 3' }}
                    shape={() => <></>}
                    isAnimationActive={false}
                    legendType="none"
                  />
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="text-dim">
            Showing {scatterData.length} vaults. {scatter.excluded} excluded by the $10K–$100M TVL range, unavailable
            fee yield, or fee-yield outlier filter. Quadrant counts include excluded vaults.
          </p>
        </div>
      )}
    </>
  )
}
