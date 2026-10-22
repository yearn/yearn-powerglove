import type { ReactNode } from 'react'
import { useContext, useEffect } from 'react'
import { FeeDateSlider } from './FeeTimeRangeSlider'
import { feeRangeDate, feeSliderValues } from './fee-range-slider'
import { useFetch } from './hooks'
import { StatsChartControls } from './StatsChartControls'
import { StatsTimeRangeContext } from './StatsContext'
import type { LegacyTvlSummary } from './tvl-summary'
import type { TvlHistoryRun } from './types'

export function SharedStatsChartControls({ chainSelector }: { chainSelector: ReactNode }) {
  const { range, setRange } = useContext(StatsTimeRangeContext)
  const summary = useFetch<LegacyTvlSummary>('/api/tvl')
  const filters = new URLSearchParams({ groupBy: 'chain', mode: 'external', interval: 'weekly' })
  if (summary.data?.datasetId) filters.set('datasetId', summary.data.datasetId)
  const history = useFetch<TvlHistoryRun>(`/api/tvl/history/runs/latest?${filters}`, { enabled: !!summary.data })
  const bounds = history.data
    ? {
        start: new Date(history.data.range.from * 1000).toISOString().slice(0, 10),
        end: new Date(history.data.range.to * 1000).toISOString().slice(0, 10)
      }
    : null
  const values = bounds ? feeSliderValues(bounds, range, 365) : null
  const start = values ? feeRangeDate(values[0]) : null
  const end = values ? feeRangeDate(values[1]) : null
  useEffect(() => {
    if (start && end && (range?.start !== start || range?.end !== end)) setRange({ start, end })
  }, [start, end, range, setRange])
  return (
    <StatsChartControls leading={chainSelector}>
      {bounds ? (
        <FeeDateSlider bounds={bounds} selected={range} onApply={setRange} minDurationDays={365} />
      ) : summary.error || history.error ? (
        <div className="fee-range-timeline text-dim">
          Timeline could not be loaded.{' '}
          <button
            type="button"
            className="page-btn"
            onClick={() => {
              summary.retry()
              history.retry()
            }}
          >
            Retry timeline
          </button>
        </div>
      ) : (
        <output className="fee-range-timeline text-dim">Loading timeline…</output>
      )}
    </StatsChartControls>
  )
}
