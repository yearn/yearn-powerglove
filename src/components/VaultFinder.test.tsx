import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VaultFinder } from './VaultFinder'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
const address = '0x0000000000000000000000000000000000000001'
const vaults = [
  { name: 'USDC Vault', address, chainId: 1, apiVersion: '3.0.4', asset: { symbol: 'USDC' } },
  { name: 'USDC Vault', address, chainId: 8453, apiVersion: '3.0.2', asset: { symbol: 'USDC' } }
]
let loading = false
let error: Error | null = null
let emptyCatalog = false
vi.mock('@/contexts/useVaults', () => ({
  useVaults: () => ({ vaults: emptyCatalog ? [] : vaults, loading, error })
}))

const originalScrollIntoView = Element.prototype.scrollIntoView
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  )
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  Element.prototype.scrollIntoView = originalScrollIntoView
  navigate.mockReset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  loading = false
  error = null
  emptyCatalog = false
})

describe('global vault finder', () => {
  it('distinguishes the same address on different chains and navigates with the keyboard', async () => {
    render(<VaultFinder />)
    fireEvent.click(screen.getByRole('button', { name: 'Find a vault' }))
    const input = screen.getByRole('combobox', { name: 'Search all vaults' })
    await waitFor(() => expect(document.activeElement).toBe(input))
    fireEvent.change(input, { target: { value: 'usdc' } })
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
    expect(screen.getByRole('option', { name: /Ethereum/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Base/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Ethereum · v3\.0\.4/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Base · v3\.0\.2/ })).toBeTruthy()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigate).toHaveBeenCalledWith({
      to: '/vaults/$chainId/$vaultAddress',
      params: { chainId: '8453', vaultAddress: address }
    })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Find a vault' })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Find a vault' }))
    expect((screen.getByRole('combobox', { name: 'Search all vaults' }) as HTMLInputElement).value).toBe('')
  })

  it('shows no matches without navigating and returns focus when dismissed', async () => {
    render(<VaultFinder />)
    const trigger = screen.getByRole('button', { name: 'Find a vault' })
    fireEvent.click(trigger)
    const input = screen.getByRole('combobox', { name: 'Search all vaults' })
    fireEvent.change(input, { target: { value: 'not-a-vault' } })
    expect(screen.getByText('No matching vaults.')).toBeTruthy()
    expect(navigate).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('distinguishes loading from an unavailable catalog', () => {
    emptyCatalog = true
    loading = true
    const view = render(<VaultFinder />)
    fireEvent.click(screen.getByRole('button', { name: 'Find a vault' }))
    expect(screen.getByText('Loading vaults…')).toBeTruthy()
    expect(screen.queryByText('No matching vaults.')).toBeNull()
    loading = false
    error = new Error('Unavailable')
    view.rerender(<VaultFinder />)
    expect(screen.getByText('Vault search is unavailable.')).toBeTruthy()
  })
})
