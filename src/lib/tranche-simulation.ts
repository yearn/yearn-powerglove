// Economic accounting port of TrancheController at the commit pinned in the source receipt.
// Values use six-decimal USDC units and Solidity-style integer division.
export const TRANCHE_IDS = ['senior', 'junior', 'equity'] as const
export type TrancheId = (typeof TRANCHE_IDS)[number]
const WAD = 10n ** 18n
const ASSET_SCALE = 10n ** 6n
const DAY = 86_400
const CONTRACT_YEAR = 31_556_952n

export interface TrancheHistorySource {
  schemaVersion: number
  retrievedAt: string
  controllerCommit: string
  controllerSourceSha256: string
  sources: { url: string; sha256: string }[]
  totalTvl: { time: number; value: string }
  lockedTvl: { time: number; value: string }
  pps: { time: number; value: string }[]
  history?: Record<
    'totalTvl' | 'lockedTvl' | 'unlockedPps' | 'lockedPps' | 'seniorApy' | 'juniorApy',
    { time: number; value: string; component?: string }[]
  >
}

export interface TrancheSimulationConfig {
  replayCashFlows: boolean
  id: string
  start: string
  end: string
  seniorReallocationUsd: string
  juniorAdditionUsd: string
  equitySeedUsd: string
  targetBps: Record<TrancheId, number>
  excessShareBps: Record<TrancheId, number>
}

export function decimalUnits(value: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error(`Invalid positive decimal: ${value}`)
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0').slice(0, decimals) || '0')
}

const dollars = (units: bigint) => Number(units) / Number(ASSET_SCALE)
const min = (a: bigint, b: bigint) => (a < b ? a : b)

type State = { baseline: bigint; pending: bigint; paused: boolean }

// APYs use 365 days to match the existing vault charts. Targets use the controller's exact year constant.
const annualize = (end: number, start: number, days: number) =>
  // Canonical presentation precision avoids tiny Math.pow differences between Bun and Node.
  start > 0 && days > 0 ? Number(((end / start) ** (365 / days) - 1).toFixed(10)) : null

