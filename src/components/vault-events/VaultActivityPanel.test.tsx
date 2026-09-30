import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mapKongSnapshotToVaultExtended } from '@/lib/kong-vault-derivation'
import { VaultActivityPanel } from './VaultActivityPanel'

vi.mock('./VaultManagementEventsPanel', () => ({
  VaultManagementEventsPanel: () => <div data-testid="management-events">Management events</div>
}))
vi.mock('./VaultEventsPanel', () => ({
  VaultEventsPanel: () => <div data-testid="user-events">User events</div>
}))

const vault = mapKongSnapshotToVaultExtended({
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  apiVersion: '3.0.4'
})

let height = 300
const resizeCallbacks = new Set<() => void>()

beforeEach(() => {
  height = 300
  vi.stubEnv('VITE_PUBLIC_ENVIO_GRAPHQL_URL', 'https://events.example/graphql')
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => height)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: () => void) {}
      observe() {
        resizeCallbacks.add(this.callback)
      }
      disconnect() {
        resizeCallbacks.delete(this.callback)
      }
    }
  )
})
afterEach(() => {
  resizeCallbacks.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Vault activity height', () => {
  it('retains the tallest loaded content through tab changes and later loading states', () => {
    render(<VaultActivityPanel vaultChainId={1} vaultDetails={vault} />)
    const content = screen.getByTestId('management-events').parentElement!
    expect(content.style.minHeight).toBe('300px')

    // Data arrives inside a child without changing the parent panel props.
    height = 1800
    act(() => {
      for (const resize of resizeCallbacks) resize()
    })
    expect(content.style.minHeight).toBe('1800px')

    height = 300
    fireEvent.click(screen.getByRole('tab', { name: 'Historical User Events' }))
    act(() => {
      for (const resize of resizeCallbacks) resize()
    })
    expect(screen.getByTestId('user-events').parentElement?.style.minHeight).toBe('1800px')

    height = 2200
    act(() => {
      for (const resize of resizeCallbacks) resize()
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Vault Management Events' }))
    expect(content.style.minHeight).toBe('2200px')
  })

  it('keeps a constrained viewport and stops observing when the constraint is enabled', () => {
    const view = render(<VaultActivityPanel vaultChainId={1} vaultDetails={vault} />)
    view.rerender(<VaultActivityPanel vaultChainId={1} vaultDetails={vault} maxHeight={600} />)
    const content = screen.getByTestId('vault-activity-scroll')
    expect(content.style.maxHeight).toBe('600px')
    expect(content.style.minHeight).toBe('')
    expect(resizeCallbacks.size).toBe(0)
  })
})
