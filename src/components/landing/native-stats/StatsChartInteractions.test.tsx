import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { MobileYAxisTick, StatsTooltipContent, useMobileChartTooltip } from './StatsChartInteractions'

afterEach(cleanup)
function Chart({ mobile = true }: { mobile?: boolean }) {
  const tooltip = useMobileChartTooltip(mobile)
  return (
    <div>
      <button type="button" {...tooltip.chartEvents}>
        Plot
      </button>
      <StatsTooltipContent
        mobile={mobile}
        onClose={tooltip.dismiss}
        active={tooltip.tooltipProps.active ?? true}
        payload={[{ name: 'TVL', value: 100 }]}
      />
    </div>
  )
}
it('dismisses the mobile tooltip and lets a fresh plot tap reopen it', () => {
  render(<Chart />)
  expect(screen.getByText('100')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Close chart tooltip' }))
  expect(screen.queryByText('100')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Plot' }))
  expect(screen.getByText('100')).toBeTruthy()
})
it('keeps desktop tooltip content without a close button', () => {
  render(<Chart mobile={false} />)
  expect(screen.getByText('100')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Close chart tooltip' })).toBeNull()
})
it('gives left and right mobile axis labels white backgrounds within their respective plot edges', () => {
  const { container } = render(
    <svg>
      <MobileYAxisTick x={20} y={30} payload={{ value: 100 }} formatter={(value) => `$${value}`} />
      <MobileYAxisTick right x={200} y={30} payload={{ value: 100 }} formatter={(value) => `$${value}`} />
    </svg>
  )
  const rects = container.querySelectorAll('rect')
  expect([...rects].every((rect) => rect.getAttribute('fill') === 'white')).toBe(true)
  expect(Number(rects[0].getAttribute('x'))).toBeLessThan(20)
  expect(Number(rects[1].getAttribute('x')) + Number(rects[1].getAttribute('width'))).toBe(204)
  expect(container.querySelectorAll('text')[1].getAttribute('text-anchor')).toBe('end')
})
