import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReallocationStrategyTable } from '@/components/reallocation-panel/ReallocationStrategyTable'
import type { ReallocationStrategy } from '@/types/reallocationTypes'

const strategies: ReallocationStrategy[] = [
  {
    strategyKey: 'alpha',
    strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    name: 'Alpha',
    isUnallocated: false,
    currentRatioPct: 40,
    targetRatioPct: 55,
    allocationDeltaPct: 15,
    currentAprPct: null,
    targetAprPct: null,
    aprDeltaPct: null,
    color: '#0657f9'
  }
]

describe('ReallocationStrategyTable', () => {
  it('right-aligns sortable numeric columns and their values', () => {
    render(
      <ReallocationStrategyTable
        strategies={strategies}
        chainId={1}
        beforeLabel="Start state"
        afterLabel="End state"
        showAprColumns={false}
      />
    )

    expect(screen.queryByText(/strategy details/i)).toBeNull()
    expect(screen.getByRole('button', { name: /start state/i }).classList.contains('justify-end')).toBe(true)
    expect(screen.getByRole('button', { name: /end state/i }).classList.contains('justify-end')).toBe(true)
    expect(screen.getByRole('button', { name: /alloc/i }).classList.contains('justify-end')).toBe(true)

    expect(screen.getByText('40.00%').classList.contains('text-right')).toBe(true)
    expect(screen.getByText('55.00%').classList.contains('text-right')).toBe(true)
    expect(screen.getByText('+15.00%').classList.contains('text-right')).toBe(true)
  })
})
