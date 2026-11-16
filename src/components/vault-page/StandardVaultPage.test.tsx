import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MainInfoPanelProps } from '@/types/dataTypes'
import { StandardVaultPage } from './StandardVaultPage'

const viewport = vi.hoisted(() => ({ mobile: false }))
vi.mock('@/components/ui/use-mobile', () => ({ useIsMobile: () => viewport.mobile }))

const mainInfo: MainInfoPanelProps = {
  vaultId: 'test',
  deploymentDate: '2025-01-01',
  vaultName: 'Test vault',
  vaultAddress: '0x1111111111111111111111111111111111111111',
  description: 'Vault description',
  vaultToken: { icon: '', name: 'USDC' },
  totalSupply: '$1M',
  network: { icon: '', name: 'Ethereum' },
  oneDayAPY: { display: '1%' },
  sevenDayAPY: { display: '2%' },
  thirtyDayAPY: { display: '3%' },
  managementFee: '0%',
  performanceFee: '10%',
  apiVersion: '3.0.4'
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  viewport.mobile = false
  window.history.replaceState({}, '', '/')
})

describe('Vault report activity availability', () => {
  it.each(['', '   '])('omits the activity heading, shell and navigation when Envio is unset (%j)', (env) => {
    vi.stubEnv('VITE_PUBLIC_ENVIO_GRAPHQL_URL', env)
    const { container } = render(
      <StandardVaultPage
        showAction
        mainInfo={mainInfo}
        charts={<p>Charts</p>}
        strategies={<p>Allocations</p>}
        vaultActivity={null}
      />
    )
    expect(screen.queryByRole('heading', { name: 'Vault activity' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Vault activity' })).toBeNull()
    expect(container.querySelector('#vault-activity')).toBeNull()
    expect(screen.getByText('Vault description')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Performance' })).toBeTruthy()
    expect(screen.getByText('Allocations')).toBeTruthy()
  })

  it('keeps the activity navigation and content when Envio is configured', () => {
    vi.stubEnv('VITE_PUBLIC_ENVIO_GRAPHQL_URL', 'https://events.example/graphql')
    render(
      <StandardVaultPage
        showAction
        mainInfo={mainInfo}
        charts={null}
        strategies={null}
        vaultActivity={<p>Recorded activity</p>}
      />
    )
    expect(screen.getByRole('heading', { name: 'Vault activity' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Vault activity' }).getAttribute('href')).toBe('#vault-activity')
    expect(screen.getByText('Recorded activity')).toBeTruthy()
  })
})

it('opens mobile sections in a drawer while preserving the overview', async () => {
  viewport.mobile = true
  vi.stubEnv('VITE_PUBLIC_ENVIO_GRAPHQL_URL', 'https://events.example/graphql')
  render(
    <StandardVaultPage
      mainInfo={mainInfo}
      showAction
      charts={<p>Charts</p>}
      strategies={<p>Allocations</p>}
      vaultActivity={<p>Recorded activity</p>}
    />
  )
  for (const name of ['Performance', 'Strategies', 'Vault activity']) {
    expect(screen.getByRole('button', { name }).getAttribute('aria-expanded')).toBe('false')
  }
  expect(screen.getByText('Vault description')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Performance' }))
  expect(await screen.findByRole('dialog')).toBeTruthy()
  expect(screen.getByText('Charts')).toBeTruthy()
  const drawer = within(screen.getByRole('dialog'))
  expect(drawer.getByRole('button', { name: 'Vault activity' })).toBeTruthy()
  fireEvent.click(drawer.getByRole('button', { name: 'Strategies' }))
  expect(drawer.getByRole('button', { name: 'Performance' })).toBeTruthy()
  expect(drawer.getByRole('button', { name: 'Vault activity' })).toBeTruthy()
  expect(screen.getByText('Allocations')).toBeTruthy()
})

it('opens a directly linked section on mobile', () => {
  viewport.mobile = true
  window.history.replaceState({}, '', '/#vault-strategies')
  render(
    <StandardVaultPage
      mainInfo={mainInfo}
      showAction
      charts={null}
      strategies={<p>Allocations</p>}
      vaultActivity={null}
    />
  )
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.getByText('Allocations')).toBeTruthy()
})

it('supports comparing downward sections with drawers on mobile', () => {
  viewport.mobile = true
  render(
    <StandardVaultPage
      mainInfo={mainInfo}
      showAction
      charts={<p>Charts</p>}
      strategies={<p>Allocations</p>}
      vaultActivity={null}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Expand down' }))
  fireEvent.click(screen.getByRole('button', { name: 'Performance' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByText('Charts')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Strategies' }))
  expect(screen.queryByText('Charts')).toBeNull()
  expect(screen.getByText('Allocations')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Drawers' }))
  fireEvent.click(screen.getByRole('button', { name: 'Performance' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
})
