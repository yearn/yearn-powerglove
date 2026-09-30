import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export type VaultReportSectionLink = {
  id: string
  label: string
}

export const getVaultReportSectionId = (prefix: string, sectionId: string) => `${prefix}-${sectionId}`

type VaultReportNavigationProps = {
  ariaLabel: string
  prefix: string
  sections: readonly VaultReportSectionLink[]
}

export function VaultReportNavigation({ ariaLabel, prefix, sections }: VaultReportNavigationProps) {
  const navigationRef = useRef<HTMLElement | null>(null)
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? '')

  const scrollToSection = useCallback(
    (sectionId: string, behavior: ScrollBehavior) => {
      const target = document.getElementById(getVaultReportSectionId(prefix, sectionId))
      if (!target) return

      const navigation = navigationRef.current
      const stickyTop = navigation ? Number.parseFloat(window.getComputedStyle(navigation).top) || 0 : 0
      const navigationOffset = stickyTop + (navigation?.offsetHeight ?? 0) + 8
      const targetTop = target.getBoundingClientRect().top + window.scrollY - navigationOffset

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior
      })
    },
    [prefix]
  )

  const scheduleSectionScroll = useCallback(
    (sectionId: string, behavior: ScrollBehavior) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToSection(sectionId, behavior))
      })
    },
    [scrollToSection]
  )

  useEffect(() => {
    const requestedSection = sections.find(
      ({ id }) => window.location.hash === `#${getVaultReportSectionId(prefix, id)}`
    )
    if (!requestedSection) return

    setActiveSection(requestedSection.id)
    scheduleSectionScroll(requestedSection.id, 'auto')
  }, [prefix, scheduleSectionScroll, sections])

  useEffect(() => {
    let animationFrame = 0

    const updateActiveSection = () => {
      animationFrame = 0
      const navigation = navigationRef.current
      const stickyTop = navigation ? Number.parseFloat(window.getComputedStyle(navigation).top) || 0 : 0
      const threshold = stickyTop + (navigation?.offsetHeight ?? 0) + 16
      let nextSection = sections[0]?.id ?? ''

      for (const link of sections) {
        const section = document.getElementById(getVaultReportSectionId(prefix, link.id))
        if (section && section.getBoundingClientRect().top <= threshold) {
          nextSection = link.id
        }
      }

      setActiveSection((current) => (current === nextSection ? current : nextSection))
    }

    const scheduleUpdate = () => {
      if (animationFrame) return
      animationFrame = window.requestAnimationFrame(updateActiveSection)
    }

    updateActiveSection()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
    }
  }, [prefix, sections])

  return (
    <nav
      ref={navigationRef}
      aria-label={ariaLabel}
      className="sticky top-[131px] z-[18] overflow-x-auto bg-white min-[500px]:top-[187px] md:top-[136px]"
      data-testid="vault-report-navigation"
    >
      <div className="flex min-w-max items-end border-b border-[#d8d8d8]">
        {sections.map((link) => (
          <a
            key={link.id}
            href={`#${getVaultReportSectionId(prefix, link.id)}`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setActiveSection(link.id)
              window.history.replaceState(window.history.state, '', `#${getVaultReportSectionId(prefix, link.id)}`)
              const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
              scheduleSectionScroll(link.id, behavior)
            }}
            aria-current={activeSection === link.id ? 'location' : undefined}
            className={cn(
              'relative -mb-px -mr-px border border-t-2 border-[#dedede] px-4 py-3 text-sm transition-colors last:mr-0 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0657f9]',
              activeSection === link.id
                ? 'z-10 border-b-white border-t-[#0657f9] bg-white font-medium text-black'
                : 'border-t-[#dedede] bg-[#fafafa] text-[#808080] hover:bg-white hover:text-[#4f4f4f]'
            )}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
