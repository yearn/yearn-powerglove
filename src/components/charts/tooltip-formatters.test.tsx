import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PPSChart } from '@/components/charts/PPSChart'
import { TVLChart } from '@/components/charts/TVLChart'
import { YvUsdDualLineChart } from '@/components/charts/YvUsdDualLineChart'

const tooltip = vi.hoisted(() => ({
  formatter: undefined as undefined | ((value: unknown, name: string) => unknown)
}))

vi.mock('@/components/ui/chart', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui/chart')>()),
  ChartTooltip: ({ formatter }: { formatter: typeof tooltip.formatter }) => {
    tooltip.formatter = formatter
    return null
  }
}))

const cases: { name: string; chart: ReactElement; missing: unknown; zero: unknown }[] = [
  { name: 'PPS', chart: <PPSChart chartData={[]} timeframe="all" />, missing: ['—', 'PPS'], zero: ['0.000', 'PPS'] },
  {
    name: 'derived APR',
    chart: <PPSChart chartData={[]} timeframe="all" dataKey="derivedApr" />,
    missing: ['—', 'Derived APR %'],
    zero: ['0.00%', 'Derived APR %']
  },
  { name: 'TVL', chart: <TVLChart chartData={[]} timeframe="all" />, missing: '—', zero: '$0' },
  ...(['apy', 'pps', 'tvl'] as const).map((valueType) => ({
    name: `paired ${valueType}`,
    chart: <YvUsdDualLineChart chartData={[]} timeframe="all" valueType={valueType} />,
    missing: ['—', 'Locked yvUSD'],
    zero: [valueType === 'apy' ? '0.00%' : valueType === 'pps' ? '0.0000' : '$0', 'Locked yvUSD']
  }))
]

describe('Recharts tooltip formatter contracts', () => {
  beforeEach(() => {
    tooltip.formatter = undefined
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })
  })

  afterEach(() => {
    vi.mocked(Element.prototype.getBoundingClientRect).mockRestore()
  })

  it.each(cases)('$name preserves unavailable values and genuine zero', ({ chart, missing, zero }) => {
    render(chart)
    expect(tooltip.formatter).toBeTypeOf('function')
    for (const value of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, '5', [5]]) {
      expect(tooltip.formatter?.(value, 'locked')).toEqual(missing)
    }
    expect(tooltip.formatter?.(0, 'locked')).toEqual(zero)
  })
})
