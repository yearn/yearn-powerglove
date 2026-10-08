import { BarChart3, LineChart } from 'lucide-react'

export type StatsChartType = 'bar' | 'line'

export function ChartTypeToggle({
  value,
  onValueChange,
  label
}: {
  value: StatsChartType
  onValueChange: (value: StatsChartType) => void
  label: string
}) {
  return (
    <fieldset className="tvl-history-control-group icon-group" aria-label={`${label} chart type`}>
      {(['bar', 'line'] as const).map((type) => (
        <button
          key={type}
          type="button"
          className={value === type ? 'active' : undefined}
          aria-label={`Show ${label} as ${type === 'bar' ? 'bars' : 'lines'}`}
          aria-pressed={value === type}
          onClick={() => onValueChange(type)}
        >
          {type === 'bar' ? <BarChart3 size={15} strokeWidth={1.8} /> : <LineChart size={15} strokeWidth={1.8} />}
        </button>
      ))}
    </fieldset>
  )
}
