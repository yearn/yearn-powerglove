import * as Slider from '@radix-ui/react-slider'
import { useState } from 'react'
import type { ChartDateRange } from '@/components/charts/chart-utils'
import { feeRangeDate, feeRangeDay, feeSliderTicks, feeSliderValues } from './fee-range-slider'

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
  onApply,
  minDurationDays = 0
}: {
  bounds: ChartDateRange
  selected: ChartDateRange | null
  onApply: (range: ChartDateRange) => void
  minDurationDays?: number
}) {
  const selectionKey = `${bounds.start}:${bounds.end}:${selected?.start}:${selected?.end}`
  const [draft, setDraft] = useState<{ key: string; values: number[] } | null>(null)
  const values = draft?.key === selectionKey ? draft.values : feeSliderValues(bounds, selected, minDurationDays)
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
        minStepsBetweenThumbs={Math.min(minDurationDays, max - min)}
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
