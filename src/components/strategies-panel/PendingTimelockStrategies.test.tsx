import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { PendingTimelockStrategy } from '@/hooks/usePendingTimelockStrategies'
import type { VaultExtended } from '@/types/vaultTypes'
import { PendingTimelockStrategies } from './PendingTimelockStrategies'
import { StrategiesPanel } from './StrategiesPanel'

const state = vi.hoisted(() => ({
  data: [] as PendingTimelockStrategy[] | undefined,
  isError: false,
  isPending: false
}))
vi.mock('@/hooks/usePendingTimelockStrategies', () => ({ usePendingTimelockStrategies: () => state }))
vi.mock('@/hooks/useStrategiesData', () => ({
  useStrategiesData: () => ({ strategies: [], allocationChartData: [], isLoading: false, error: undefined })
}))
afterEach(() => {
  cleanup()
  state.data = []
  state.isError = false
  state.isPending = false
})
const props = { chainId: 1 as const, vaultAddress: `0x${'1'.repeat(40)}`, decimals: 6, symbol: 'USDC', enabled: true }

it('hides empty and disabled results', () => {
  const { container, rerender } = render(<PendingTimelockStrategies {...props} />)
  expect(container.textContent).toBe('')
  state.isPending = true
  rerender(<PendingTimelockStrategies {...props} enabled={false} />)
  expect(container.textContent).toBe('')
})
it('distinguishes unavailable data from no pending changes', () => {
  state.data = undefined
  state.isError = true
  render(<PendingTimelockStrategies {...props} />)
  expect(screen.getByRole('status').textContent).toContain('unavailable')
})
it('shows the first scheduled addition, unlock time, zero debt and explorer links on an empty allocator', () => {
  state.data = [
    {
      chainId: 1,
      vaultAddress: props.vaultAddress,
      strategyAddress: `0x${'2'.repeat(40)}`,
      timelockAddress: `0x${'3'.repeat(40)}`,
      operationId: `0x${'4'.repeat(64)}`,
      scheduleTxHash: `0x${'5'.repeat(64)}`,
      status: 'ready',
      queuedAt: 1700000000,
      eta: 1700604800,
      executorLabel: 'yChad',
      strategyName: 'Test strategy',
      maxDebtRaw: '0'
    }
  ]
  const vaultDetails = {
    address: props.vaultAddress,
    apiVersion: '3.0.4',
    asset: { decimals: props.decimals, symbol: props.symbol }
  } as VaultExtended
  render(<StrategiesPanel vaultChainId={props.chainId} vaultDetails={vaultDetails} />)
  expect(screen.getByText(/This vault contains no strategies/)).toBeTruthy()
  expect(screen.getAllByText('Test strategy')).toHaveLength(1)
  expect(screen.getByText(/^Unlocks /)).toBeTruthy()
  expect(screen.getByText('Timelock ready')).toBeTruthy()
  fireEvent.click(screen.getByText('Test strategy'))
  expect(screen.getByText('Maximum debt: 0 USDC')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Queued transaction' }).getAttribute('href')).toBe(
    `https://etherscan.io/tx/0x${'5'.repeat(64)}`
  )
})
