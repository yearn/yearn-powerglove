import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import { defaultVaultFilters } from '@/hooks/useVaultFiltering'
import { VaultsFilterBar } from './VaultsFilterBar'

function Harness() {
  const [filters, setFilters] = useState(defaultVaultFilters)
  const [search, setSearch] = useState('')
  return (
    <VaultsFilterBar
      filters={filters}
      onFiltersChange={setFilters}
      versions={['3.0.4', '0.3.0']}
      searchTerm={search}
      onSearchChange={setSearch}
    />
  )
}

afterEach(cleanup)

it('retains filters and search when closing and reopening the filter row', () => {
  render(<Harness />)
  expect(screen.queryByRole('button', { name: 'Modal' })).toBeNull()
  fireEvent.change(screen.getByRole('textbox', { name: 'Filter vaults or tokens' }), { target: { value: 'DAI' } })
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
  fireEvent.click(screen.getByRole('button', { name: 'API versions' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '3.0.4' }))
  fireEvent.keyDown(screen.getByRole('checkbox', { name: '3.0.4' }), { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
  expect(screen.getByRole('button', { name: 'Clear API versions: 3.0.4' })).toBeTruthy()
  expect((screen.getByRole('textbox', { name: 'Filter vaults or tokens' }) as HTMLInputElement).value).toBe('DAI')
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
  expect(screen.queryByLabelText('Active vault filters')).toBeNull()
})

it('toggles retired visibility in the filter row', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
  expect(screen.getByRole('button', { name: /^Filters/ }).className).toContain('outline-[#0657f9]')
  fireEvent.click(screen.getByRole('button', { name: 'Show retired vaults' }))
  expect(screen.getByRole('button', { name: 'Hide retired vaults' }).getAttribute('aria-pressed')).toBe('true')
})

it('replaces TVL presets with custom bounds and validates them', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
  fireEvent.click(screen.getByRole('button', { name: 'TVL (USD)' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '$100K – $1M' }))
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum TVL (USD)' }), { target: { value: '123456' } })
  expect((screen.getByRole('checkbox', { name: '$100K – $1M' }) as HTMLInputElement).checked).toBe(false)
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum TVL (USD)' }), { target: { value: '100' } })
  expect(screen.getByRole('alert').textContent).toContain('minimum no greater than maximum')
})

it('searches a single-column asset list with asset logos', () => {
  render(
    <VaultsFilterBar
      filters={defaultVaultFilters()}
      onFiltersChange={() => {}}
      assets={['USDC', 'WETH']}
      assetIcons={{ USDC: '/usdc.svg', WETH: '/weth.svg' }}
      versions={[]}
      searchTerm=""
      onSearchChange={() => {}}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Assets' }))
  const asset = screen.getByRole('checkbox', { name: 'USDC' })
  expect(asset.closest('fieldset')?.querySelector('.grid-cols-1')).toBeTruthy()
  expect(asset.closest('label')?.querySelector('img')?.getAttribute('src')).toBe('/usdc.svg')
  fireEvent.change(screen.getByRole('textbox', { name: 'Search assets' }), { target: { value: 'usdc' } })
  expect(screen.queryByRole('checkbox', { name: 'WETH' })).toBeNull()
  expect(screen.getByRole('checkbox', { name: 'USDC' })).toBeTruthy()
  fireEvent.change(screen.getByRole('textbox', { name: 'Search assets' }), { target: { value: 'unknown asset' } })
  expect(screen.getByText('No assets found.')).toBeTruthy()
})

it('uses vault row placeholders for missing and broken asset logos', () => {
  render(
    <VaultsFilterBar
      filters={defaultVaultFilters()}
      onFiltersChange={() => {}}
      assets={['USDC', 'WETH']}
      assetIcons={{ USDC: '/broken.svg' }}
      versions={[]}
      searchTerm=""
      onSearchChange={() => {}}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Assets' }))
  const missing = screen.getByRole('checkbox', { name: 'WETH' }).closest('label') as HTMLElement
  expect(within(missing).getByText('WE').className).toContain('rounded-full')
  const broken = screen.getByRole('checkbox', { name: 'USDC' }).closest('label') as HTMLElement
  fireEvent.error(broken.querySelector('img') as HTMLImageElement)
  expect(broken.querySelector('img')).toBeNull()
  expect(within(broken).getByText('US').className).toContain('bg-gray-200')
})
