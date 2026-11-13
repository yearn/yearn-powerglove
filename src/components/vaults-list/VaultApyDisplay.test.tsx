import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DesktopApyValue } from '@/components/vaults-list/VaultRow'
import { VaultsTableHeader } from '@/components/vaults-list/VaultsTableHeader'

describe('vault overview APY display', () => {
  it('places Est. APY immediately before 30D APY', () => {
    const { container } = render(<VaultsTableHeader sortColumn="tvl" sortDirection="desc" onSort={vi.fn()} />)
    const labels = [...container.querySelectorAll('button span')].map((element) => element.textContent)

    expect(labels).toEqual(['Vault', 'Est. APY', '30D APY', 'TVL', 'Asset', 'Chain', 'Type'])
  })

  it('opens descriptor filters without sorting', () => {
    const onSort = vi.fn()
    const onFilter = vi.fn()
    render(<VaultsTableHeader sortColumn="tvl" sortDirection="desc" onSort={onSort} onFilter={onFilter} />)
    for (const label of ['Asset', 'Chain', 'Type'])
      fireEvent.click(screen.getByRole('button', { name: `Filter by ${label}` }))
    expect(onFilter.mock.calls).toEqual([['assets'], ['chains'], ['types']])
    expect(onSort).not.toHaveBeenCalled()
  })

  it('exposes the estimate processing source on focus', async () => {
    const { container } = render(
      <div className="overflow-hidden">
        <DesktopApyValue metric={{ display: '5.00%', tooltipItems: [{ label: 'Processing', value: 'est-crv' }] }} />
      </div>
    )

    fireEvent.focus(screen.getByText('5.00%'))

    const processingLabel = (await screen.findAllByText('Processing'))[0]
    expect(processingLabel).toBeTruthy()
    expect(screen.getAllByText('est-crv').length).toBeGreaterThan(0)
    expect(container.contains(processingLabel)).toBe(false)
  })
})
