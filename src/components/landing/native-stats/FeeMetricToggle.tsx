import type { ChainFeeMetric } from './chain-fee-history'

export function FeeMetricToggle({
  value,
  onValueChange,
  label
}: {
  value: ChainFeeMetric
  onValueChange: (value: ChainFeeMetric) => void
  label: string
}) {
  return (
    <fieldset className="tvl-history-control-group" aria-label={`${label} metric`}>
      {(['earnings', 'fees'] as const).map((metric) => (
        <button
          key={metric}
          type="button"
          className={value === metric ? 'active' : undefined}
          aria-pressed={value === metric}
          onClick={() => onValueChange(metric)}
        >
          {metric === 'earnings' ? 'Earnings' : 'Fees'}
        </button>
      ))}
    </fieldset>
  )
}
