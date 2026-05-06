const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

type PercentFormatOptions = {
  decimals?: number
  fallback?: string
}

type LocaleFormatOptions = {
  locales?: string[]
}

const isNumeric = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isFinite(value)

function resolveLocales(options?: LocaleFormatOptions): string[] {
  const browserLocale = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US'
  return [...(options?.locales ?? []), 'en-US', browserLocale]
}

function resolveSignificantFractionDigits(value: number): number {
  const absValue = Math.abs(value)
  const digitsBefore = absValue >= 100 ? 3 : absValue >= 10 ? 2 : 1
  return Math.max(0, 3 - digitsBefore)
}

function formatWithSignificantDigits(value: number, options?: LocaleFormatOptions): string {
  const safeValue = Number.isFinite(value) ? value : 0
  const fractionDigits = resolveSignificantFractionDigits(safeValue)
  const formatter = new Intl.NumberFormat(resolveLocales(options), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })
  return formatter.format(safeValue)
}

export const formatPercent = (value?: number | null, options: PercentFormatOptions = {}): string => {
  const { decimals = 2, fallback = ' - ' } = options
  if (!isNumeric(value)) {
    return fallback
  }
  return `${value.toFixed(decimals)}%`
}

export const formatPercentNullable = (value?: number | null, options: PercentFormatOptions = {}): string | null => {
  const { decimals = 2 } = options
  if (!isNumeric(value)) {
    return null
  }
  return `${value.toFixed(decimals)}%`
}

export const formatPercentFromDecimal = (value?: number | null, options: PercentFormatOptions = {}): string => {
  if (!isNumeric(value)) {
    return options.fallback ?? ' - '
  }
  return formatPercent(value * 100, options)
}

export const formatCurrency = (value?: number | null): string => usdFormatter.format(value ?? 0)

export const formatAllocationPercent = (value: number, options?: LocaleFormatOptions): string => {
  return `${formatWithSignificantDigits(value, options)}%`
}

export const formatApyDisplay = (value: number, options?: LocaleFormatOptions): string => {
  if (value === Infinity || value === -Infinity) {
    return '∞%'
  }

  const percentValue = (Number.isFinite(value) ? value : 0) * 100
  if (percentValue >= 500) {
    return '≥ 500%'
  }

  return `${formatWithSignificantDigits(percentValue, options)}%`
}

export const normalizeApyDisplayValue = (value: number): number => {
  if (value === Infinity || value === -Infinity) {
    return value
  }

  const percentValue = (Number.isFinite(value) ? value : 0) * 100
  const fractionDigits = resolveSignificantFractionDigits(percentValue)
  return Number(percentValue.toFixed(fractionDigits))
}

export const formatTvlDisplay = (value: number, options?: LocaleFormatOptions): string => {
  if (value === Infinity || value === -Infinity) {
    return '$∞'
  }

  const safeValue = Number.isFinite(value) ? value : 0
  const absValue = Math.abs(safeValue)
  const locales = resolveLocales(options)

  if (absValue >= 10000) {
    const formatter = new Intl.NumberFormat(locales, {
      notation: 'compact',
      compactDisplay: 'short',
      minimumSignificantDigits: 3,
      maximumSignificantDigits: 3
    })
    return `$${formatter.format(safeValue)}`
  }

  let minimumFractionDigits = 0
  let maximumFractionDigits = 0

  if (absValue < 1) {
    minimumFractionDigits = 2
    maximumFractionDigits = 2
  } else if (absValue < 10) {
    minimumFractionDigits = 2
    maximumFractionDigits = 2
  } else if (absValue < 100) {
    minimumFractionDigits = 1
    maximumFractionDigits = 2
  }

  const formatter = new Intl.NumberFormat(locales, {
    minimumFractionDigits,
    maximumFractionDigits
  })

  return `$${formatter.format(safeValue)}`
}

export const formatTokenDisplay = (value: number, options?: LocaleFormatOptions): string => {
  if (value === Infinity || value === -Infinity) {
    return '∞'
  }

  const safeValue = Number.isFinite(value) ? value : 0
  const absValue = Math.abs(safeValue)
  const locales = resolveLocales(options)

  if (absValue >= 10000) {
    const formatter = new Intl.NumberFormat(locales, {
      notation: 'compact',
      compactDisplay: 'short',
      minimumSignificantDigits: 3,
      maximumSignificantDigits: 3
    })
    return formatter.format(safeValue)
  }

  let minimumFractionDigits = 0
  let maximumFractionDigits = 0

  if (absValue < 1) {
    minimumFractionDigits = 2
    maximumFractionDigits = 4
  } else if (absValue < 10) {
    minimumFractionDigits = 2
    maximumFractionDigits = 3
  } else if (absValue < 100) {
    minimumFractionDigits = 1
    maximumFractionDigits = 2
  }

  const formatter = new Intl.NumberFormat(locales, {
    minimumFractionDigits,
    maximumFractionDigits
  })

  return formatter.format(safeValue)
}

const COMPACT_SCALE: Record<string, number> = {
  T: 1_000_000_000_000,
  B: 1_000_000_000,
  M: 1_000_000,
  K: 1_000
}

export const parseCompactDisplayNumber = (value: string): number => {
  if (value.includes('∞')) return Number.POSITIVE_INFINITY

  const parsedValue = Number.parseFloat(value.replace(/[^0-9.-]/g, ''))
  if (Number.isNaN(parsedValue)) return Number.NaN

  const upperValue = value.toUpperCase()
  for (const [suffix, multiplier] of Object.entries(COMPACT_SCALE)) {
    if (upperValue.includes(suffix)) {
      return parsedValue * multiplier
    }
  }

  return parsedValue
}
