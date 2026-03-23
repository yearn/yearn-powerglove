import { ArrowDown, ArrowUp, Check, ChevronDown, Search, SlidersHorizontal } from 'lucide-react'
import type React from 'react'
import { useMemo, useState } from 'react'
import { CHAIN_ID_TO_ICON, CHAIN_ID_TO_NAME, type ChainId } from '@/constants/chains'
import { VAULT_TYPE_LIST } from '@/constants/vaultTypes'
import type { VaultSortColumn } from '@/hooks/useVaultFiltering'
import { cn } from '@/lib/utils'
import type { SortDirection } from '@/utils/sortingUtils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { OptimizedImage } from '../ui/OptimizedImage'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet'
import { useIsMobile } from '../ui/use-mobile'
import { ChainSelector } from './ChainSelector'
import { TypeSelector } from './TypeSelector'

interface VaultsFilterBarProps {
  selectedChains: number[]
  selectedTypes: string[]
  searchTerm: string
  sortColumn: VaultSortColumn
  sortDirection: SortDirection
  onChainToggle: (chainId: number) => void
  onSetSelectedChains: (chainIds: number[]) => void
  onTypeToggle: (type: string) => void
  onSetSelectedTypes: (types: string[]) => void
  onSearchChange: (term: string) => void
  onSortColumnChange: (column: VaultSortColumn) => void
  onSortDirectionChange: (direction: SortDirection) => void
}

type MobileChainOption = {
  id: number
  name: string
  icon: string
}

const SORT_OPTIONS: { value: VaultSortColumn; label: string }[] = [
  { value: 'tvl', label: 'TVL' },
  { value: 'APY', label: '30D APY' },
  { value: 'name', label: 'Vault Name' },
  { value: 'token', label: 'Token' },
  { value: 'chain', label: 'Chain' },
  { value: 'type', label: 'Vault Type' }
]

const TYPE_SHORT_LABELS: Record<string, string> = {
  'Allocator Vault': 'Allocator',
  'Strategy Vault': 'Strategy',
  'Factory Vault': 'Factory',
  'Legacy Vault': 'Legacy',
  'External Vault': 'External'
}

const buildMobileChains = (): MobileChainOption[] => {
  return Object.entries(CHAIN_ID_TO_NAME).map(([id, name]) => {
    const chainId = Number(id) as ChainId
    return {
      id: chainId,
      name,
      icon: CHAIN_ID_TO_ICON[chainId]
    }
  })
}

const getTypeLabel = (type: string): string => TYPE_SHORT_LABELS[type] ?? type.replace(/ Vault$/, '')

const ChainAvatar = ({ iconUri, alt }: { iconUri: string; alt: string }) => {
  return <OptimizedImage src={iconUri} alt={alt} className="h-5 w-5" fallbackClassName="h-5 w-5 text-[9px]" />
}

const YearnAvatar = () => {
  return (
    <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-black">
      <svg viewBox="0 0 64 64" className="h-4 w-4" role="img" aria-label="Yearn">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M18.6503 12.6038L16.1257 15.1706L22.2818 21.4274L28.4378 27.6842V33.5107V39.3371H32.0135H35.5893V33.511V27.6848L41.7456 21.4271L47.9018 15.1694L45.358 12.5847L42.8142 10L37.4506 15.4513C34.5006 18.4496 32.0537 20.9027 32.0132 20.9027C31.9726 20.9027 29.5343 18.4579 26.5947 15.4698C23.655 12.4817 21.2331 10.0369 21.2124 10.0369C21.1918 10.0369 20.0389 11.1919 18.6503 12.6038ZM16.0058 27.2092C15.1103 28.7856 14.285 31.5919 14.0576 33.8342C13.9453 34.94 14.0047 37.3535 14.1707 38.4379C15.7241 48.5837 25.1531 55.4801 35.0756 53.7278C41.617 52.5727 46.9959 47.8823 49.0868 41.5103C49.7748 39.4134 49.9978 37.9952 50 35.7027C50.0023 33.2213 49.7243 31.5721 48.9197 29.2956C48.6439 28.5149 47.9343 26.9726 47.851 26.9726C47.8176 26.9726 46.5834 28.1995 45.1085 29.6992C42.6284 32.2206 42.4294 32.4419 42.4638 32.6404C42.4843 32.7585 42.5551 33.1022 42.6211 33.4041C42.8129 34.2817 42.8877 35.4693 42.8137 36.4592C42.7357 37.4995 42.6127 38.1406 42.3014 39.1282C41.3021 42.2991 38.6553 45.0151 35.4945 46.113C34.2873 46.5323 33.6097 46.6358 32.0504 46.6391C30.4654 46.6426 29.8676 46.557 28.6391 46.1508C25.297 45.046 22.5734 42.1951 21.5925 38.7751C21.274 37.6643 21.1824 36.9547 21.1865 35.6278C21.1903 34.3942 21.2291 34.0784 21.5545 32.6303C21.5807 32.5135 20.9885 31.8717 18.8681 29.7196L16.1481 26.9588L16.0058 27.2092Z"
          fill="#fff"
        />
      </svg>
    </span>
  )
}

