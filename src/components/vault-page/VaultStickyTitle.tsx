import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type VaultStickyTitleProps = {
  vaultName: string
}

export function VaultStickyTitle({ vaultName }: VaultStickyTitleProps) {
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const updateStickyState = () => {
      const titleSource = document.querySelector<HTMLElement>('[data-vault-title-source]')
      const stickyTop = window.innerWidth >= 768 ? 80 : window.innerWidth >= 500 ? 131 : 75

      setIsStuck(Boolean(titleSource && titleSource.getBoundingClientRect().top <= stickyTop))
    }

    updateStickyState()
    window.addEventListener('scroll', updateStickyState, { passive: true })
    window.addEventListener('resize', updateStickyState)

    return () => {
      window.removeEventListener('scroll', updateStickyState)
      window.removeEventListener('resize', updateStickyState)
    }
  }, [])

  return (
    <div
      className="pointer-events-none sticky top-[75px] z-[19] h-0 overflow-visible min-[500px]:top-[131px] md:top-[80px]"
      data-stuck={String(isStuck)}
      data-testid="vault-sticky-title"
    >
      <div
        aria-hidden={!isStuck}
        className={cn(
          'flex h-14 min-w-0 items-center bg-white px-4 transition-opacity duration-150 ease-out sm:px-6',
          isStuck ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div
          className="min-w-0 truncate text-xl font-bold tracking-[-0.02em] text-[#111] sm:text-2xl"
          title={vaultName}
        >
          {vaultName}
        </div>
      </div>
    </div>
  )
}
