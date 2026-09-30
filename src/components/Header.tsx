import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Link, useRouterState } from '@tanstack/react-router'
import { ExternalLink, Menu, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useVaults } from '@/contexts/useVaults'

const headerNavLinkClassName =
  'rounded-none border-b-2 border-transparent px-3 pt-3.5 pb-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'

export default function Header() {
  const { vaults } = useVaults()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const desktopSearchRef = useRef<HTMLDivElement>(null)
  const mobileSearchRef = useRef<HTMLDivElement>(null)
  const mobileMenuId = useId()
  const hideMobileSearch = pathname === '/'

  // Filter vaults based on the search term
  const filteredVaults = vaults.filter(
    (vault) =>
      vault.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vault.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!desktopSearchRef.current?.contains(target) && !mobileSearchRef.current?.contains(target)) {
        setIsDropdownOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const desktopHeaderQuery = window.matchMedia('(min-width: 500px)')
    const closeMobileMenu = (event: MediaQueryListEvent) => {
      if (!event.matches) return

      setIsMobileMenuOpen(false)
      setSearchTerm('')
      setIsDropdownOpen(false)
    }

    desktopHeaderQuery.addEventListener('change', closeMobileMenu)
    return () => desktopHeaderQuery.removeEventListener('change', closeMobileMenu)
  }, [])

  const handleMobileMenuOpenChange = (open: boolean) => {
    setIsMobileMenuOpen(open)
    if (open) return

    setSearchTerm('')
    setIsDropdownOpen(false)
  }

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
      <div className="mx-auto flex w-full max-w-[1400px] flex-col border-x border-border bg-white px-4 py-2 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center justify-between gap-3 md:shrink-0 md:justify-start">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <Link to="/" className="flex min-w-0 cursor-pointer items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-6 w-6 shrink-0 bg-[#0657f9] [mask-image:url('/yearn-link-icon.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
                />
                <span className="sr-only">Yearn</span>
                <span className="text-base font-bold text-[#0657f9] sm:text-lg">Yearn PowerGlove</span>
              </Link>

              <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
                <Link
                  to="/"
                  className={headerNavLinkClassName}
                  activeProps={{ className: `${headerNavLinkClassName} border-[#0657f9] text-foreground` }}
                  activeOptions={{ exact: true }}
                >
                  Vault List
                </Link>
              </nav>

              <nav className="hidden items-center gap-1 min-[500px]:flex md:hidden" aria-label="Primary">
                <Link
                  to="/"
                  className={headerNavLinkClassName}
                  activeProps={{ className: `${headerNavLinkClassName} border-[#0657f9] text-foreground` }}
                  activeOptions={{ exact: true }}
                >
                  Vault List
                </Link>
              </nav>
            </div>

            <div className="hidden min-[500px]:block md:hidden">{partnerButton}</div>

            <div className="min-[500px]:hidden">
              <DialogPrimitive.Root open={isMobileMenuOpen} onOpenChange={handleMobileMenuOpenChange} modal={false}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-none text-[#0657f9] hover:bg-[#eef4ff] hover:text-[#0657f9]"
                  aria-controls={mobileMenuId}
                  aria-expanded={isMobileMenuOpen}
                  aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                  onClick={() => handleMobileMenuOpenChange(!isMobileMenuOpen)}
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
                      Site navigation, vault search, and resource links
                    </DialogPrimitive.Description>
                    <div className="pointer-events-auto absolute inset-x-0 bottom-0 top-14 overflow-y-auto bg-white">
                      <div
                        className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-3 px-4 pt-3 pb-6"
                        data-testid="mobile-menu-content"
                      >
                        <div ref={mobileSearchRef} className="relative">
                          <input
                            type="text"
                            aria-label="Search vaults"
                            placeholder="Search vaults..."
                            value={searchTerm}
                            onChange={(event) => {
                              setSearchTerm(event.target.value)
                              setIsDropdownOpen(true)
                            }}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                          />
                          {isDropdownOpen && searchTerm && (
                            <div className="mt-2 max-h-[45vh] overflow-y-auto border border-gray-300 bg-white">
                              {filteredVaults.length > 0 ? (
                                filteredVaults.map((vault) => (
                                  <Link
                                    key={vault.address}
                                    to="/vaults/$chainId/$vaultAddress"
                                    params={{
                                      chainId: vault.chainId.toString(),
                                      vaultAddress: vault.address
                                    }}
                                    className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3 text-sm hover:bg-gray-100"
                                    onClick={() => handleMobileMenuOpenChange(false)}
                                  >
                                    <span className="min-w-0 truncate">{vault.name}</span>
                                    <span className="shrink-0 text-xs text-gray-600">{vault.apiVersion}</span>
                                  </Link>
                                ))
                              ) : (
                                <p className="px-3 py-4 text-sm text-muted-foreground">No vaults found</p>
                              )}
                            </div>
                          )}
                        </div>

                        <nav className="flex flex-col" aria-label="Mobile primary">
                          <DialogPrimitive.Close asChild>
                            <Link
                              to="/"
                              className="py-3 text-sm font-medium text-foreground hover:text-[#0657f9]"
                              activeProps={{
                                className: 'py-3 text-sm font-medium text-[#0657f9]'
                              }}
                              activeOptions={{ exact: true }}
                            >
                              Vault List
                            </Link>
                          </DialogPrimitive.Close>
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

          <div className="hidden w-full items-center gap-3 min-[500px]:flex md:min-w-0 md:flex-1 md:justify-end">
            <div
              ref={desktopSearchRef}
              className={
                hideMobileSearch
                  ? 'relative hidden md:block md:min-w-0 md:flex-1 md:max-w-[300px]'
                  : 'relative w-full md:min-w-0 md:flex-1 md:max-w-[300px]'
              }
            >
              <input
                type="text"
                placeholder="Search vaults..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setIsDropdownOpen(true)
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              {isDropdownOpen && searchTerm && (
                <div
                  className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-20 overflow-y-auto rounded border border-gray-300 bg-white shadow-md"
                  style={{
                    maxHeight: '50vh'
                  }}
                >
                  {filteredVaults.map((vault) => (
                    <Link
                      key={vault.address}
                      to="/vaults/$chainId/$vaultAddress"
                      params={{
                        chainId: vault.chainId.toString(),
                        vaultAddress: vault.address
                      }}
                      className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-gray-100"
                      onClick={() => {
                        setIsDropdownOpen(false)
                        setSearchTerm('')
                      }}
                    >
                      <span>{vault.name}</span>
                      <span className="text-sm text-gray-600">{vault.apiVersion}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="hidden md:block">{partnerButton}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
