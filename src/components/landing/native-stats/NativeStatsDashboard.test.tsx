import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { type ReactNode, useContext, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NativeStatsDashboard } from './NativeStatsDashboard'
import { StatsContext } from './StatsContext'
import type { StatsTab } from './stats-navigation'

vi.mock('./hooks', () => ({ HAS_TVL_API: true, HAS_FEES_API: true }))
vi.mock('./StatsChainSelector', () => ({
  StatsChainSelector: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => (
    <select aria-label="Chain" value={value} onChange={(event) => onValueChange(event.target.value)}>
      <option value="all">All Chains</option>
      <option value="1">Ethereum</option>
    </select>
  )
}))
vi.mock('./TvlOverview', () => ({
  TvlOverview: ({ chainSelector }: { chainSelector: ReactNode }) => <div>TVL overview data{chainSelector}</div>
}))
vi.mock('./FeesPanel', () => ({
  FeesPanel: ({ chainSelector }: { chainSelector: ReactNode }) => <div>Fee chart data{chainSelector}</div>
}))
vi.mock('./AuditPanel', () => ({
  AuditPanel: () => <div>Vault breakdown data · {useContext(StatsContext).chainFilter}</div>
}))
vi.mock('./CurationProductsPanel', () => ({
  CurationProductsPanel: () => <div>Curation product data · {useContext(StatsContext).chainFilter}</div>
}))
vi.mock('./ComparisonPanel', () => ({
  ComparisonPanel: () => <div>Comparison data · {useContext(StatsContext).chainFilter}</div>
}))

function Dashboard({ initialTab = 'overview' }: { initialTab?: StatsTab }) {
  const [tab, setTab] = useState<StatsTab>(initialTab)
  return <NativeStatsDashboard tab={tab} onTabChange={setTab} />
}

afterEach(cleanup)

describe('consolidated stats tabs', () => {
  it('puts vault breakdown on TVL and mounts its data only when expanded', () => {
    render(<Dashboard />)
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['TVL', 'Fees', 'Other Analysis'])
    expect(screen.getByText('TVL overview data')).toBeTruthy()
    const trigger = screen.getByRole('button', { name: 'Vault breakdown' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/Vault breakdown data/)).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: 'Chain' }), { target: { value: '1' } })
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Vault breakdown data · 1')).toBeTruthy()
    fireEvent.click(trigger)
    expect(screen.queryByText(/Vault breakdown data/)).toBeNull()
  })

  it('keeps each Other Analysis section collapsed and lets them open independently', () => {
    render(<Dashboard initialTab="analysis" />)
    const curation = screen.getByRole('button', { name: 'Curation Products' })
    const comparison = screen.getByRole('button', { name: 'Comparison' })
    expect(curation.getAttribute('aria-expanded')).toBe('false')
    expect(comparison.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/Curation product data/)).toBeNull()
    expect(screen.queryByText(/Comparison data/)).toBeNull()
    fireEvent.click(curation)
    expect(screen.getByText('Curation product data · all')).toBeTruthy()
    expect(screen.queryByText(/Comparison data/)).toBeNull()
    fireEvent.click(comparison)
    fireEvent.change(screen.getByRole('combobox', { name: 'Chain' }), { target: { value: '1' } })
    expect(screen.getByText('Curation product data · 1')).toBeTruthy()
    expect(screen.getByText('Comparison data · 1')).toBeTruthy()
    fireEvent.click(curation)
    expect(screen.queryByText(/Curation product data/)).toBeNull()
    expect(screen.getByText('Comparison data · 1')).toBeTruthy()
  })

  it('retains the shared chain selection across the three tabs', () => {
    render(<Dashboard />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Chain' }), { target: { value: '1' } })
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Other Analysis' }), { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByRole('button', { name: 'Comparison' }))
    expect(screen.getByText('Comparison data · 1')).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Fees' }), { button: 0, ctrlKey: false })
    expect(screen.getByText('Fee chart data')).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Chain' }) as HTMLSelectElement).value).toBe('1')
  })
})
