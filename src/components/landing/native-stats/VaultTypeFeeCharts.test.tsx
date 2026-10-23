import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { CanonicalVaultFee } from './canonical-fees'
import { VaultTypeFeeCharts } from './VaultTypeFeeCharts'

vi.mock('recharts', async (original) => ({
  ...(await original<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
    cloneElement(children, { width: 640, height: 300 })
}))
vi.mock('./useVaultTypeFeeHistories', () => ({
  useVaultTypeFeeHistories: () => ({
    catalog: [],
    histories: [[vault('0xa', 'yearn-v3-allocator', '100', '20'), vault('0xb', 'yearn-v1-vault', '-10', '5')]],
    loading: false,
    error: null,
    retry: vi.fn()
  })
}))

function vault(address: string, contractFamily: string, earnings: string, fees: string): CanonicalVaultFee {
  return {
    address,
    name: address,
    chainId: 1,
    contractFamily,
    totalFeesPaidUsd: fees,
    protocolFeesUsd: null,
    managerFeesUsd: null,
    performanceFeesUsd: null,
    managementFeesUsd: null,
    strategistFeesUsd: null,
    totalRefundsUsd: null,
    lifetimeEarnings: {
      rawGrossGainsUsd: null,
      rawLossesUsd: null,
      rawNetYieldUsd: null,
      grossGainsUsd: null,
      lossesUsd: null,
      netYieldUsd: earnings
    }
  }
}

afterEach(cleanup)

it('switches a single vault-type chart between metrics while retaining hidden series and the shared view', () => {
  const chart = (view: 'periodic' | 'cumulative') => (
    <VaultTypeFeeCharts
      query="datasetId=selected"
      periods={[{ period: '2026-01' }]}
      interval="monthly"
      view={view}
      renderType="bar"
      onRenderTypeChange={vi.fn()}
    />
  )
  const rendered = render(chart('periodic'))
  const section = screen.getByRole('region', { name: 'Earnings and fees by vault type' })
  expect(section.querySelectorAll('.fee-chart-card')).toHaveLength(1)
  expect(section.querySelectorAll('.recharts-bar')).toHaveLength(2)
  const toggle = screen.getByRole('group', { name: 'Vault type metric' })
  fireEvent.click(within(toggle).getByRole('button', { name: 'Fees' }))
  expect(screen.getByRole('heading', { name: 'Fees by Vault Type' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Earnings by Vault Type' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'V3 Allocators & Strategies' }))
  expect(section.querySelectorAll('.recharts-bar')).toHaveLength(1)
  rendered.rerender(chart('cumulative'))
  expect(within(toggle).getByRole('button', { name: 'Fees' }).getAttribute('aria-pressed')).toBe('true')
  expect(section.querySelectorAll('.recharts-bar')).toHaveLength(1)
  fireEvent.click(within(toggle).getByRole('button', { name: 'Earnings' }))
  expect(screen.getByRole('heading', { name: 'Earnings by Vault Type' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'V3 Allocators & Strategies' }).getAttribute('aria-pressed')).toBe('false')
  expect(section.querySelectorAll('.recharts-bar')).toHaveLength(1)
})
