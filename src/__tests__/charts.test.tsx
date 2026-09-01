import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APYChart } from '@/components/charts/APYChart'
import { ChartsPanel } from '@/components/charts/charts-panel'
import { PPSChart } from '@/components/charts/PPSChart'
import { YvUsdTVLChart, YvUsdTvlTooltipContent } from '@/components/charts/YvUsdTVLChart'

const openApySeriesMenu = async (
  view: ReturnType<typeof render>,
  dropdownLabel: 'Historical' | 'Oracle & estimates'
) => {
  const trigger = view.getByRole('button', { name: new RegExp(`^${dropdownLabel} values`, 'i') })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'Enter' })
  await view.findByRole('menu')
}

const toggleApySeries = async (
  view: ReturnType<typeof render>,
  dropdownLabel: 'Historical' | 'Oracle & estimates',
  seriesName: RegExp
) => {
  await openApySeriesMenu(view, dropdownLabel)
  fireEvent.click(await view.findByRole('menuitemcheckbox', { name: seriesName }))
  fireEvent.keyDown(document, { key: 'Escape' })
}

describe('APYChart', () => {
  it('renders without crashing', async () => {
    const data = Array.from({ length: 10 }).map((_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      sevenDayApy: Math.random() * 10,
      thirtyDayApy: Math.random() * 10,
      derivedApr: Math.random() * 10,
      derivedApy: Math.random() * 10,
      yBoldEstimatedApy: Math.random() * 10,
      oracleApy: Math.random() * 10,
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

    const view = render(
      <div style={{ width: '400px', height: '300px' }}>
        <APYChart
          chartData={data}
          timeframe="30d"
          hideTooltip
          historicalApySeries={data.map((point, index) => ({
            date: point.date,
            pps90DayApy: null,
            pps180DayApy: null,
            ppsOneYearApy: null,
            ppsAllTimeApy: index === 0 ? null : 6 + index / 10
          }))}
        />
      </div>
    )
    const { container } = view
    expect(
      container.querySelector('path[stroke="var(--color-derivedApy)"][stroke-width="2.5"]:not([stroke-dasharray])')
    ).toBeTruthy()
    expect(container.querySelector('path[stroke="var(--color-sevenDayApy)"][stroke-width="2"]')).toBeTruthy()
    expect(
      container.querySelector('path[stroke="var(--color-thirtyDayApy)"][stroke-width="3.5"]:not([stroke-dasharray])')
    ).toBeTruthy()
    expect(
      container.querySelector(
        'path[stroke="var(--color-yBoldEstimatedApy)"][stroke-width="1.5"][stroke-dasharray="12 4"]'
      )
    ).toBeTruthy()
    expect(container.querySelector('style')?.textContent).toContain('--color-yBoldEstimatedApy: var(--chart-1)')
    expect(container.querySelector('style')?.textContent).toContain('--color-thirtyDayApy: var(--chart-1)')
    expect(container.querySelector('path[stroke="var(--color-ppsAllTimeApy)"]')).toBeTruthy()

    await toggleApySeries(view, 'Oracle & estimates', /^estimated apy/i)
    expect(container.querySelector('path[stroke="var(--color-yBoldEstimatedApy)"]')).toBeNull()

    await toggleApySeries(view, 'Historical', /^all-time apy/i)
    expect(container.querySelector('path[stroke="var(--color-ppsAllTimeApy)"]')).toBeNull()

    await toggleApySeries(view, 'Historical', /^all-time apy/i)
    expect(container.querySelector('path[stroke="var(--color-ppsAllTimeApy)"]')).toBeTruthy()

    expect(container.querySelector('path[stroke="var(--color-oracleApy)"]')).toBeNull()

    await toggleApySeries(view, 'Oracle & estimates', /^oracle apy fee-adjusted/i)
    expect(
      container.querySelector('path[stroke="var(--color-oracleApy)"][stroke-width="1.5"]:not([stroke-dasharray])')
    ).toBeTruthy()
    expect(container.querySelector('style')?.textContent).toContain('--color-oracleApy: var(--chart-4)')

    expect(container.querySelector('path[stroke="var(--color-oracleApy30dAvg)"]')).toBeNull()

    await toggleApySeries(view, 'Oracle & estimates', /^oracle apy \(30d avg\)/i)
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
      pps90DayApy: false,
      pps180DayApy: false,
      ppsOneYearApy: false,
      ppsAllTimeApy: false,
      estimatedApy: false,
      estimatedApy30dAvg: true,
      yBoldEstimatedApy: false,
      oracleApy: false,
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

  it('offers grouped multi-select APY controls for paired and standard vault charts', async () => {
    const pairedVault = render(
      <ChartsPanel
        aprApyData={aprApyData}
        ppsData={ppsData}
        tvlData={tvlData}
        yvUsdChartData={{
          unlockedAprApyData: aprApyData.map((point) => ({ ...point, oracleApy: 6 })),
          lockedAprApyData: aprApyData.map((point) => ({ ...point, oracleApy: 8 })),
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

    expect(pairedVault.getByRole('button', { name: /^historical values/i })).toBeTruthy()
    expect(pairedVault.getByRole('button', { name: /^oracle & estimates values/i })).toBeTruthy()

    await openApySeriesMenu(pairedVault, 'Historical')
    const selectedThirtyDayOption = pairedVault.getByRole('menuitemcheckbox', { name: /^30-day apy/i })
    expect(selectedThirtyDayOption.getAttribute('data-state')).toBe('checked')
    expect(selectedThirtyDayOption.className).toContain('focus:text-[#0657f9]')
    expect(pairedVault.getByRole('menuitemcheckbox', { name: /^all-time apy/i }).getAttribute('data-state')).toBe(
      'checked'
    )
    expect(pairedVault.queryByText('Period APY')).toBeNull()
    expect(pairedVault.queryByText('Latest period return')).toBeNull()
    expect(pairedVault.getByText('Rolling history')).toBeTruthy()
    expect(
      pairedVault
        .getByRole('menuitemcheckbox', { name: /^1-day apy/i })
        .querySelector('line')
        ?.getAttribute('stroke')
    ).toBe('#94adf2')
    expect(
      pairedVault
        .getByRole('menuitemcheckbox', { name: /^7-day apy/i })
        .querySelector('line')
        ?.getAttribute('stroke')
    ).toBe('#46a2ff')
    expect(selectedThirtyDayOption.querySelector('line')?.getAttribute('stroke')).toBe('#46a2ff')
    pairedVault.unmount()

    const standardVault = render(<ChartsPanel aprApyData={aprApyData} ppsData={ppsData} tvlData={tvlData} />)
    expect(standardVault.getByRole('button', { name: /^historical values/i })).toBeTruthy()
    expect(standardVault.getByText('Historical return over All Time')).toBeTruthy()

    fireEvent.click(standardVault.getByRole('button', { name: '180 Days' }))
    expect(standardVault.getByText('Historical return over 180 Days')).toBeTruthy()
  })

  it('defaults V3 charts to rolling 30-day, all-time, and the available estimate', () => {
    const start = 1_767_225_600
    const rollingPpsData = Array.from({ length: 31 }, (_, day) => ({
      date: new Date((start + day * 86400) * 1000).toISOString().slice(0, 10),
      PPS: 1 + day * 0.001,
      time: start + day * 86400
    }))
    const yBoldAprApyData = rollingPpsData.map((point) => ({
      date: point.date,
      sevenDayApy: 4,
      thirtyDayApy: 5,
      derivedApr: 6,
      derivedApy: 6.2,
      oracleApy: 8,
      yBoldEstimatedApy: 9
    }))
    const { container } = render(
      <ChartsPanel aprApyData={yBoldAprApyData} ppsData={rollingPpsData} tvlData={tvlData} isV3Vault isYBold />
    )

    expect(container.querySelector('path[stroke="var(--color-sevenDayApy)"]')).toBeNull()
    expect(container.querySelector('path[stroke="var(--color-oracleApy)"]')).toBeNull()
    expect(
      container.querySelector('path[stroke="var(--color-thirtyDayApy)"][stroke-width="3.5"]:not([stroke-dasharray])')
    ).toBeTruthy()
    expect(container.querySelector('path[stroke="var(--color-ppsAllTimeApy)"]')).toBeTruthy()
    expect(
      container.querySelector(
        'path[stroke="var(--color-yBoldEstimatedApy)"][stroke-width="1.5"][stroke-dasharray="12 4"]'
      )
    ).toBeTruthy()
  })

  it('allows multiple rolling timeframe APYs to be selected together', async () => {
    const start = 1_735_689_600
    const longPpsData = Array.from({ length: 366 }, (_, day) => ({
      date: new Date((start + day * 86400) * 1000).toISOString().slice(0, 10),
      PPS: 1 + day * 0.0001,
      time: start + day * 86400
    }))
    const longAprApyData = longPpsData.map((point) => ({
      date: point.date,
      sevenDayApy: 4,
      thirtyDayApy: 5,
      derivedApr: 6,
      derivedApy: 6.2,
      estimatedApy: 7,
      estimatedApy30dAvg: 6.8
    }))
    const view = render(<ChartsPanel aprApyData={longAprApyData} ppsData={longPpsData} tvlData={tvlData} />)

    await toggleApySeries(view, 'Historical', /^90-day apy/i)

    expect(
      view.container.querySelector(
        'path[stroke="var(--color-thirtyDayApy)"][stroke-width="3.5"]:not([stroke-dasharray])'
      )
    ).toBeTruthy()
    expect(view.container.querySelector('path[stroke="var(--color-pps90DayApy)"]')).toBeTruthy()
    expect(view.container.querySelector('path[stroke="var(--color-ppsAllTimeApy)"]')).toBeTruthy()
  })

  it('keeps APY explanations in the grouped dropdowns', async () => {
    const yBoldAprApyData = aprApyData.map((point) => ({
      ...point,
      oracleApy: 8,
      yBoldEstimatedApy: 9
    }))
    const view = render(
      <ChartsPanel aprApyData={yBoldAprApyData} ppsData={ppsData} tvlData={tvlData} isV3Vault isYBold />
    )
    await openApySeriesMenu(view, 'Oracle & estimates')
    expect(view.getByText('The larger of the 7-day PPS APY and fee-adjusted Oracle APY.')).toBeTruthy()
  })

  it('falls back to Oracle APY when a V3 estimate is unavailable', () => {
    const oracleOnlyData = aprApyData.map((point) => ({
      ...point,
      estimatedApy: null,
      estimatedApy30dAvg: null,
      oracleApy: 8
    }))
    const { container } = render(
      <ChartsPanel aprApyData={oracleOnlyData} ppsData={ppsData} tvlData={tvlData} isV3Vault />
    )

    expect(
      container.querySelector('path[stroke="var(--color-oracleApy)"][stroke-width="1.5"]:not([stroke-dasharray])')
    ).toBeTruthy()
    expect(container.querySelector('path[stroke="var(--color-estimatedApy)"]')).toBeNull()
    expect(container.querySelector('path[stroke="var(--color-estimatedApy30dAvg)"]')).toBeNull()
  })

  it('prefers an available V3 estimate over Oracle APY', async () => {
    const estimatedAndOracleData = aprApyData.map((point) => ({ ...point, oracleApy: 8 }))
    const view = render(
      <ChartsPanel aprApyData={estimatedAndOracleData} ppsData={ppsData} tvlData={tvlData} isV3Vault />
    )
    const { container } = view

    expect(
      container.querySelector('path[stroke="var(--color-estimatedApy)"][stroke-width="1.5"][stroke-dasharray="12 4"]')
    ).toBeTruthy()
    expect(container.querySelector('path[stroke="var(--color-oracleApy)"]')).toBeNull()

    await toggleApySeries(view, 'Oracle & estimates', /^oracle apy fee-adjusted/i)
    expect(container.querySelector('path[stroke="var(--color-estimatedApy)"]')).toBeTruthy()
    expect(container.querySelector('path[stroke="var(--color-oracleApy)"]')).toBeTruthy()
  })

  it('keeps the existing defaults for V2 and factory charts', () => {
    const start = 1_767_225_600
    const rollingPpsData = Array.from({ length: 31 }, (_, day) => ({
      date: new Date((start + day * 86400) * 1000).toISOString().slice(0, 10),
      PPS: 1 + day * 0.001,
      time: start + day * 86400
    }))
    const rollingAprApyData = rollingPpsData.map((point) => ({ ...aprApyData[0], date: point.date }))
    const { container } = render(
      <ChartsPanel aprApyData={rollingAprApyData} ppsData={rollingPpsData} tvlData={tvlData} />
    )

    expect(container.querySelector('path[stroke="var(--color-estimatedApy)"]')).toBeNull()
    expect(container.querySelector('path[stroke="var(--color-estimatedApy30dAvg)"]')).toBeTruthy()
    expect(
      container.querySelector('path[stroke="var(--color-thirtyDayApy)"][stroke-width="3.5"]:not([stroke-dasharray])')
    ).toBeTruthy()
    expect(container.querySelector('path[stroke="var(--color-ppsAllTimeApy)"]')).toBeTruthy()
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
