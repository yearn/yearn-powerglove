import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Link, useRouterState } from '@tanstack/react-router'
import { ExternalLink, Menu, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { VaultFinder } from '@/components/VaultFinder'

const headerNavLinkClassName =
  'rounded-none border-b-2 border-transparent px-3 pt-3.5 pb-2.5 text-sm transition-colors hover:text-foreground'

export default function Header() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const mobileMenuId = useId()
  const navigation = [
    {
      to: '/' as const,
      label: 'Stats',
      active: pathname === '/' || pathname === '/stats' || pathname.startsWith('/stats/')
    },
    { to: '/vaults' as const, label: 'Vaults', active: pathname === '/vaults' || pathname.startsWith('/vaults/') }
  ]

  useEffect(() => {
    const desktopHeaderQuery = window.matchMedia('(min-width: 500px)')
    const closeMobileMenu = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMobileMenuOpen(false)
    }
    desktopHeaderQuery.addEventListener('change', closeMobileMenu)
    return () => desktopHeaderQuery.removeEventListener('change', closeMobileMenu)
  }, [])

  const partnerButton = (
    <a href="https://partners.yearn.fi" target="_blank" rel="noopener noreferrer" className="shrink-0">
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2 rounded-none border-[#0657f9] px-3 text-xs text-[#0657f9] sm:text-sm"
      >
        Partner with us
        <ExternalLink className="h-4 w-4" />
      </Button>
    </a>
  )

  return (
    <header className="sticky top-0 z-40 bg-[#f5f5f5]">
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-x border-b border-border bg-white px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link to="/" className="flex min-w-0 cursor-pointer items-center gap-2">
            <span
              aria-hidden="true"
              className="h-6 w-6 shrink-0 bg-[#0657f9] [mask-image:url('/yearn-link-icon.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
            />
            <span className="sr-only">Yearn</span>
            <span className="text-base font-bold text-[#0657f9] sm:text-lg">Yearn PowerGlove</span>
          </Link>
          <nav className="hidden items-center gap-1 min-[500px]:flex" aria-label="Primary">
            {navigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === '/', includeSearch: false }}
                aria-current={item.active ? 'page' : undefined}
                className={`${headerNavLinkClassName} ${item.active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <VaultFinder onOpen={() => setIsMobileMenuOpen(false)} />
          <div className="hidden min-[500px]:block">{partnerButton}</div>
          <div className="min-[500px]:hidden">
            <DialogPrimitive.Root open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} modal={false}>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-none text-[#0657f9] hover:bg-[#eef4ff] hover:text-[#0657f9]"
                aria-controls={mobileMenuId}
                aria-expanded={isMobileMenuOpen}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <DialogPrimitive.Portal>
                <div aria-hidden="true" className="fixed inset-0 z-30 bg-white" data-testid="mobile-menu-overlay" />
                <DialogPrimitive.Content
                  id={mobileMenuId}
                  className="pointer-events-none fixed inset-0 z-50 min-[500px]:hidden"
                  data-testid="mobile-menu-dialog"
                  onOpenAutoFocus={(event) => event.preventDefault()}
                >
                  <DialogPrimitive.Title className="sr-only">Navigation menu</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">
                    Site navigation and resource links
                  </DialogPrimitive.Description>
                  <div className="pointer-events-auto absolute inset-x-0 bottom-0 top-14 overflow-y-auto bg-white">
                    <div
                      className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-3 px-4 pt-3 pb-6"
                      data-testid="mobile-menu-content"
                    >
                      <nav className="flex flex-col" aria-label="Mobile primary">
                        {navigation.map((item) => (
                          <DialogPrimitive.Close key={item.to} asChild>
                            <Link
                              to={item.to}
                              activeOptions={{ exact: item.to === '/', includeSearch: false }}
                              aria-current={item.active ? 'page' : undefined}
                              className={`py-3 text-sm hover:text-foreground ${item.active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}
                            >
                              {item.label}
                            </Link>
                          </DialogPrimitive.Close>
                        ))}
                      </nav>

                      <nav
                        className="flex flex-col gap-4 border-t border-border pt-6 text-sm"
                        aria-label="Mobile secondary"
                      >
                        <DialogPrimitive.Close asChild>
                          <Link to="/about" className="text-gray-500 hover:text-gray-700">
                            About Yearn
                          </Link>
                        </DialogPrimitive.Close>
                        <DialogPrimitive.Close asChild>
                          <Link to="/privacy" className="text-gray-500 hover:text-gray-700">
                            Privacy Policy
                          </Link>
                        </DialogPrimitive.Close>
                        <DialogPrimitive.Close asChild>
                          <Link to="/disclaimer" className="text-gray-500 hover:text-gray-700">
                            Disclaimer
                          </Link>
                        </DialogPrimitive.Close>
                      </nav>

                      <nav
                        className="flex flex-col gap-4 border-t border-border pt-6 text-sm"
                        aria-label="Mobile external resources"
                      >
                        <DialogPrimitive.Close asChild>
                          <a
                            href="https://docs.yearn.fi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
                          >
                            Docs
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </DialogPrimitive.Close>
                        <DialogPrimitive.Close asChild>
                          <a
                            href="https://x.com/yearnfi/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
                          >
                            X
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </DialogPrimitive.Close>
                        <DialogPrimitive.Close asChild>
                          <a
                            href="https://yearn.fi"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
                          >
                            Yearn.fi
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </DialogPrimitive.Close>
                        <DialogPrimitive.Close asChild>
                          <a
                            href="https://github.com/yearn"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
                          >
                            GitHub
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </DialogPrimitive.Close>
                      </nav>

                      <DialogPrimitive.Close asChild>
                        <a
                          href="https://partners.yearn.fi"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-auto flex items-center justify-between border border-[#0657f9] px-3 py-2.5 text-sm font-medium text-[#0657f9]"
                        >
                          Partner with us
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </DialogPrimitive.Close>
                    </div>
                  </div>
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          </div>
        </div>
      </div>
    </header>
  )
}
