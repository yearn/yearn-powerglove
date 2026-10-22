import type { ChainFeeHistoryView } from './ChainFeeHistoryCharts'
import type { FeeHistoryInterval } from './canonical-fees'

export interface ChartViewControl {
  view: ChainFeeHistoryView
  onViewChange?: (view: ChainFeeHistoryView) => void
}

export function ChartViewToggle({
  view,
  onViewChange,
  interval,
  label
}: ChartViewControl & {
  interval: FeeHistoryInterval
  label: string
}) {
  if (!onViewChange) return null
  return (
    <fieldset className="tvl-history-control-group" aria-label={`${label} chart view`}>
      {(['periodic', 'cumulative'] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          className={view === value ? 'active' : undefined}
          onClick={() => onViewChange(value)}
        >
          {value === 'cumulative' ? 'Cumulative' : interval === 'weekly' ? 'Weekly' : 'Monthly'}
        </button>
      ))}
    </fieldset>
  )
}
