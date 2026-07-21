import { formatPercentFromDecimal } from '@/lib/formatters'
import type { ApyDisplayValue, ApyTooltipItem } from '@/types/dataTypes'
import type { EstimatedApySource, PairedApyValues } from '@/types/vaultTypes'

export const formatApyValue = (value: number | null | undefined): string =>
  formatPercentFromDecimal(value, { fallback: '-' })

export const buildSingleApyDisplay = (value: number | null | undefined): ApyDisplayValue => ({
  display: formatApyValue(value)
})

export const buildPairedApyDisplay = (
  values: PairedApyValues,
  details?: Partial<Record<keyof PairedApyValues, string>>
): ApyDisplayValue => {
  const locked = formatApyValue(values.locked)
  const unlocked = formatApyValue(values.unlocked)
  const tooltipItems: ApyTooltipItem[] = [
    { label: 'Locked yvUSD', value: locked, detail: details?.locked },
    { label: 'Unlocked yvUSD', value: unlocked, detail: details?.unlocked }
  ]

  return {
    display: `${locked} | ${unlocked}`,
    tooltipItems
  }
}

export const getEstimatedApySourceLabel = (source: EstimatedApySource): string => {
  if (source === 'oracle') return 'Oracle'
  if (source === 'unknown') return 'Unknown'
  return source
}