export function simulateTranches(source: TrancheHistorySource, config: TrancheSimulationConfig) {
  const start = Date.parse(config.start) / 1000
  const end = Date.parse(config.end) / 1000
  if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start || (end - start) % DAY !== 0) {
    throw new Error('Simulation boundaries must span whole days')
  }
  if (source.totalTvl.time !== start || source.lockedTvl.time !== start) {
    throw new Error('Both migration balances must be observed at the exact simulation start')
  }
  if (source.pps.length !== (end - start) / DAY + 1) throw new Error('Incomplete daily PPS coverage')
  source.pps.forEach((point, index) => {
    if (point.time !== start + index * DAY || decimalUnits(point.value, 20) <= 0n) {
      throw new Error('Missing, duplicate, out-of-order, or invalid daily PPS observation')
    }
  })
  for (const id of TRANCHE_IDS) {
    if (!Number.isInteger(config.targetBps[id]) || config.targetBps[id] < 0 || config.targetBps[id] >= 10_000) {
      throw new Error('Targets must be integer BPS in [0, 10000)')
    }
    if (!Number.isInteger(config.excessShareBps[id]) || config.excessShareBps[id] < 0) {
      throw new Error('Excess shares must be non-negative integer BPS')
    }
  }
  if (TRANCHE_IDS.reduce((sum, id) => sum + config.excessShareBps[id], 0) !== 10_000) {
    throw new Error('This scenario must allocate exactly 100% of excess')
  }
  const total = decimalUnits(source.totalTvl.value, 6)
  const locked = decimalUnits(source.lockedTvl.value, 6)
  const initial = {
    senior: total - locked - decimalUnits(config.seniorReallocationUsd, 6),
    junior: locked + decimalUnits(config.juniorAdditionUsd, 6),
    equity: decimalUnits(config.equitySeedUsd, 6)
  }
  if (TRANCHE_IDS.some((id) => initial[id] <= 0n) || TRANCHE_IDS.reduce((sum, id) => sum + initial[id], 0n) !== total) {
    throw new Error('Migration must preserve total capital and fund every tranche')
  }
  const state: Record<TrancheId, State> = {
    senior: { baseline: initial.senior, pending: 0n, paused: false },
    junior: { baseline: initial.junior, pending: 0n, paused: false },
    equity: { baseline: initial.equity, pending: 0n, paused: false }
  }
  const rates = Object.fromEntries(
    TRANCHE_IDS.map((id) => [id, (BigInt(config.targetBps[id]) * WAD) / (10_000n * CONTRACT_YEAR)])
  ) as Record<TrancheId, bigint>
  const initialPps = decimalUnits(source.pps[0].value, 20)
  const history: { time: number; pps: number }[][] = TRANCHE_IDS.map(() => [])
  const shares = {
    senior: initial.senior * 10n ** 12n,
    junior: initial.junior * 10n ** 12n,
    equity: initial.equity * 10n ** 12n
  }
  const netFlows = { senior: 0n, junior: 0n, equity: 0n }
  let pool = total
  const observation = (key: 'totalTvl' | 'lockedTvl' | 'unlockedPps' | 'lockedPps', time: number, decimals: number) => {
    const matches = source.history?.[key].filter((row) => row.time === time)
    if (!matches || matches.length !== 1) throw new Error(`Need exactly one ${key} observation at ${time}`)
    return decimalUnits(matches[0].value, decimals)
  }
  const observed = (time: number) => {
    const total = observation('totalTvl', time, 6)
    const junior = observation('lockedTvl', time, 6)
    const pps = observation('unlockedPps', time, 20)
    const lockedPps = observation('lockedPps', time, 20)
    if (total < junior || pps <= 0n || lockedPps <= 0n) throw new Error('Invalid observed TVL/PPS')
    return { senior: total - junior, junior, seniorPps: pps, juniorPps: pps * lockedPps }
  }
  const points = source.pps.map((point, index) => {
    if (config.replayCashFlows && index > 0) {
      pool = (pool * decimalUnits(point.value, 20)) / decimalUnits(source.pps[index - 1].value, 20)
    } else if (!config.replayCashFlows) {
      pool = (total * decimalUnits(point.value, 20)) / initialPps
    }
    const flows = { senior: 0n, junior: 0n, equity: 0n }
    if (config.replayCashFlows) {
      const current = observed(point.time)
      if (index > 0) {
        const previous = observed(source.pps[index - 1].time)
        // Residual after original investment returns estimates net deposits/withdrawals, not earnings.
        flows.senior = current.senior - (previous.senior * current.seniorPps) / previous.seniorPps
        flows.junior = current.junior - (previous.junior * current.juniorPps) / previous.juniorPps
      }
    }
    const targets = { senior: 0n, junior: 0n, equity: 0n }
    const losses = { senior: 0n, junior: 0n, equity: 0n }
    const excess = { senior: 0n, junior: 0n, equity: 0n }
    if (index > 0) {
      for (const id of TRANCHE_IDS) {
        const tranche = state[id]
        targets[id] = tranche.paused ? 0n : (tranche.baseline * rates[id] * BigInt(DAY)) / WAD
        tranche.baseline += targets[id]
      }
    }
    const claims = TRANCHE_IDS.reduce((sum, id) => sum + state[id].baseline + state[id].pending, 0n)
    const settlementPnl = pool - claims
    if (settlementPnl > 0n) {
      for (const id of TRANCHE_IDS) {
        state[id].paused = false
        excess[id] = (settlementPnl * BigInt(config.excessShareBps[id])) / 10_000n
        state[id].pending += excess[id]
      }
    } else if (settlementPnl < 0n) {
      let loss = -settlementPnl
      for (const id of [...TRANCHE_IDS].reverse()) {
        const tranche = state[id]
        const fromPending = min(loss, tranche.pending)
        tranche.pending -= fromPending
        loss -= fromPending
        const fromBaseline = min(loss, tranche.baseline)
        tranche.baseline -= fromBaseline
        loss -= fromBaseline
        losses[id] = fromPending + fromBaseline
        if (losses[id] > 0n) tranche.paused = true
      }
      if (loss !== 0n) throw new Error('Unallocated loss')
    }
    const tranches = Object.fromEntries(
      TRANCHE_IDS.map((id, position) => {
        const tranche = state[id]
        const pendingBeforeReport = tranche.pending
        // Daily report at settlement time; no extra tranche fees or profit-unlock delay.
        tranche.baseline += tranche.pending
        tranche.pending = 0n
        // Historical cash flows are applied at end of day, after settlement, at the current tranche price.
        const flow = flows[id]
        if (flow < -tranche.baseline)
          throw new Error(`Historical withdrawal exceeds ${id} simulated capital on ${point.time}`)
        if (flow !== 0n) {
          if (tranche.baseline === 0n && shares[id] !== 0n)
            throw new Error('Cannot price a deposit into a wiped tranche')
          const magnitude = flow < 0n ? -flow : flow
          const shareDelta =
            tranche.baseline === 0n ? magnitude * 10n ** 12n : (magnitude * shares[id]) / tranche.baseline
          shares[id] += flow < 0n ? -shareDelta : shareDelta
          tranche.baseline += flow
          netFlows[id] += flow
          pool += flow
        }
        const nav = dollars(tranche.baseline)
        const pps = shares[id] > 0n ? (Number(tranche.baseline) * 1e12) / Number(shares[id]) : 0
        const prior = history[position]
        const apy = (days: number) => {
          const previous = prior[index - days]
          return previous ? annualize(pps, previous.pps, days) : null
        }
        const value = {
          nav,
          navUnits: tranche.baseline.toString(),
          pps,
          sharesUnits: shares[id].toString(),
          netFlowUsd: dollars(flow),
          cumulativeNetFlowUsd: dollars(netFlows[id]),
          earningsUsd: dollars(tranche.baseline - initial[id] - netFlows[id]),
          cumulativeReturn: pps - 1,
          oneDayApy: apy(1),
          sevenDayApy: apy(7),
          thirtyDayApy: apy(30),
          targetAccruedUsd: dollars(targets[id]),
          excessAllocatedUsd: dollars(excess[id]),
          lossAbsorbedUsd: dollars(losses[id]),
          pendingExcessBeforeReportUsd: dollars(pendingBeforeReport),
          accrualPaused: tranche.paused
        }
        prior.push({ time: point.time, pps })
        return [id, value]
      })
    ) as Record<
      TrancheId,
      {
        nav: number
        navUnits: string
        pps: number
        sharesUnits: string
        netFlowUsd: number
        cumulativeNetFlowUsd: number
        earningsUsd: number
        cumulativeReturn: number
        oneDayApy: number | null
        sevenDayApy: number | null
        thirtyDayApy: number | null
        targetAccruedUsd: number
        excessAllocatedUsd: number
        lossAbsorbedUsd: number
        pendingExcessBeforeReportUsd: number
        accrualPaused: boolean
      }
    >
    const residual = pool - TRANCHE_IDS.reduce((sum, id) => sum + state[id].baseline, 0n)
    if (residual < 0n) throw new Error('Tranche claims exceed pool assets after settlement')
    return {
      time: point.time,
      date: new Date(point.time * 1000).toISOString().slice(0, 10),
      underlyingPps: point.value,
      poolNav: dollars(pool),
      poolNavUnits: pool.toString(),
      settlementPnlUsd: dollars(settlementPnl),
      roundingResidualUnits: residual.toString(),
      tranches
    }
  })
  return {
    schemaVersion: 2,
    config,
    source,
    assumptions: {
      currency: 'USD',
      assetDecimals: 6,
      usdcUsdPrice: 1,
      additionalTrancheFeesBps: 0,
      reserveUsd: 0,
      settlementSeconds: DAY,
      reportSeconds: DAY,
      profitUnlockSeconds: 0,
      externalFlows: config.replayCashFlows,
      cashFlowMethod: config.replayCashFlows
        ? 'Inferred from reported daily TVL less original PPS return; applied at end of day'
        : 'None',
      controllerYearSeconds: Number(CONTRACT_YEAR),
      apyYearDays: 365,
      valuation: 'Economic NAV with daily excess realization; not actual deployed tranche share prices'
    },
    initial: Object.fromEntries(TRANCHE_IDS.map((id) => [id, dollars(initial[id])])) as Record<TrancheId, number>,
    points
  }
}
