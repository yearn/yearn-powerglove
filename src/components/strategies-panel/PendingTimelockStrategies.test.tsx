import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { PendingTimelockStrategy } from '@/hooks/usePendingTimelockStrategies'
import { PendingTimelockStrategies } from './PendingTimelockStrategies'

const state = vi.hoisted(() => ({
  data: [] as PendingTimelockStrategy[] | undefined,
  isError: false,
  isPending: false
}))
vi.mock('@/hooks/usePendingTimelockStrategies', () => ({ usePendingTimelockStrategies: () => state }))
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
it('shows scheduled additions separately with ready status, zero debt and explorer links', () => {
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
  render(<PendingTimelockStrategies {...props} />)
  expect(screen.getByText('Timelock ready')).toBeTruthy()
  fireEvent.click(screen.getByText('Test strategy'))
  expect(screen.getByText('Maximum debt: 0 USDC')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Queued transaction' }).getAttribute('href')).toBe(
    `https://etherscan.io/tx/0x${'5'.repeat(64)}`
  )
})