const MobileChainDropdown = ({
  chains,
  selectedChainId,
  allChainsLabel,
  onChange
}: {
  chains: MobileChainOption[]
  selectedChainId: number | null
  allChainsLabel: string
  onChange: (chainId: number | null) => void
}) => {
  const [open, setOpen] = useState(false)
  const selectedChain = selectedChainId ? (chains.find((chain) => chain.id === selectedChainId) ?? null) : null

  const handleSelect = (chainId: number | null) => {
    onChange(chainId)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center justify-between gap-2 rounded-none border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
          aria-expanded={open}
        >
          <div className="flex min-w-0 items-center gap-2">
            {selectedChain ? <ChainAvatar iconUri={selectedChain.icon} alt={selectedChain.name} /> : <YearnAvatar />}
            <span className="truncate">{selectedChain ? selectedChain.name : allChainsLabel}</span>
          </div>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-[calc(100vw-2.5rem)] max-w-[358px] rounded-none border border-gray-200 bg-white p-1 shadow-lg"
      >
        <div className="max-h-60 overflow-y-auto">
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-none px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50',
              selectedChain === null ? 'font-semibold text-gray-900' : 'text-gray-600'
            )}
            onClick={() => handleSelect(null)}
          >
            <YearnAvatar />
            <span className="min-w-0 flex-1 truncate">{allChainsLabel}</span>
            {selectedChain === null ? <Check className="h-4 w-4 text-gray-900" /> : null}
          </button>

          {chains.map((chain) => {
            const isSelected = chain.id === selectedChainId
            return (
              <button
                key={chain.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-none px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50',
                  isSelected ? 'font-semibold text-gray-900' : 'text-gray-600'
                )}
                onClick={() => handleSelect(chain.id)}
              >
                <ChainAvatar iconUri={chain.icon} alt={chain.name} />
                <span className="min-w-0 flex-1 truncate">{chain.name}</span>
                {isSelected ? <Check className="h-4 w-4 text-gray-900" /> : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export const VaultsFilterBar: React.FC<VaultsFilterBarProps> = ({
  selectedChains,
  selectedTypes,
  searchTerm,
  sortColumn,
  sortDirection,
  onChainToggle,
  onSetSelectedChains,
  onTypeToggle,
  onSetSelectedTypes,
  onSearchChange,
  onSortColumnChange,
  onSortDirectionChange
}) => {
  const isMobile = useIsMobile()
  const mobileChains = useMemo(() => buildMobileChains(), [])
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)

  const areAllTypesSelected = selectedTypes.length === 0 || selectedTypes.length === VAULT_TYPE_LIST.length
  const activeSortLabel = SORT_OPTIONS.find((option) => option.value === sortColumn)?.label ?? 'TVL'
  const selectedTypeSummary = areAllTypesSelected
    ? 'All vault types'
    : selectedTypes.length === 1
      ? getTypeLabel(selectedTypes[0])
      : `${selectedTypes.length} types`

  if (!isMobile) {
    return (
      <div className="flex flex-col gap-4 border bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <ChainSelector
            selectedChains={selectedChains}
            onChainToggle={onChainToggle}
            onSetSelectedChains={onSetSelectedChains}
          />
          <TypeSelector
            selectedTypes={selectedTypes}
            onTypeToggle={onTypeToggle}
            onSetSelectedTypes={onSetSelectedTypes}
          />
        </div>

        <div className="relative w-full md:max-w-[20rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search vaults or tokens"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 border-gray-300 pl-9 text-sm"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="border bg-white p-3 shadow-sm">
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search vaults or tokens"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-11 rounded-none border-gray-200 bg-gray-50 pl-9 text-sm"
          />
        </div>

        <MobileChainDropdown
          chains={mobileChains}
          selectedChainId={selectedChains[0] ?? null}
          allChainsLabel="All Chains"
          onChange={(chainId) => onSetSelectedChains(chainId === null ? [] : [chainId])}
        />

        <Sheet open={isMobileFiltersOpen} onOpenChange={setIsMobileFiltersOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex h-10 w-full items-center justify-between gap-3 rounded-none border border-gray-200 bg-gray-50 px-3 text-left transition-colors hover:bg-gray-100"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">Filter Vaults</span>
              </div>
              <span className="truncate text-xs text-gray-500">
                {selectedTypeSummary}
                <span className="mx-1 text-gray-300">/</span>
                {activeSortLabel}
              </span>
            </button>
          </SheetTrigger>

          <SheetContent side="bottom" className="max-h-[78vh] overflow-y-auto rounded-none px-4 pb-6 pt-8">
            <SheetHeader className="pr-8 text-left">
              <SheetTitle className="text-left">Filter Vaults</SheetTitle>
              <SheetDescription className="text-left">
                Adjust vault type filters and list sorting without changing chain selection.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Vault Types</div>
                  {!areAllTypesSelected ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
                      onClick={() => onSetSelectedTypes([])}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {VAULT_TYPE_LIST.map((type) => {
                    const isSelected = !areAllTypesSelected && selectedTypes.includes(type)
                    return (
                      <button
                        key={type}
                        type="button"
                        className={cn(
                          'inline-flex h-9 items-center rounded-none border px-3 text-xs font-semibold uppercase tracking-[0.08em] transition-colors',
                          isSelected
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 bg-white text-gray-600'
                        )}
                        onClick={() => onTypeToggle(type)}
                        aria-pressed={isSelected}
                      >
                        {getTypeLabel(type)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Sort</div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Select value={sortColumn} onValueChange={(value) => onSortColumnChange(value as VaultSortColumn)}>
                    <SelectTrigger className="h-10 rounded-none border-gray-200 bg-white text-sm">
                      <SelectValue placeholder="Sort vaults" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-none border-gray-200 bg-white"
                    onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
                    aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
