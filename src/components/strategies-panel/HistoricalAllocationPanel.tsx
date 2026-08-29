import type React from 'react'
import { useMemo, useState } from 'react'
import { useIsMobile } from '@/components/ui/use-mobile'
import { useHistoricalAllocationData } from '@/hooks/useHistoricalAllocationData'
import {
  ALLOCATION_TIMEFRAMES,
  type AllocationTimeframeValue,
  filterAllocationPoints,
  selectVisibleStrategies
} from '@/lib/historical-allocation'
import { cn } from '@/lib/utils'
import type { ChainId } from '../../constants/chains'
import { HistoricalAllocationChart } from './HistoricalAllocationChart'

interface HistoricalAllocationPanelProps {
  vaultChainId: ChainId
  vaultAddress: string
}

const CHART_HEIGHT = 360

export const HistoricalAllocationPanel: React.FC<HistoricalAllocationPanelProps> = ({ vaultChainId, vaultAddress }) => {
  const isMobile = useIsMobile()
  const { series, isLoading, error } = useHistoricalAllocationData(vaultChainId, vaultAddress)
  const [timeframe, setTimeframe] = useState<AllocationTimeframeValue>('all')

  const hasData = Boolean(series && series.points.length > 0 && series.strategies.length > 0)

  const filteredPoints = useMemo(
    () => (series ? filterAllocationPoints(series.points, timeframe) : []),
    [series, timeframe]
  )
  const visibleStrategies = useMemo(
    () => (series ? selectVisibleStrategies(filteredPoints, series.strategies) : []),
    [series, filteredPoints]
  )
  const hasVisibleData = filteredPoints.length > 0 && visibleStrategies.length > 0

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#7E7E7E]">
            Historical strategy allocation
          </div>
          <div className="text-xs text-[#7E7E7E]">
            Each strategy&apos;s share of vault debt over time, reconstructed from StrategyReported reports.
          </div>
        </div>

        {hasData && (
          <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
            {ALLOCATION_TIMEFRAMES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTimeframe(option.value)}
                className={cn(
                  'min-w-0 rounded-md px-3 py-2 text-center text-xs font-medium transition-colors sm:text-sm',
                  timeframe === option.value ? 'bg-[#0657f9] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {isMobile ? option.mobileLabel : option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center text-sm text-[#7E7E7E]" style={{ height: CHART_HEIGHT }}>
          Loading historical allocation…
        </div>
      ) : error ? (
        <div className="flex items-center justify-center text-sm text-red-500" style={{ height: CHART_HEIGHT }}>
          Couldn&apos;t load historical allocation data.
        </div>
      ) : !hasData ? (
        <div className="flex items-center justify-center text-sm text-[#7E7E7E]" style={{ height: CHART_HEIGHT }}>
          No historical allocation data available for this vault.
        </div>
      ) : !hasVisibleData ? (
        <div className="flex items-center justify-center text-sm text-[#7E7E7E]" style={{ height: CHART_HEIGHT }}>
          No allocation data in this time range.
        </div>
      ) : (
        <div className="w-full" style={{ height: CHART_HEIGHT }}>
          <HistoricalAllocationChart points={filteredPoints} strategies={visibleStrategies} />
        </div>
      )}
    </div>
  )
}

export default HistoricalAllocationPanel
