import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APYChart } from '@/components/charts/APYChart'
import { PPSChart } from '@/components/charts/PPSChart'
import { VaultActivityChart } from '@/components/charts/VaultActivityChart'
import { VaultLockedProfitChart } from '@/components/charts/VaultLockedProfitChart'
import { VaultLockedSharesChart } from '@/components/charts/VaultLockedSharesChart'
import type { VaultActivityData } from '@/types/vaultActivityTypes'

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

describe('VaultActivityChart', () => {
  it('renders harvest event lines and activity unlock series', () => {
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

    const activityData: VaultActivityData = {
      schemaVersion: 1,
      generatedAt: '2026-04-26T00:00:00.000Z',
      chainId: 1,
      vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      currentUnlock: {
        chainId: 1,
        vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        updatedAt: 1777118400,
        updatedAtIso: '2026-04-25T12:00:00.000Z',
        unlockPercent: 0.5,
        unlockRatePerDay: 0.1,
        profitUnlockMode: 'v3_shares'
      },
      events: [
        {
          id: 'report-profit-1',
          eventType: 'strategy_reported',
          chainId: 1,
          vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          blockNumber: 1,
          timestamp: 1777032000,
          timestampIso: '2026-04-24T12:00:00.000Z',
          label: 'Harvest reported',
          description: 'Harvest report',
          gain: '1000',
          gainDisplay: 1
        },
        {
          id: 'report-1',
          eventType: 'strategy_reported',
          chainId: 1,
          vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          blockNumber: 2,
          timestamp: 1777118400,
          timestampIso: '2026-04-25T12:00:00.000Z',
          label: 'Strategy reported',
          description: 'Flat report',
          gain: '0',
          gainDisplay: 0
        }
      ],
      series: [
        {
          date: '2026-04-24',
          timestamp: 1777032000,
          harvestCount: 1,
          unlockPercent: 0.4,
          unlockRatePerDay: 0.1
        },
        {
          date: '2026-04-25',
          timestamp: 1777118400,
          harvestCount: 0,
          unlockPercent: 0.5,
          unlockRatePerDay: 0.1
        }
      ]
    }

    const { container, getByText } = render(
      <div style={{ width: '400px', height: '300px' }}>
        <VaultActivityChart activityData={activityData} timeframe="30d" />
      </div>
    )

    expect(getByText('Harvest events')).toBeTruthy()
    expect(container.querySelector('path[stroke="var(--color-unlockPercent)"]')).toBeTruthy()
    expect(container.querySelector('path[stroke="var(--color-unlockRatePerDay)"]')).toBeTruthy()
    expect(container.querySelectorAll('line[stroke="#0657f9"]').length).toBe(1)
  })
})

describe('VaultLockedProfitChart', () => {
  it('renders harvest event lines and remaining locked profit series', () => {
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

    const activityData: VaultActivityData = {
      schemaVersion: 1,
      generatedAt: '2026-04-26T00:00:00.000Z',
      chainId: 1,
      vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      currentUnlock: {
        chainId: 1,
        vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        updatedAt: 1777118400,
        updatedAtIso: '2026-04-25T12:00:00.000Z',
        lockedProfitPercent: 0.2,
        unlockRatePerDay: 0.1,
        fullProfitUnlockDate: 1777204800,
        profitUnlockMode: 'v3_shares'
      },
      events: [
        {
          id: 'report-profit-1',
          eventType: 'strategy_reported',
          chainId: 1,
          vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          blockNumber: 1,
          timestamp: 1777032000,
          timestampIso: '2026-04-24T12:00:00.000Z',
          label: 'Harvest reported',
          description: 'Harvest report',
          gain: '1000',
          gainDisplay: 1,
          lockedProfitPercent: 0.4,
          unlockRatePerDay: 0.1,
          fullProfitUnlockDate: 1777204800,
          profitUnlockMode: 'v3_shares'
        },
        {
          id: 'report-1',
          eventType: 'strategy_reported',
          chainId: 1,
          vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          blockNumber: 2,
          timestamp: 1777118400,
          timestampIso: '2026-04-25T12:00:00.000Z',
          label: 'Strategy reported',
          description: 'Flat report',
          gain: '0',
          gainDisplay: 0,
          lockedProfitPercent: 0.2,
          unlockRatePerDay: 0.1,
          fullProfitUnlockDate: 1777204800,
          profitUnlockMode: 'v3_shares'
        }
      ],
      series: []
    }

    const { container, getAllByText } = render(
      <div style={{ width: '400px', height: '300px' }}>
        <VaultLockedProfitChart activityData={activityData} timeframe="30d" />
      </div>
    )

    expect(getAllByText('Locked profit %').length).toBeGreaterThan(0)
    expect(container.querySelector('path[stroke="var(--color-lockedProfitPercent)"]')).toBeTruthy()
    expect(container.querySelector('path[stroke="var(--color-unlockRatePerDay)"]')).toBeTruthy()
    expect(container.querySelectorAll('line[stroke="#0657f9"]').length).toBe(1)
  })
})

describe('VaultLockedSharesChart', () => {
  it('renders harvest event lines and remaining locked share series', () => {
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

    const activityData: VaultActivityData = {
      schemaVersion: 1,
      generatedAt: '2026-04-26T00:00:00.000Z',
      chainId: 1,
      vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      currentUnlock: {
        chainId: 1,
        vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        updatedAt: 1777118400,
        updatedAtIso: '2026-04-25T12:00:00.000Z',
        remainingLockedSharesDisplay: 500,
        fullProfitUnlockDate: 1777204800,
        profitUnlockMode: 'v3_shares'
      },
      events: [
        {
          id: 'report-profit-1',
          eventType: 'strategy_reported',
          chainId: 1,
          vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          blockNumber: 1,
          timestamp: 1777032000,
          timestampIso: '2026-04-24T12:00:00.000Z',
          label: 'Harvest reported',
          description: 'Harvest report',
          gain: '1000',
          gainDisplay: 1,
          remainingLockedSharesDisplay: 1000,
          fullProfitUnlockDate: 1777204800,
          profitUnlockMode: 'v3_shares'
        },
        {
          id: 'report-1',
          eventType: 'strategy_reported',
          chainId: 1,
          vaultAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          blockNumber: 2,
          timestamp: 1777118400,
          timestampIso: '2026-04-25T12:00:00.000Z',
          label: 'Strategy reported',
          description: 'Flat report',
          gain: '0',
          gainDisplay: 0,
          remainingLockedSharesDisplay: 500,
          fullProfitUnlockDate: 1777204800,
          profitUnlockMode: 'v3_shares'
        }
      ],
      series: []
    }

    const { container, getAllByText } = render(
      <div style={{ width: '400px', height: '300px' }}>
        <VaultLockedSharesChart activityData={activityData} timeframe="30d" />
      </div>
    )

    expect(getAllByText('Locked shares').length).toBeGreaterThan(0)
    expect(container.querySelector('path[stroke="var(--color-remainingLockedSharesDisplay)"]')).toBeTruthy()
    expect(container.querySelectorAll('line[stroke="#0657f9"]').length).toBe(1)
  })
})
