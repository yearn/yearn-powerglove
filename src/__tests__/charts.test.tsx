import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APYChart } from '@/components/charts/APYChart'
import { ChartsPanel } from '@/components/charts/charts-panel'
import { PPSChart } from '@/components/charts/PPSChart'
import { YvUsdTVLChart, YvUsdTvlTooltipContent } from '@/components/charts/YvUsdTVLChart'

describe('APYChart', () => {
  it('renders without crashing', () => {
    const data = Array.from({ length: 10 }).map((_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      sevenDayApy: Math.random() * 10,
      thirtyDayApy: Math.random() * 10,
      derivedApr: Math.random() * 10,
      derivedApy: Math.random() * 10,
      oracleApr: Math.random() * 10,
      oracleApy30dAvg: Math.random() * 10
    }))

    // Mock getBoundingClientRect for Recharts ResponsiveContainer
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => {}
    }))

    const { container, getByLabelText } = render(
      <div style={{ width: '400px', height: '300px' }}>
        <APYChart chartData={data} timeframe="30d" hideTooltip />
      </div>
    )
    expect(container.querySelector('path[stroke="var(--color-sevenDayApy)"]')).toBeTruthy()

    const derivedApyCheckbox = getByLabelText(/1-day apy/i)
    expect(container.querySelector('path[stroke="var(--color-derivedApy)"]')).toBeTruthy()

    fireEvent.click(derivedApyCheckbox)
    expect(container.querySelector('path[stroke="var(--color-derivedApy)"]')).toBeNull()

    fireEvent.click(derivedApyCheckbox)
    expect(container.querySelector('path[stroke="var(--color-derivedApy)"]')).toBeTruthy()

    expect(container.querySelector('path[stroke="var(--color-oracleApr)"]')).toBeNull()

    const oracleAprCheckbox = getByLabelText(/oracle apr/i)
    fireEvent.click(oracleAprCheckbox)
    expect(container.querySelector('path[stroke="var(--color-oracleApr)"]')).toBeTruthy()

    expect(container.querySelector('path[stroke="var(--color-oracleApy30dAvg)"]')).toBeNull()

    const oracleApy30dCheckbox = getByLabelText(/oracle apy \(30d avg\)/i)
    fireEvent.click(oracleApy30dCheckbox)
    expect(container.querySelector('path[stroke="var(--color-oracleApy30dAvg)"]')).toBeTruthy()
  })

  it('shows estimated APY for both vaults and respects the vault scope', () => {
    const data = [
      { date: '2026-01-01', estimatedApy30dAvg: 5 },
      { date: '2026-01-02', estimatedApy30dAvg: 6 }
    ]
    const lockedData = [
      { date: '2026-01-01', estimatedApy30dAvg: 8 },
      { date: '2026-01-02', estimatedApy30dAvg: 9 }
    ]
    const visibleSeries = {
      derivedApy: false,
      sevenDayApy: false,
      thirtyDayApy: false,
      ppsPeriodApy: false,
      estimatedApy: false,
      estimatedApy30dAvg: true,
      oracleApr: false,
      oracleApy30dAvg: false
    }

    const { container, rerender } = render(
      <div style={{ width: '400px', height: '300px' }}>
        <APYChart
          chartData={data}
          comparisonChartData={lockedData}
          timeframe="30d"
          visibleSeries={visibleSeries}
          seriesScope="both"
        />
      </div>
    )

    expect(
      container.querySelector('path[stroke="var(--color-estimatedApy30dAvg)"][stroke-dasharray="12 4"]')
    ).toBeTruthy()
    expect(
      container.querySelector('path[stroke="var(--color-lockedestimatedApy30dAvg)"][stroke-dasharray="2 4"]')
    ).toBeTruthy()

    rerender(
      <div style={{ width: '400px', height: '300px' }}>
        <APYChart
          chartData={data}
          comparisonChartData={lockedData}
          timeframe="30d"
          visibleSeries={visibleSeries}
          seriesScope="primary"
        />
      </div>
    )

    expect(container.querySelector('path[stroke="var(--color-estimatedApy30dAvg)"]')).toBeTruthy()
    expect(container.querySelector('path[stroke="var(--color-lockedestimatedApy30dAvg)"]')).toBeNull()
  })
})

