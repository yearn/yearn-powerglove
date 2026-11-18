import { Boxes, ChevronDown, DollarSign, Eye, EyeOff, Layers, Search, SlidersHorizontal, X } from 'lucide-react'
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VaultIcon } from '@/components/vaults-list/VaultRow'
import { CHAIN_ID_TO_ICON, CHAIN_ID_TO_NAME, type ChainId } from '@/constants/chains'
import { VAULT_TYPE_LIST } from '@/constants/vaultTypes'
import { customTvlBounds, defaultVaultFilters, TVL_RANGES, type VaultFilters } from '@/hooks/useVaultFiltering'

export type FilterRequest = { type: 'assets' | 'chains' | 'types' }

interface Props {
  assets?: string[]
  assetIcons?: Record<string, string | undefined>
  filterRequest?: FilterRequest
  filters: VaultFilters
  onFiltersChange: (filters: VaultFilters) => void
  versions: string[]
  searchTerm: string
  onSearchChange: (term: string) => void
}

type Option = { value: string; label: string; icon?: string }
const chains = Object.entries(CHAIN_ID_TO_NAME).map(([id, label]) => ({
  value: id,
  label,
  icon: CHAIN_ID_TO_ICON[Number(id) as ChainId]
}))
const types = VAULT_TYPE_LIST.map((type) => ({ value: type, label: type.replace(/ Vault$/, '') }))
const tvlOptions = TVL_RANGES.map((range) => ({ value: range.id, label: range.label }))
const controlClass =
  'inline-flex h-9 shrink-0 whitespace-nowrap items-center justify-center gap-2 rounded-none border border-border bg-white px-3 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function Choices({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  singleColumn = false
}: {
  label: string
  options: Option[]
  selected: string[]
  onChange: (values: string[]) => void
  searchable?: boolean
  singleColumn?: boolean
}) {
  const [query, setQuery] = useState('')
  const visibleOptions = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-medium text-muted-foreground">{label}</legend>
      {searchable && (
        <Input
          aria-label="Search assets"
          placeholder="Search assets..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mb-2 h-8 rounded-none text-xs focus-visible:border-[#0657f9] focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      )}
      <div className={`grid max-h-48 gap-1 overflow-y-auto ${singleColumn ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {visibleOptions.map(({ value, label: optionLabel, icon }) => (
          <label key={value} className="flex cursor-pointer items-center gap-2 px-1 py-1.5 text-sm hover:bg-muted">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-black"
              checked={selected.includes(value)}
              onChange={() =>
                onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
              }
            />
            {(searchable || icon) && (
              <span aria-hidden="true" className="shrink-0">
                <VaultIcon src={icon} alt="" fallback={optionLabel.slice(0, 2)} className="h-4 w-4" />
              </span>
            )}
            <span>{optionLabel}</span>
          </label>
        ))}
      </div>
      {searchable && visibleOptions.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">No assets found.</p>
      )}
    </fieldset>
  )
}

function FilterDropdown({
  label,
  count = 0,
  children,
  open,
  onOpenChange
}: {
  label: string
  count?: number
  children: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className={controlClass}>
          {label}
          {count > 0 && <span className="text-muted-foreground">({count})</span>}
          <ChevronDown size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-none bg-white p-3">
        {children}
      </PopoverContent>
    </Popover>
  )
}

function FilterIcon({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="group inline-flex h-8 min-w-8 items-center justify-center gap-1 border border-border bg-muted/40 px-2 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <X size={10} className="text-muted-foreground" aria-hidden="true" />
    </button>
  )
}

export function VaultsFilterBar({
  assets = [],
  assetIcons = {},
  filterRequest,
  filters,
  onFiltersChange,
  versions,
  searchTerm,
  onSearchChange
}: Props) {
  const [open, setOpen] = useState(false)
  const [focusedGroup, setFocusedGroup] = useState<string>()
  useEffect(() => {
    if (!filterRequest) return
    setFocusedGroup(filterRequest.type)
    setOpen(true)
  }, [filterRequest])
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const selectorsRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [inline, setInline] = useState(false)
  useLayoutEffect(() => {
    if (!open) return
    const toolbar = toolbarRef.current
    const selectors = selectorsRef.current
    if (!toolbar || !selectors) return
    const measure = () => {
      const buttonsWidth =
        [...selectors.children].reduce((total, child) => total + child.getBoundingClientRect().width, 0) +
        (selectors.children.length - 1) * 8
      const required =
        (headingRef.current?.getBoundingClientRect().width || 0) +
        (filterButtonRef.current?.getBoundingClientRect().width || 0) +
        320 +
        buttonsWidth +
        24
      setInline(required <= toolbar.clientWidth - 32)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(toolbar)
    for (const child of selectors.children) observer.observe(child)
    measure()
    return () => observer.disconnect()
  }, [open])
  const rowId = useId()
  const tvlId = useId()
  const bounds = customTvlBounds(filters)
  const count =
    (filters.assets?.length || 0) +
    filters.chains.length +
    filters.types.length +
    filters.versions.length +
    filters.tvlRanges.length +
    Number(filters.showRetired) +
    Number(bounds.active)
  const update = <K extends keyof VaultFilters>(key: K, value: VaultFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value })
  const groups = [
    {
      id: 'assets' as const,
      label: 'Assets',
      options: assets.map((asset) => ({ value: asset, label: asset, icon: assetIcons[asset] })),
      selected: filters.assets || [],
      onChange: (values: string[]) => update('assets', values)
    },
    {
      id: 'chains' as const,
      label: 'Chains',
      options: chains,
      selected: filters.chains.map(String),
      onChange: (values: string[]) => update('chains', values.map(Number))
    },
    {
      id: 'types' as const,
      label: 'Vault types',
      options: types,
      selected: filters.types,
      onChange: (values: string[]) => update('types', values)
    },
    {
      id: 'versions' as const,
      label: 'API versions',
      options: versions.map((v) => ({ value: v, label: v })),
      selected: filters.versions,
      onChange: (values: string[]) => update('versions', values)
    },
    {
      id: 'tvlRanges' as const,
      label: 'TVL (USD)',
      options: tvlOptions,
      selected: filters.tvlRanges,
      onChange: (values: string[]) => onFiltersChange({ ...filters, tvlRanges: values, tvlMin: '', tvlMax: '' })
    }
  ]
  const customTvl = (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="text-xs font-medium text-muted-foreground">Custom TVL (USD)</div>
      <div className="grid grid-cols-2 gap-2">
        {(['tvlMin', 'tvlMax'] as const).map((key) => (
          <label key={key} className="space-y-1 text-xs text-muted-foreground">
            <span>{key === 'tvlMin' ? 'Minimum' : 'Maximum'}</span>
            <Input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              aria-label={key === 'tvlMin' ? 'Minimum TVL (USD)' : 'Maximum TVL (USD)'}
              aria-invalid={bounds.invalid}
              aria-describedby={bounds.invalid ? tvlId : undefined}
              placeholder={key === 'tvlMin' ? 'No minimum' : 'No maximum'}
              value={filters[key]}
              onChange={(event) => onFiltersChange({ ...filters, [key]: event.target.value, tvlRanges: [] })}
              className="h-9 rounded-none bg-white text-sm focus-visible:border-[#0657f9] focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </label>
        ))}
      </div>
      {bounds.invalid && (
        <p id={tvlId} role="alert" className="text-xs text-red-700">
          Use non-negative amounts with minimum no greater than maximum.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Leave either bound empty for no limit. Custom amounts replace preset ranges.
      </p>
    </div>
  )
  const renderGroup = (group: (typeof groups)[number]) => {
    if (group.id === 'versions') {
      const sections = [
        { label: 'V3 versions', options: group.options.filter((v) => v.value.startsWith('3')) },
        { label: 'V2 versions', options: group.options.filter((v) => v.value.startsWith('0.')) },
        {
          label: 'Other versions',
          options: group.options.filter((v) => !v.value.startsWith('3') && !v.value.startsWith('0.'))
        }
      ]
      return (
        <div className="grid grid-cols-2 items-start gap-3">
          {sections
            .filter((section) => section.options.length)
            .map((section) => (
              <Choices
                key={section.label}
                singleColumn
                label={section.label}
                options={section.options}
                selected={group.selected}
                onChange={group.onChange}
              />
            ))}
        </div>
      )
    }
    return (
      <div>
        <Choices
          {...group}
          searchable={group.id === 'assets'}
          singleColumn={group.id === 'chains' || group.id === 'assets' || group.id === 'types'}
        />
        {group.id === 'tvlRanges' && customTvl}
      </div>
    )
  }
  const status = (
    <button
      type="button"
      className={controlClass}
      aria-pressed={filters.showRetired}
      onClick={() => update('showRetired', !filters.showRetired)}
    >
      {filters.showRetired ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
      {filters.showRetired ? 'Hide retired vaults' : 'Show retired vaults'}
    </button>
  )

  return (
    <div className="shrink-0 border-x border-border bg-white">
      <div ref={toolbarRef} className="flex flex-wrap items-center gap-2 px-4 py-3">
        <h1 ref={headingRef} className="mr-auto w-full shrink-0 text-base sm:w-auto font-semibold text-foreground">
          Explore Yearn Vaults
        </h1>

        {!open && count > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Active vault filters">
            {filters.chains.map((id) => (
              <FilterIcon
                key={id}
                label={`Remove chain filter: ${CHAIN_ID_TO_NAME[id as ChainId]}`}
                onClick={() =>
                  update(
                    'chains',
                    filters.chains.filter((v) => v !== id)
                  )
                }
              >
                <img src={CHAIN_ID_TO_ICON[id as ChainId]} alt="" className="h-4 w-4" />
              </FilterIcon>
            ))}
            {(filters.assets?.length || 0) > 0 && (
              <FilterIcon label={`Clear assets: ${filters.assets?.join(', ')}`} onClick={() => update('assets', [])}>
                <Layers size={14} />
                {filters.assets?.length}
              </FilterIcon>
            )}
            {filters.types.length > 0 && (
              <FilterIcon label={`Clear vault types: ${filters.types.join(', ')}`} onClick={() => update('types', [])}>
                <Boxes size={14} />
                {filters.types.length}
              </FilterIcon>
            )}
            {filters.versions.length > 0 && (
              <FilterIcon
                label={`Clear API versions: ${filters.versions.join(', ')}`}
                onClick={() => update('versions', [])}
              >
                <Layers size={14} />
                {filters.versions.length}
              </FilterIcon>
            )}
            {filters.tvlRanges.length > 0 && (
              <FilterIcon
                label={`Clear TVL ranges: ${tvlOptions
                  .filter((o) => filters.tvlRanges.includes(o.value))
                  .map((o) => o.label)
                  .join(', ')}`}
                onClick={() => update('tvlRanges', [])}
              >
                <DollarSign size={14} />
                {filters.tvlRanges.length}
              </FilterIcon>
            )}
            {bounds.active && (
              <FilterIcon
                label={`Clear custom TVL: ${filters.tvlMin || 'No minimum'} – ${filters.tvlMax || 'No maximum'}`}
                onClick={() => onFiltersChange({ ...filters, tvlMin: '', tvlMax: '' })}
              >
                <DollarSign size={14} />
                <span>Custom</span>
              </FilterIcon>
            )}
            {count > 0 && (
              <button
                type="button"
                onClick={() => onFiltersChange(defaultVaultFilters())}
                className="ml-1 text-xs text-muted-foreground underline hover:text-foreground"
              >
                Reset filters
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          className={`${controlClass} order-3 ${open ? 'outline outline-1 outline-[#0657f9]' : ''}`}
          ref={filterButtonRef}
          aria-expanded={open}
          aria-controls={rowId}
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal size={14} /> Filters{' '}
          {count > 0 && <span className="text-muted-foreground">({count})</span>}
        </button>
        <div className="relative order-4 min-w-0 flex-1 sm:w-80 sm:flex-none">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Filter vaults or tokens…"
            aria-label="Filter vaults or tokens"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-9 rounded-none pl-9 text-sm focus-visible:border-[#0657f9] focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {open && (
          <div className={inline ? 'order-2' : 'vault-filter-row-expansion order-5 grid w-full grid-rows-[1fr]'}>
            <div className={inline ? '' : 'min-h-0 overflow-hidden'}>
              <div
                id={rowId}
                ref={selectorsRef}
                className={`vault-filter-selectors flex items-center justify-end gap-2 bg-white ${inline ? 'flex-nowrap' : 'vault-filter-selectors-below w-full flex-wrap'}`}
                aria-label="Vault filter selectors"
              >
                {groups.map((group) => (
                  <FilterDropdown
                    key={group.id}
                    label={group.label}
                    open={focusedGroup === group.id}
                    onOpenChange={(isOpen) => setFocusedGroup(isOpen ? group.id : undefined)}
                    count={group.selected.length + Number(group.id === 'tvlRanges' && bounds.active)}
                  >
                    {renderGroup(group)}
                  </FilterDropdown>
                ))}
                {status}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
