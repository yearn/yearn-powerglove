import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SharedStatsChartControls } from './SharedStatsChartControls'
import { StatsChainSelector } from './StatsChainSelector'
import { StatsTimeRangeContext } from './StatsContext'

vi.mock('@/components/ui/use-mobile', () => ({ useIsMobile: () => true }))
vi.mock('./hooks', () => ({
  useFetch: (url: string) => ({
    data:
      url === '/api/tvl'
        ? { datasetId: 'selected' }
        : { range: { from: Date.parse('2020-01-01') / 1000, to: Date.parse('2026-01-01') / 1000 } },
    loading: false,
    error: null
  })
}))
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function Controls() {
  const [range, setRange] = useState({ start: '2023-01-01', end: '2026-01-01' })
  const [chain, setChain] = useState('all')
  return (
    <StatsTimeRangeContext.Provider value={{ range, setRange }}>
      <SharedStatsChartControls
        chainSelector={<StatsChainSelector value={chain} onValueChange={setChain} drawerOnMobile />}
      />
      <output aria-label="Selected range">
        {range.start} – {range.end}
      </output>
    </StatsTimeRangeContext.Provider>
  )
}
it('moves the mobile timeline into a date drawer and retains committed dates', () => {
  render(<Controls />)
  expect(screen.queryByRole('slider')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Date range: Jan 2023 – Jan 2026' }))
  const dialog = screen.getByRole('dialog', { name: 'Date range' })
  const start = within(dialog).getByRole('slider', { name: 'Range start' })
  start.focus()
  fireEvent.keyDown(start, { key: 'ArrowLeft' })
  expect(screen.getByLabelText('Selected range').textContent).toBe('2022-12-31 – 2026-01-01')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close date range' }))
  expect(dialog.getAttribute('data-state')).toBe('closed')
  expect(screen.getByRole('button', { name: 'Date range: Dec 2022 – Jan 2026', hidden: true })).toBeTruthy()
})
it('selects a chain from a single-column drawer and closes it', () => {
  render(<Controls />)
  fireEvent.click(screen.getByRole('button', { name: 'Choose chain: All Chains' }))
  const dialog = screen.getByRole('dialog', { name: 'Chains' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Ethereum' }))
  expect(dialog.getAttribute('data-state')).toBe('closed')
  expect(screen.getByRole('button', { name: 'Choose chain: Ethereum', hidden: true })).toBeTruthy()
})

it('collapses and restores the mobile toolbar while retaining the selected range', () => {
  render(<Controls />)
  fireEvent.click(screen.getByRole('button', { name: 'Collapse chart controls' }))
  expect(screen.queryByRole('button', { name: 'Choose chain: All Chains' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Date range:/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Expand chart controls' }))
  expect(screen.getByRole('button', { name: 'Date range: Jan 2023 – Jan 2026' })).toBeTruthy()
})
