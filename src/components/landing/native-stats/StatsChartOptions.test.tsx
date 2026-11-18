import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StatsChartOptions } from './StatsChartOptions'

let mobile = true
vi.mock('@/components/ui/use-mobile', () => ({ useIsMobile: () => mobile }))
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
  mobile = true
})
function ChartOptions() {
  const [adjusted, setAdjusted] = useState(false)
  return (
    <StatsChartOptions title="TVL History">
      <label>
        <input type="checkbox" checked={adjusted} onChange={(event) => setAdjusted(event.target.checked)} />
        price adjusted
      </label>
    </StatsChartOptions>
  )
}
it('keeps mobile controls in an accessible chart-specific drawer and retains their selection on close', () => {
  render(<ChartOptions />)
  expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'TVL History options' }))
  const dialog = screen.getByRole('dialog', { name: 'TVL History options' })
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'price adjusted' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close chart options' }))
  expect(dialog.getAttribute('data-state')).toBe('closed')
  // jsdom does not run Vaul's exit animation; the trigger is still aria-hidden until it ends.
  fireEvent.click(screen.getByRole('button', { name: 'TVL History options', hidden: true }))
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
})
it('keeps desktop controls inline', () => {
  mobile = false
  render(<ChartOptions />)
  expect(screen.getByRole('checkbox', { name: 'price adjusted' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'TVL History options' })).toBeNull()
})
