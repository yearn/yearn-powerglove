import { useQueries, useQuery } from '@tanstack/react-query'
import { getStrategyDetailConfig, getStrategyDetailSummary } from '@/components/strategy-details/strategyDetailRegistry'
import { YVUSD_STRATEGY_ADDRESSES } from '@/constants/yvUsdStrategies'
import { fetchKongVaultSnapshotRaw } from '@/lib/kong-vault-client'
import { getStrategyRiskLevel } from '@/lib/strategy-risk'
import {
  fetchMorphoVaultLookthrough,
  fetchPawnLooperRates,
  fetchPendlePositionSnapshot,
  YVUSD_MORPHO_VAULT_ADDRESS
} from '@/lib/yvusd-reporting-client'
import exposures from '@/mock-data/tranche-allocation-exposures.json'

const queryOptions = { staleTime: 60_000, retry: 1 } as const

function observed(time: string | null | undefined) {
  return time ? new Date(time).toLocaleString('en-US', { timeZoneName: 'short' }) : 'Observation time unavailable'
}

export function TrancheStrategyResearch() {
  const ratings = useQueries({
    queries: exposures.strategies.map((strategy) => ({
      queryKey: ['strategy-risk', 1, strategy.address.toLowerCase()],
      queryFn: () => fetchKongVaultSnapshotRaw(1, strategy.address),
      ...queryOptions
    }))
  })
  const pawn = useQuery({
    queryKey: ['strategy-reporting', 'pawn-looper'],
    queryFn: fetchPawnLooperRates,
    ...queryOptions
  })
  const morpho = useQuery({
    queryKey: ['strategy-reporting', 'morpho', YVUSD_MORPHO_VAULT_ADDRESS],
    queryFn: () => fetchMorphoVaultLookthrough(YVUSD_MORPHO_VAULT_ADDRESS),
    ...queryOptions
  })
  const sUsds = useQuery({
    queryKey: ['strategy-reporting', 'pendle', 'sUsdsPendle'],
    queryFn: () => fetchPendlePositionSnapshot('sUsdsPendle'),
    ...queryOptions
  })
  const usd3 = useQuery({
    queryKey: ['strategy-reporting', 'pendle', 'usd3Pendle'],
    queryFn: () => fetchPendlePositionSnapshot('usd3Pendle'),
    ...queryOptions
  })

  return (
    <div className="space-y-4 px-4 pb-4 text-xs">
      <p className="text-muted-foreground">
        Current Kong ratings and QTOV measurements. These observations do not overwrite the dated allocation snapshot or
        the frozen capital amounts. Kong ratings and available QTOV observations now feed the provisional
        dependency-loss model.
      </p>
      {exposures.strategies.map((strategy, index) => {
        const config = getStrategyDetailConfig(1, strategy.address)
        const risk = ratings[index]
        const rating = getStrategyRiskLevel(risk.data)
        const isPawn = strategy.address.toLowerCase() === YVUSD_STRATEGY_ADDRESSES.pawn
        const isMorpho = config?.template === 'morpho-compounder'
        const pt = config?.template === 'pendle' ? (config.positionKey === 'sUsdsPendle' ? sUsds : usd3) : null
        const timestamp = risk.data?.blockTime
        const riskTime = timestamp && Number(timestamp) > 0 ? new Date(Number(timestamp) * 1000).toISOString() : null
        return (
          <div key={strategy.address} className="border-t border-border pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{strategy.name}</span>
              <span>
                {risk.isPending
                  ? 'Loading Kong rating…'
                  : risk.isError
                    ? 'Kong rating unavailable'
                    : rating === null
                      ? 'Kong rating not provided'
                      : `Kong risk level ${rating}/5`}
              </span>
            </div>
            <div className="mt-1 text-muted-foreground">
              {config?.templateLabel ?? 'Unclassified strategy'} · {observed(riskTime)}
            </div>
            {config && <p className="mt-2">{getStrategyDetailSummary(config)}</p>}
            {isPawn && (
              <div className="mt-2">
                {pawn.data ? (
                  <>
                    <div className="tabular-nums">
                      Leverage {pawn.data.leverage.toFixed(2)}× · LTV {(pawn.data.ltv * 100).toFixed(2)}% · Liquidation
                      LTV {(pawn.data.lltv * 100).toFixed(2)}% · Borrow APR {(pawn.data.borrowApr * 100).toFixed(2)}%
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Block {pawn.data.blockNumber} · {observed(pawn.data.observedAt)}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {pawn.isPending
                      ? 'Reading current looper position…'
                      : 'Looper measurement unavailable; leverage is not assumed to be 1×.'}
                  </p>
                )}
              </div>
            )}
            {isMorpho && (
              <div className="mt-2">
                {morpho.data ? (
                  <>
                    <div>
                      {morpho.data.markets.length} funded borrower markets · Collateral:{' '}
                      {[...new Set(morpho.data.markets.map((market) => market.collateralSymbol))].join(', ')}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Morpho API retrieved {observed(morpho.data.fetchedAt)}
                    </div>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left tabular-nums">
                        <thead>
                          <tr>
                            {['Collateral', 'Allocation', 'LLTV', 'Oracle'].map((label) => (
                              <th key={label} className="py-1 pr-4 font-normal text-muted-foreground">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {morpho.data.markets.map((market) => (
                            <tr key={market.marketId} className="border-t border-border">
                              <td className="py-2 pr-4">{market.collateralSymbol}</td>
                              <td className="py-2 pr-4">{(market.allocationShare * 100).toFixed(2)}%</td>
                              <td className="py-2 pr-4">{(market.lltv * 100).toFixed(2)}%</td>
                              <td className="py-2 pr-4">
                                <a
                                  className="underline"
                                  href={`https://etherscan.io/address/${market.oracleAddress}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {market.oracleAddress.slice(0, 6)}…{market.oracleAddress.slice(-4)}
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {morpho.isPending
                      ? 'Loading underlying Morpho markets…'
                      : 'Morpho look-through unavailable; collateral exposures remain unknown.'}
                  </p>
                )}
              </div>
            )}
            {pt && (
              <div className="mt-2">
                {pt.data ? (
                  <>
                    <div>
                      PT maturity: {new Date(pt.data.maturity).toLocaleDateString('en-US')} · PT balance:{' '}
                      {(Number(pt.data.ptBalanceRaw) / 10 ** pt.data.ptDecimals).toLocaleString('en-US', {
                        maximumFractionDigits: 2
                      })}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Block {pt.data.blockNumber} · {observed(pt.data.observedAt)}. Maturity does not establish
                      pre-maturity exit liquidity.
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {pt.isPending ? 'Reading PT balance and maturity…' : 'Current PT observation unavailable.'}
                  </p>
                )}
              </div>
            )}
            {config?.template === 'depositor' && (
              <p className="mt-2 text-muted-foreground">{config.liquidityDependency}</p>
            )}
            {config?.template === 'katana-yvusd-compounder' && (
              <p className="mt-2 text-muted-foreground">
                Remote-vault and bridge conditions still require current look-through.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