describe('ChartsPanel', () => {
  const aprApyData = [
    {
      date: '2026-01-01',
      sevenDayApy: 4,
      thirtyDayApy: 5,
      derivedApr: 6,
      derivedApy: 6.2,
      estimatedApy: 7,
      estimatedApy30dAvg: 6.8
    },
    {
      date: '2026-01-02',
      sevenDayApy: 4.1,
      thirtyDayApy: 5.1,
      derivedApr: 6.1,
      derivedApy: 6.3,
      estimatedApy: 7.1,
      estimatedApy30dAvg: 6.9
    }
  ]
  const ppsData = [
    { date: '2026-01-01', PPS: 1, time: 1_767_225_600 },
    { date: '2026-01-02', PPS: 1.001, time: 1_767_312_000 }
  ]
  const tvlData = [
    { date: '2026-01-01', TVL: 1_000_000 },
    { date: '2026-01-02', TVL: 1_100_000 }
  ]

  it('removes Period APY from yvUSD only', () => {
    const { queryByLabelText, unmount } = render(
      <ChartsPanel
        aprApyData={aprApyData}
        ppsData={ppsData}
        tvlData={tvlData}
        yvUsdChartData={{
          unlockedAprApyData: aprApyData,
          lockedAprApyData: aprApyData,
          lockedPpsData: ppsData,
          ppsData: [
            { date: '2026-01-01', unlocked: 1, locked: 1 },
            { date: '2026-01-02', unlocked: 1.001, locked: 1.002 }
          ],
          tvlData: [
            { date: '2026-01-01', unlocked: 750_000, locked: 250_000 },
            { date: '2026-01-02', unlocked: 800_000, locked: 300_000 }
          ]
        }}
      />
    )

    expect(queryByLabelText(/period apy/i)).toBeNull()
    unmount()

    const standardVault = render(<ChartsPanel aprApyData={aprApyData} ppsData={ppsData} tvlData={tvlData} />)
    expect(standardVault.getByLabelText(/period apy/i)).toBeTruthy()
  })
})

describe('PPSChart', () => {
  it('renders PPS line by default and APR line when specified', () => {
    const ppsData = Array.from({ length: 10 }).map((_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      PPS: 1 + i * 0.01
    }))

    const aprData = Array.from({ length: 10 }).map((_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      derivedApr: Math.random() * 10
    }))

    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => {}
    }))

    const { container: ppsContainer } = render(
      <div style={{ width: '400px', height: '300px' }}>
        <PPSChart chartData={ppsData} timeframe="30d" />
      </div>
    )

    expect(ppsContainer.querySelector('path[stroke="var(--color-pps)"]')).toBeTruthy()

    const { container: aprContainer } = render(
      <div style={{ width: '400px', height: '300px' }}>
        <PPSChart chartData={aprData} timeframe="30d" dataKey="derivedApr" hideAxes hideTooltip />
      </div>
    )

    expect(aprContainer.querySelector('path[stroke="var(--color-derivedApr)"]')).toBeTruthy()
  })
})

describe('YvUsdTVLChart', () => {
  it('renders locked and unlocked TVL as stacked bars', () => {
    const chartData = [
      { date: '2026-01-01', unlocked: 750_000, locked: 250_000 },
      { date: '2026-01-02', unlocked: 800_000, locked: 300_000 }
    ]

    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => {}
    }))

    const { container } = render(
      <div style={{ width: '400px', height: '300px' }}>
        <YvUsdTVLChart chartData={chartData} timeframe="30d" />
      </div>
    )

    expect(container.querySelector('[fill="var(--color-unlocked)"]')).toBeTruthy()
    expect(container.querySelector('[fill="var(--color-locked)"]')).toBeTruthy()
    expect(container.querySelector('path[stroke="var(--color-unlocked)"]')).toBeNull()
  })

  it('shows the combined locked and unlocked value in the tooltip', () => {
    const { getByText } = render(
      <YvUsdTvlTooltipContent
        active
        label="2026-01-01"
        payload={[
          { dataKey: 'unlocked', name: 'unlocked', value: 750_000 },
          { dataKey: 'locked', name: 'locked', value: 250_000 }
        ]}
      />
    )

    expect(getByText('Combined')).toBeTruthy()
    expect(getByText('$1,000,000')).toBeTruthy()
  })
})
