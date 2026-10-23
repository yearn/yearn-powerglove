import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { type ReactNode, useContext } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NativeStatsDashboard } from './NativeStatsDashboard'
import { StatsContext } from './StatsContext'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>
}))
vi.mock('./StatsChainSelector', () => ({
  StatsChainSelector: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => (
    <select aria-label="Chain" value={value} onChange={(event) => onValueChange(event.target.value)}>
      <option value="all">All Chains</option>
      <option value="1">Ethereum</option>
    </select>
  )
}))
vi.mock('./SharedStatsChartControls', () => ({
  SharedStatsChartControls: ({ chainSelector }: { chainSelector: ReactNode }) => (
    <div data-testid="shared-controls">{chainSelector}</div>
  )
}))
vi.mock('./TvlOverview', () => ({
  TvlOverview: () => <div>TVL overview data</div>
}))
vi.mock('./FeesPanel', () => ({
  FeesPanel: () => <div>Fee chart data</div>
}))
vi.mock('./FeeYieldAnalysis', () => ({
  FeeYieldAnalysis: () => <div>Fee yield analysis · {useContext(StatsContext).chainFilter}</div>
}))
vi.mock('./AuditPanel', () => ({
  AuditPanel: () => <div>Vault breakdown data · {useContext(StatsContext).chainFilter}</div>
}))
vi.mock('./VaultBreakdown2', () => ({
  VaultBreakdown2: () => <div>Vault origins data · {useContext(StatsContext).chainFilter}</div>
}))
vi.mock('./ComparisonPanel', () => ({
  ComparisonPanel: () => <div>Comparison data · {useContext(StatsContext).chainFilter}</div>
}))

afterEach(cleanup)

describe('stats pages', () => {
  it('shows TVL before fees on one page with shared chain selection and an analysis link at the bottom', () => {
    render(<NativeStatsDashboard />)
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getAllByTestId('shared-controls')).toHaveLength(1)
    expect(screen.getAllByRole('combobox', { name: 'Chain' })).toHaveLength(1)
    const tvl = screen.getByText('TVL overview data')
    const fees = screen.getByText('Fee chart data')
    const link = screen.getByRole('link', { name: 'Other Analysis' })
    expect(tvl.compareDocumentPosition(fees) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(fees.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/stats/analysis')
    expect(screen.queryByRole('button', { name: 'Vault Breakdown' })).toBeNull()
    expect(screen.queryByText(/Fee yield analysis/)).toBeNull()
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Chain' })[0], { target: { value: '1' } })
    expect(
      screen.getAllByRole('combobox', { name: 'Chain' }).every((select) => (select as HTMLSelectElement).value === '1')
    ).toBe(true)
  })

  it('keeps supplementary analysis on its own page and loads collapsed tables only when expanded', () => {
    render(<NativeStatsDashboard analysis />)
    expect(screen.queryByText('TVL overview data')).toBeNull()
    expect(screen.queryByText('Fee chart data')).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to Stats' }).getAttribute('href')).toBe('/')
    expect(screen.getByText('Fee yield analysis · all')).toBeTruthy()
    const sections = ['Vault Breakdown', 'Vault Breakdown 2', 'Compare TVL to DefiLlama']
    for (const name of sections)
      expect(screen.getByRole('button', { name }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/Vault breakdown data/)).toBeNull()
    expect(screen.queryByText(/Vault origins data/)).toBeNull()
    expect(screen.queryByText(/Comparison data/)).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: 'Chain' }), { target: { value: '1' } })
    for (const name of sections) fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.getByText('Vault breakdown data · 1')).toBeTruthy()
    expect(screen.getByText('Vault origins data · 1')).toBeTruthy()
    expect(screen.getByText('Comparison data · 1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Vault Breakdown' }))
    expect(screen.queryByText(/Vault breakdown data/)).toBeNull()
  })
})
