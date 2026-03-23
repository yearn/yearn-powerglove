import { Link, useRouterState } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useVaults } from '@/contexts/useVaults'

export default function Header() {
  const { vaults } = useVaults()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-white py-2">
      <div className="container flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 cursor-pointer items-center gap-2">
            <img src="/logo.svg" alt="Yearn PowerGlove Logo" className="h-6 w-6 shrink-0" />
            <span className="text-base font-bold sm:text-lg">Yearn PowerGlove</span>
          </Link>
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
        </div>

        <div className={hideMobileSearch ? 'relative hidden w-full md:block md:w-[300px]' : 'relative w-full md:w-[300px]'}>
          <input
            ref={searchInputRef}
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
              ref={dropdownRef}
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
      </div>
    </header>
  )
}
