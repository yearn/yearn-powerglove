import { ChevronDown, ChevronUp } from 'lucide-react'
import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MainInfoPanel, VaultIdentity } from '@/components/main-info-panel'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { useIsMobile } from '@/components/ui/use-mobile'
import { isEnvioConfigured } from '@/lib/envio-client'
import type { MainInfoPanelProps } from '@/types/dataTypes'
import { PerformanceControlsContext } from './PerformanceControlsContext'
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
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(() => {
    const hash = window.location.hash.replace('#vault-', '')
    return sections.some((section) => section.id !== 'overview' && section.id === hash) ? hash : ''
  })
  const [performanceControls, setPerformanceControls] = useState<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const drawerIdentityRef = useRef<HTMLDivElement>(null)
  const [drawerTop, setDrawerTop] = useState(140)
  useLayoutEffect(() => {
    const page = pageRef.current
    const header = document.querySelector('header')
    if (!page || !header) return
    const updateHeaderHeight = () => {
      const headerHeight = header.getBoundingClientRect().height
      page.style.setProperty('--vault-header-height', `${headerHeight}px`)
      if (isMobile && drawerIdentityRef.current) setDrawerTop(headerHeight + drawerIdentityRef.current.offsetHeight)
    }
    updateHeaderHeight()
    const observer = new ResizeObserver(updateHeaderHeight)
    observer.observe(header)
    if (drawerIdentityRef.current) observer.observe(drawerIdentityRef.current)
    return () => observer.disconnect()
  }, [isMobile])
  const hasActivity = isEnvioConfigured()
  const visibleSections = useMemo(
    () => sections.filter((section) => section.id !== 'activity' || hasActivity),
    [hasActivity]
  )
  const content = { performance: charts, strategies, activity: vaultActivity }
  if (isMobile) {
    const mobileSections = visibleSections.filter((section) => section.id !== 'overview')
    const activeSection = visibleSections.find((section) => section.id === expanded)
    const changeSection = (value: string) => {
      setExpanded(value)
      window.history.replaceState(
        { ...window.history.state, __hashScrollIntoViewOptions: false },
        '',
        value ? `#vault-${value}` : `${window.location.pathname}${window.location.search}`
      )
    }
    return (
      <div
        ref={pageRef}
        className="vault-ledger fixed inset-x-0 bottom-0 top-[var(--vault-header-height,55px)] flex flex-col bg-white text-[#151515]"
        data-testid="standard-vault-page"
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div ref={drawerIdentityRef} className="px-4 pt-2 pb-3">
            <VaultIdentity data={mainInfo} />
          </div>
          <section id={getVaultReportSectionId('vault', 'overview')}>
            <MainInfoPanel {...mainInfo} showAction={showAction} showIdentity={false} />
          </section>
        </div>
        <div className="shrink-0 border-x border-b border-border pb-[env(safe-area-inset-bottom)]">
          {visibleSections
            .filter((section) => section.id !== 'overview')
            .map((section) => (
              <button
                key={section.id}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={expanded === section.id}
                onClick={() => changeSection(section.id)}
                className="flex w-full items-center justify-between border-t border-border px-4 py-3 text-left text-base font-medium"
              >
                {section.label}
                <ChevronUp aria-hidden="true" className="h-4 w-4" />
              </button>
            ))}
        </div>
        <Drawer
          open={Boolean(activeSection)}
          onOpenChange={(open) => {
            if (!open) changeSection('')
          }}
          shouldScaleBackground={false}
        >
          <DrawerContent
            showHandle={false}
            overlayClassName="bg-transparent"
            style={{ height: `calc(100dvh - ${drawerTop}px)`, maxHeight: `calc(100dvh - ${drawerTop}px)` }}
            className="mt-0 rounded-none border border-border bg-white shadow-none"
          >
            <div className="shrink-0">
              {mobileSections
                .slice(
                  0,
                  Math.max(
                    0,
                    mobileSections.findIndex((section) => section.id === expanded)
                  )
                )
                .map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => changeSection(section.id)}
                    className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left text-base font-medium"
                  >
                    {section.label}
                    <ChevronUp aria-hidden="true" className="h-4 w-4" />
                  </button>
                ))}
            </div>
            <DrawerHeader className="relative flex shrink-0 items-center gap-3 pl-4 pr-10 py-3 text-left">
              <div className="pointer-events-none min-w-0 flex-1">
                <DrawerTitle className="text-base font-medium leading-6 tracking-normal">
                  {activeSection?.label}
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                  {mainInfo.vaultName} {activeSection?.label}
                </DrawerDescription>
              </div>
              {expanded === 'performance' ? <div ref={setPerformanceControls} className="relative z-10" /> : null}
              <DrawerClose aria-label="Close" className="absolute inset-0 flex w-full items-center justify-end px-4">
                <ChevronDown aria-hidden="true" className="h-4 w-4" />
              </DrawerClose>
            </DrawerHeader>
            <div className={`min-h-0 flex-1 ${expanded === 'performance' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
              <PerformanceControlsContext.Provider value={performanceControls}>
                {expanded === 'performance'
                  ? charts
                  : expanded === 'strategies'
                    ? strategies
                    : expanded === 'activity'
                      ? vaultActivity
                      : null}
              </PerformanceControlsContext.Provider>
            </div>
            <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">
              {mobileSections
                .slice(mobileSections.findIndex((section) => section.id === expanded) + 1)
                .map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => changeSection(section.id)}
                    className="flex w-full items-center justify-between border-t border-border px-4 py-3 text-left text-base font-medium"
                  >
                    {section.label}
                    <ChevronUp aria-hidden="true" className="h-4 w-4" />
                  </button>
                ))}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    )
  }

  return (
    <div ref={pageRef} className="vault-ledger bg-white text-[#151515]" data-testid="standard-vault-page">
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
            className="scroll-mt-28 border-x border-b border-[#d8d8d8] bg-white last:border-b-0"
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
