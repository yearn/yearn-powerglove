import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SingleVaultPageContent } from '@/routes/vaults/$chainId/$vaultAddress/index'

vi.mock('@/components/main-info-panel', () => ({
  MainInfoPanel: () => <div data-testid="main-info-panel" />
}))

vi.mock('@/components/charts/charts-panel', () => ({
  ChartsPanel: () => <div data-testid="charts-panel" />
}))

vi.mock('@/components/strategies-panel/index', () => ({
  StrategiesPanel: () => <div data-testid="strategies-panel" />
}))

vi.mock('@/components/vault-events', () => ({
  VaultActivityPanel: () => <div data-testid="vault-activity-panel" />
}))

vi.mock('@/components/vault-page', () => ({
  VaultPageBreadcrumb: ({ vaultName }: { vaultName: string }) => <div>{vaultName}</div>,
  VaultPageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))

describe('SingleVaultPageContent', () => {
  const baseProps = {
    vaultChainId: 1 as const,
    vaultAddress: '0xabc',
    vaultDetails: {
      address: '0xabc',
      name: 'Test Vault'
    } as any,
    vaultSnapshotTimestampUtc: null,
    isInitialLoading: false,
    hasErrors: false,
    chartsLoading: false,
    chartsError: false,
    overrideConfig: undefined,
    transformedAprApyData: null,
    transformedTvlData: null,
    transformedPpsData: null,
    mainInfoPanelProps: {
      vaultName: 'Test Vault',
      vaultId: 'id',
      deploymentDate: '2025-01-01',
      apiVersion: 'v3',
      description: 'desc',
      yearnVaultLink: '#',
      vaultToken: { icon: '', name: 'TKN' },
      totalSupply: '$0',
      network: { icon: '', name: 'Ethereum' },
      vaultAddress: '0xabc',
      blockExplorerLink: '#',
      oneDayAPY: '1%',
      thirtyDayAPY: '2%',
      managementFee: '0%',
      performanceFee: '0%'
    } as any,
    reallocationData: null
  }

  it('renders only the unavailable notice for blacklisted vaults', () => {
    render(<SingleVaultPageContent {...baseProps} isBlacklisted blacklistReason="Hidden vault" />)

    expect(screen.getByText('Vault Data Unavailable')).toBeTruthy()
    expect(screen.queryByTestId('main-info-panel')).toBeNull()
    expect(screen.queryByTestId('charts-panel')).toBeNull()
    expect(screen.queryByTestId('strategies-panel')).toBeNull()
  })

  it('renders detail panels for non-blacklisted vaults', async () => {
    render(<SingleVaultPageContent {...baseProps} isBlacklisted={false} />)

    expect(screen.getByTestId('main-info-panel')).toBeTruthy()
    expect(await screen.findByTestId('charts-panel')).toBeTruthy()
    expect(screen.getByTestId('strategies-panel')).toBeTruthy()
  })
})
