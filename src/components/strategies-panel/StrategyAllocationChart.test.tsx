import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StrategyAllocationChartDatum } from '@/types/dataTypes'
import { StrategyAllocationChart } from './StrategyAllocationChart'

describe('StrategyAllocationChart', () => {
  it('renders a single allocation chart without a legend', () => {
    const allocationData: StrategyAllocationChartDatum[] = [
      {
        id: '1',
        name: 'Alpha Strategy',
        value: 60,
        amount: '$600'
      },
      {
        id: 'unallocated',
        name: 'Unallocated',
        value: 40,
        amount: '$400'
      }
    ]

    render(<StrategyAllocationChart allocationData={allocationData} />)

    expect(screen.getByTestId('strategy-allocation-chart')).toBeTruthy()
    expect(screen.getAllByText('allocation %')).toHaveLength(2)
    expect(screen.queryByText('Alpha Strategy')).toBeNull()
    expect(screen.queryByText('Unallocated')).toBeNull()
  })

  it('renders when only the unallocated slice is present', () => {
    render(
      <StrategyAllocationChart
        allocationData={[
          {
            id: 'unallocated',
            name: 'Unallocated',
            value: 100,
            amount: '$500'
          }
        ]}
      />
    )

    expect(screen.getByTestId('strategy-allocation-chart')).toBeTruthy()
    expect(screen.queryByText('Unallocated')).toBeNull()
  })
})
