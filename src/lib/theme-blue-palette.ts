const DEFAULT_PRIMARY_HUE = 220
const DEFAULT_PRIMARY_SATURATION = 95
const MIN_BLUE_SATURATION = 40
const BLUE_HUE_MIN = 190
const BLUE_HUE_MAX = 250

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeHue(value: number): number {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function isBlueHue(value: number): boolean {
  const normalizedHue = normalizeHue(value)
  return normalizedHue >= BLUE_HUE_MIN && normalizedHue <= BLUE_HUE_MAX
}

function parseHslChannels(value: string): { hue: number; saturation: number; lightness: number } | null {
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    return null
  }

  const explicitMatch = normalizedValue.match(
    /^hsl\(\s*([-\d.]+)(?:deg)?(?:\s+|,\s*)([-\d.]+)%(?:\s+|,\s*)([-\d.]+)%(?:\s*\/\s*[-\d.]+%?)?\s*\)$/i
  )
  if (explicitMatch) {
    const hue = Number.parseFloat(explicitMatch[1] ?? '')
    const saturation = Number.parseFloat(explicitMatch[2] ?? '')
    const lightness = Number.parseFloat(explicitMatch[3] ?? '')

    if (Number.isFinite(hue) && Number.isFinite(saturation) && Number.isFinite(lightness)) {
      return { hue, saturation, lightness }
    }
  }

  const compactMatch = normalizedValue.match(/^([-\d.]+)(?:deg)?(?:\s+|,\s*)([-\d.]+)%(?:\s+|,\s*)([-\d.]+)%$/i)
  if (!compactMatch) {
    return null
  }

  const hue = Number.parseFloat(compactMatch[1] ?? '')
  const saturation = Number.parseFloat(compactMatch[2] ?? '')
  const lightness = Number.parseFloat(compactMatch[3] ?? '')

  if (!Number.isFinite(hue) || !Number.isFinite(saturation) || !Number.isFinite(lightness)) {
    return null
  }

  return { hue, saturation, lightness }
}

function getThemeBlueChannels(): { hue: number; saturation: number; lightness: number } {
  if (typeof window === 'undefined') {
    return {
      hue: DEFAULT_PRIMARY_HUE,
      saturation: DEFAULT_PRIMARY_SATURATION,
      lightness: 50
    }
  }

  const computedStyle = window.getComputedStyle(document.documentElement)
  const candidateVariables = [
    '--color-primary',
    '--primary',
    '--color-sidebar-ring',
    '--sidebar-ring',
    '--color-accent',
    '--accent',
    '--color-chart-1',
    '--chart-1'
  ]

  for (const variableName of candidateVariables) {
    const parsedChannels = parseHslChannels(computedStyle.getPropertyValue(variableName))
    if (!parsedChannels) {
      continue
    }

    if (parsedChannels.saturation >= MIN_BLUE_SATURATION && isBlueHue(parsedChannels.hue)) {
      return parsedChannels
    }
  }

  return {
    hue: DEFAULT_PRIMARY_HUE,
    saturation: DEFAULT_PRIMARY_SATURATION,
    lightness: 50
  }
}

export function buildBlueShadePalette(isDark: boolean): string[] {
  const { hue, saturation } = getThemeBlueChannels()
  const paletteSteps = isDark
    ? [
        { saturation: clamp(saturation - 8, 68, 100), lightness: 78 },
        { saturation: clamp(saturation + 2, 72, 100), lightness: 60 },
        { saturation: clamp(saturation - 12, 64, 100), lightness: 46 },
        { saturation: clamp(saturation + 4, 74, 100), lightness: 34 },
        { saturation: clamp(saturation - 6, 68, 100), lightness: 70 },
        { saturation: clamp(saturation, 72, 100), lightness: 54 },
        { saturation: clamp(saturation - 10, 64, 100), lightness: 40 },
        { saturation: clamp(saturation + 6, 76, 100), lightness: 28 }
      ]
    : [
        { saturation: clamp(saturation - 6, 68, 100), lightness: 72 },
        { saturation: clamp(saturation + 2, 72, 100), lightness: 56 },
        { saturation: clamp(saturation - 10, 64, 100), lightness: 42 },
        { saturation: clamp(saturation + 4, 74, 100), lightness: 28 },
        { saturation: clamp(saturation - 4, 68, 100), lightness: 64 },
        { saturation: clamp(saturation, 72, 100), lightness: 50 },
        { saturation: clamp(saturation - 8, 64, 100), lightness: 36 },
        { saturation: clamp(saturation + 6, 76, 100), lightness: 24 }
      ]

  return paletteSteps.map(
    ({ saturation: paletteSaturation, lightness }) => `hsl(${hue} ${paletteSaturation}% ${lightness}%)`
  )
}
