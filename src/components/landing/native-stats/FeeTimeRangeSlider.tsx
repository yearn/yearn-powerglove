import * as Slider from '@radix-ui/react-slider'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { ChartDateRange } from '@/components/charts/chart-utils'
import type { CanonicalFeeHistory } from './canonical-fees'
import { feeRangeDate, feeRangeDay, feeSliderBounds, feeSliderTicks, feeSliderValues } from './fee-range-slider'
import { resolveStatsApiBase } from './hooks'

function formatSliderDate(date: string, day = true): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    ...(day ? { day: 'numeric' } : {}),
    year: 'numeric',
    timeZone: 'UTC'
  })
}

export function FeeDateSlider({
  bounds,
  selected,
  onApply
}: {
  bounds: ChartDateRange
  selected: ChartDateRange | null
  onApply: (range: ChartDateRange) => void
}) {
  const selectionKey = `${bounds.start}:${bounds.end}:${selected?.start}:${selected?.end}`
  const [draft, setDraft] = useState<{ key: string; values: number[] } | null>(null)
  const values = draft?.key === selectionKey ? draft.values : feeSliderValues(bounds, selected)
  const min = feeRangeDay(bounds.start)
  const max = feeRangeDay(bounds.end)

  return (
    <section className="fee-range-timeline" aria-label="Date range timeline">
      <div className="fee-range-dates">
        <span>
          Start <strong>{formatSliderDate(feeRangeDate(values[0]))}</strong>
        </span>
        <span>
          End <strong>{formatSliderDate(feeRangeDate(values[1]))}</strong>
        </span>
      </div>
      <Slider.Root
        className="fee-date-slider"
        value={values}
        min={min}
        max={max}
        step={1}
        minStepsBetweenThumbs={0}
        onValueChange={(next) => setDraft({ key: selectionKey, values: next })}
        onValueCommit={(next) => {
          setDraft(null)
          onApply({ start: feeRangeDate(next[0]), end: feeRangeDate(next[1]) })
        }}
      >
        <Slider.Track className="fee-date-track">
          <Slider.Range className="fee-date-selection" />
        </Slider.Track>
        {(['Range start', 'Range end'] as const).map((label, index) => (
          <Slider.Thumb
            key={label}
            className="fee-date-thumb"
            aria-label={label}
            aria-valuetext={formatSliderDate(feeRangeDate(values[index]))}
          />
        ))}
      </Slider.Root>
      <div className="fee-range-axis" aria-label="Full available timeframe">
        <span className="fee-range-axis-start">{formatSliderDate(bounds.start, false)}</span>
        {feeSliderTicks(bounds).map(({ year, position }) => (
          <span key={year} className="fee-range-year" style={{ left: `${position}%` }}>
            {year}
          </span>
        ))}
        <span className="fee-range-axis-end">{formatSliderDate(bounds.end, false)}</span>
      </div>
    </section>
  )
}

export function FeeTimeRangeSlider({
  datasetId,
  selected,
  onApply
}: {
  datasetId?: string
  selected: ChartDateRange | null
  onApply: (range: ChartDateRange) => void
}) {
  const base = resolveStatsApiBase('fees') ?? ''
  const history = useQuery({
    queryKey: ['fee-range-full-history', base, datasetId],
    enabled: !!datasetId,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
    queryFn: async ({ signal }): Promise<CanonicalFeeHistory> => {
      const params = new URLSearchParams({ interval: 'weekly', datasetId: datasetId ?? '' })
      const response = await fetch(`${base}/api/fees/history?${params}`, { signal })
      if (!response.ok) throw new Error('Timeline request failed')
      const data: CanonicalFeeHistory = await response.json()
      if (!Array.isArray(data.buckets) || data.interval !== 'weekly' || data.datasetId !== datasetId) {
        throw new Error('Timeline does not match the selected dataset')
      }
      return data
    }
  })

  if (!datasetId && !history.data) return null
  if (history.isError)
    return (
      <div className="fee-range-timeline text-dim">
        Timeline could not be loaded.{' '}
        <button type="button" className="page-btn" onClick={() => void history.refetch()}>
          Retry timeline
        </button>
      </div>
    )
  if (!history.data)
    return (
      <output className="fee-range-timeline text-dim" aria-live="polite">
        Loading timeline…
      </output>
    )
  const bounds = feeSliderBounds(history.data.buckets, Math.floor(Date.now() / 1000))
  if (!bounds) return null
  return <FeeDateSlider key={`${bounds.start}:${bounds.end}`} bounds={bounds} selected={selected} onApply={onApply} />
}
