import { type ReactNode, useLayoutEffect, useMemo, useRef } from 'react'
import { MainInfoPanel } from '@/components/main-info-panel'
import { isEnvioConfigured } from '@/lib/envio-client'
import type { MainInfoPanelProps } from '@/types/dataTypes'
import { getVaultReportSectionId, VaultReportNavigation } from './VaultReportNavigation'
import { VaultStickyTitle } from './VaultStickyTitle'

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'activity', label: 'Vault activity' }
] as const

type StandardVaultPageProps = {
  mainInfo: MainInfoPanelProps
  showAction: boolean
  charts: ReactNode
  strategies: ReactNode
  vaultActivity: ReactNode
}

export function StandardVaultPage({ mainInfo, showAction, charts, strategies, vaultActivity }: StandardVaultPageProps) {
  const pageRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const page = pageRef.current
    const header = document.querySelector('header')
    if (!page || !header) return
    const updateHeaderHeight = () => {
      page.style.setProperty('--vault-header-height', `${header.getBoundingClientRect().height}px`)
    }
    updateHeaderHeight()
    const observer = new ResizeObserver(updateHeaderHeight)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  const hasActivity = isEnvioConfigured()
  const visibleSections = useMemo(
    () => sections.filter((section) => section.id !== 'activity' || hasActivity),
    [hasActivity]
  )
  const content = { performance: charts, strategies, activity: vaultActivity }
  return (
    <div ref={pageRef} className="vault-ledger bg-[#f3f3f1] pb-10 text-[#151515]" data-testid="standard-vault-page">
      <VaultStickyTitle vaultName={mainInfo.vaultName} />
      <section id={getVaultReportSectionId('vault', 'overview')} className="scroll-mt-28 bg-white">
        <MainInfoPanel {...mainInfo} showAction={showAction} />
      </section>
      <VaultReportNavigation ariaLabel="Vault report sections" prefix="vault" sections={visibleSections} />
      {visibleSections
        .filter((section) => section.id !== 'overview')
        .map((section) => (
          <section
            key={section.id}
            id={getVaultReportSectionId('vault', section.id)}
            className="scroll-mt-28 border-x border-b border-[#d8d8d8] bg-white"
          >
            <div className="px-4 pb-2 pt-12 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold tracking-[-0.025em] text-[#111] sm:text-3xl">{section.label}</h2>
            </div>
            {content[section.id]}
          </section>
        ))}
    </div>
  )
}
