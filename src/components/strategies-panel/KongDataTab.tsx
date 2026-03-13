import { ExternalLink } from 'lucide-react'
import * as React from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { getKongVaultSnapshotUrl } from '@/lib/kong-rest'
import { cn } from '@/lib/utils'
import type { KongVaultSnapshot } from '@/types/kong'

type StructuredValue = string | number | boolean | null | undefined | StructuredValue[] | StructuredRecord

type StructuredRecord = {
  [key: string]: StructuredValue
}

interface KongDataTabProps {
  snapshot: KongVaultSnapshot | null
}

interface RowDefinition {
  id: string
  label: string
  value: string | number | boolean | null | undefined
  path: string[]
}

interface SectionDefinition {
  key: string
  label: string
  value: StructuredValue
}

type DisplayItem =
  | {
      kind: 'row'
      row: RowDefinition
    }
  | {
      kind: 'section'
      section: SectionDefinition
    }

interface DisplayModel {
  items: DisplayItem[]
}

const overviewKeys = ['chainId', 'address', 'name', 'symbol', 'apiVersion', 'inceptTime', 'totalAssets', 'totalDebt']
const overviewKeySet = new Set<string>(overviewKeys)

const orderedTopLevelKeys = [
  ...overviewKeys,
  'performance',
  'composition',
  'asset',
  'apy',
  'tvl',
  'fees',
  'meta',
  'debts',
  'strategies',
  'staking',
  'inclusion'
]

const sectionLabels: Record<string, string> = {
  asset: 'Asset',
  apy: 'APY',
  composition: 'Composition',
  debts: 'Debts',
  fees: 'Fees',
  inclusion: 'Inclusion',
  meta: 'Meta',
  performance: 'Performance',
  staking: 'Staking',
  strategies: 'Strategies',
  tvl: 'TVL'
}

const titleCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((segment) => {
      const lower = segment.toLowerCase()
      if (['apy', 'apr', 'tvl', 'usd', 'uri', 'pps', 'id'].includes(lower)) {
        return lower.toUpperCase()
      }

      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
    })
    .join(' ')

const isRecord = (value: StructuredValue): value is StructuredRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isScalar = (value: StructuredValue): value is string | number | boolean | null | undefined => {
  return !Array.isArray(value) && !isRecord(value)
}

const isUrl = (value: string): boolean => /^https?:\/\//i.test(value)

const isAddress = (value: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(value)

const isNumericString = (value: string): boolean => /^-?\d+(\.\d+)?$/.test(value)

const formatCompactAddress = (value: string): string => {
  if (!isAddress(value)) {
    return value
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

const formatNumberLike = (value: number | string): string => {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value)
  }

  if (!isNumericString(value)) {
    return value
  }

  if (/^-?\d+$/.test(value)) {
    try {
      return BigInt(value).toLocaleString('en-US')
    } catch {
      return value
    }
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return value
  }

  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(numeric)
}

const maybeFormatTimestamp = (path: string[], value: string | number): { human: string; raw: string } | null => {
  const lowerPath = path.join('.').toLowerCase()
  if (!/(time|report|finishedat)/.test(lowerPath)) {
    return null
  }

  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000
  const date = new Date(millis)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const year = date.getUTCFullYear()
  if (year < 2000 || year > 2100) {
    return null
  }

  return {
    human: new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC'
    }).format(date),
    raw: String(value)
  }
}

const shouldUseRawNumberDisplay = (path: string[]): boolean => {
  const lastKey = path[path.length - 1]?.toLowerCase()
  return lastKey === 'chainid'
}

const summarizeValue = (value: StructuredValue): string => {
  if (Array.isArray(value)) {
    return value.length === 1 ? '1 entry' : `${value.length} entries`
  }

  if (isRecord(value)) {
    const count = Object.values(value).filter((entry) => entry !== undefined).length
    return count === 1 ? '1 field' : `${count} fields`
  }

  if (value === null) {
    return 'null'
  }

  if (value === undefined) {
    return 'empty'
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value === 'string' && isAddress(value)) {
    return formatCompactAddress(value)
  }

  return formatNumberLike(value)
}

const getDefinedEntries = (value: StructuredRecord): Array<[string, StructuredValue]> => {
  return Object.entries(value).filter(([, entry]) => entry !== undefined)
}

const getPromotedRow = (label: string, value: StructuredValue, path: string[], id: string): RowDefinition | null => {
  if (!isRecord(value)) {
    return null
  }

  const entries = getDefinedEntries(value)
  if (entries.length !== 1) {
    return null
  }

  const [innerKey, innerValue] = entries[0]
  if (!isScalar(innerValue)) {
    return null
  }

  return {
    id: `${id}.${innerKey}`,
    label: `${label} ${titleCase(innerKey)}`,
    value: innerValue,
    path: [...path, innerKey]
  }
}

const getItemHeading = (label: string, value: StructuredValue, index: number): string => {
  if (isRecord(value)) {
    const namedValue = [value.displayName, value.name, value.symbol, value.label].find(
      (entry): entry is string => typeof entry === 'string' && entry.length > 0
    )

    if (namedValue) {
      return namedValue
    }

    const addressValue = [value.address, value.strategy].find(
      (entry): entry is string => typeof entry === 'string' && entry.length > 0
    )

    if (addressValue) {
      return formatCompactAddress(addressValue)
    }
  }

  const singular = label.endsWith('s') ? label.slice(0, -1) : label
  return `${titleCase(singular)} ${index + 1}`
}

const buildDisplayModel = (snapshot: KongVaultSnapshot): DisplayModel => {
  const snapshotRecord = snapshot as StructuredRecord
  const orderedKeys = Array.from(new Set([...orderedTopLevelKeys, ...Object.keys(snapshotRecord)]))
  const items: DisplayItem[] = []

  orderedKeys.forEach((key) => {
    const value = snapshotRecord[key]
    if (value === undefined) {
      return
    }

    const label = sectionLabels[key] ?? titleCase(key)

    if (overviewKeySet.has(key)) {
      if (isScalar(value)) {
        items.push({
          kind: 'row',
          row: {
            id: key,
            label: titleCase(key),
            value,
            path: [key]
          }
        })
      } else {
        items.push({
          kind: 'section',
          section: { key, label: titleCase(key), value }
        })
      }
      return
    }

    if (isScalar(value)) {
      items.push({
        kind: 'row',
        row: {
          id: key,
          label,
          value,
          path: [key]
        }
      })
      return
    }

    const promotedRow = getPromotedRow(label, value, [key], key)
    if (promotedRow) {
      items.push({
        kind: 'row',
        row: promotedRow
      })
      return
    }

    items.push({
      kind: 'section',
      section: {
        key,
        label,
        value
      }
    })
  })

  return { items }
}

const ValueChip = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="inline-flex min-w-[3.25rem] items-center justify-center rounded-full border border-[hsl(var(--data-ledger-border))] px-2 py-0.5 text-[11px] text-[hsl(var(--data-ledger-muted))] tabular-nums">
      {children}
    </span>
  )
}

const ScalarValue = ({ path, value }: { path: string[]; value: string | number | boolean | null | undefined }) => {
  if (value === undefined) {
    return <span className="text-[hsl(var(--data-ledger-faint))]">Not provided</span>
  }

  if (value === null) {
    return <span className="text-[hsl(var(--data-ledger-faint))]">null</span>
  }

  if (typeof value === 'boolean') {
    return <ValueChip>{value ? 'true' : 'false'}</ValueChip>
  }

  const timestamp = maybeFormatTimestamp(path, value)
  if (timestamp) {
    return (
      <span className="flex flex-col gap-0.5 tabular-nums">
        <span>{timestamp.human}</span>
        <span className="text-[11px] text-[hsl(var(--data-ledger-faint))]">{timestamp.raw}</span>
      </span>
    )
  }

  if (typeof value === 'string' && isUrl(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-[hsl(var(--data-ledger-muted))] underline decoration-[hsl(var(--data-ledger-border))] underline-offset-4 transition-colors hover:text-[hsl(var(--data-ledger-fg))]"
      >
        <span className="break-all">{value}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      </a>
    )
  }

  if (shouldUseRawNumberDisplay(path)) {
    return <span className="break-all tabular-nums text-[hsl(var(--data-ledger-fg))]">{String(value)}</span>
  }

  return <span className="break-all tabular-nums text-[hsl(var(--data-ledger-fg))]">{formatNumberLike(value)}</span>
}

const DataRow = ({ row }: { row: RowDefinition }) => {
  return (
    <div className="grid gap-2 py-2.5 sm:grid-cols-[minmax(9rem,11rem)_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--data-ledger-muted))]">{row.label}</dt>
      <dd className="min-w-0 text-[12px]">
        <ScalarValue path={row.path} value={row.value} />
      </dd>
    </div>
  )
}

const DataRows = ({ rows, depth = 0 }: { rows: RowDefinition[]; depth?: number }) => {
  return (
    <dl
      className="divide-y divide-[hsl(var(--data-ledger-border-subtle))]"
      style={depth > 0 ? { paddingLeft: `${depth * 16}px` } : undefined}
    >
      {rows.map((row) => (
        <DataRow key={row.id} row={row} />
      ))}
    </dl>
  )
}

const DataArray = ({
  label,
  items,
  path,
  depth = 0
}: {
  label: string
  items: StructuredValue[]
  path: string[]
  depth?: number
}) => {
  if (items.length === 0) {
    return (
      <div
        className="border border-dashed border-[hsl(var(--data-ledger-border))] px-3 py-4 text-sm text-[hsl(var(--data-ledger-faint))]"
        style={depth > 0 ? { marginLeft: `${depth * 16}px` } : undefined}
      >
        No entries
      </div>
    )
  }

  return (
    <div
      className="divide-y divide-[hsl(var(--data-ledger-border-subtle))]"
      style={depth > 0 ? { marginLeft: `${depth * 16}px` } : undefined}
    >
      {items.map((item, index) => {
        const itemPath = [...path, String(index)]
        const itemId = `${path.join('.')}-${index}`

        if (isScalar(item)) {
          return (
            <div key={itemId} className="px-3">
              <DataRows
                rows={[
                  {
                    id: itemId,
                    label: getItemHeading(label, item, index),
                    value: item,
                    path: itemPath
                  }
                ]}
                depth={0}
              />
            </div>
          )
        }

        const promotedRow = getPromotedRow(getItemHeading(label, item, index), item, itemPath, itemId)
        if (promotedRow) {
          return (
            <div key={itemId} className="px-3">
              <DataRows rows={[promotedRow]} depth={0} />
            </div>
          )
        }

        return (
          <Accordion key={itemId} type="multiple" className="w-full">
            <AccordionItem value={itemId} className="border-0">
              <AccordionTrigger className="justify-start gap-2 py-2.5 text-left hover:no-underline [&>svg]:order-first [&>svg]:text-[hsl(var(--data-ledger-muted))]">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-3">
                  <span className="truncate text-sm text-[hsl(var(--data-ledger-fg))]">
                    {getItemHeading(label, item, index)}
                  </span>
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-[hsl(var(--data-ledger-faint))] tabular-nums">
                    {summarizeValue(item)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <div className="px-3 pb-2">
                  {Array.isArray(item) ? (
                    <DataArray label={`${label}-${index + 1}`} items={item} path={itemPath} depth={depth + 1} />
                  ) : isRecord(item) ? (
                    <DataRecord value={item} path={itemPath} depth={depth + 1} />
                  ) : (
                    <div className={cn('py-1 text-[12px]', 'text-[hsl(var(--data-ledger-fg))]')}>
                      <ScalarValue path={itemPath} value={item} />
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )
      })}
    </div>
  )
}

const DataRecord = ({ value, path, depth = 0 }: { value: StructuredRecord; path: string[]; depth?: number }) => {
  const rows: RowDefinition[] = []
  const complexEntries: Array<[string, StructuredValue]> = []

  getDefinedEntries(value).forEach(([key, entry]) => {
    if (isScalar(entry)) {
      rows.push({
        id: [...path, key].join('.'),
        label: titleCase(key),
        value: entry,
        path: [...path, key]
      })
      return
    }

    const promotedRow = getPromotedRow(titleCase(key), entry, [...path, key], [...path, key].join('.'))
    if (promotedRow) {
      rows.push(promotedRow)
      return
    }

    complexEntries.push([key, entry])
  })

  return (
    <div className="space-y-2.5">
      {rows.length > 0 && <DataRows rows={rows} depth={depth} />}

      {complexEntries.length > 0 && (
        <div className="space-y-2.5" style={depth > 0 ? { paddingLeft: `${depth * 16}px` } : undefined}>
          {complexEntries.map(([key, entry]) => (
            <section key={key} className="space-y-2 border-t border-[hsl(var(--data-ledger-border-subtle))] pt-2.5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--data-ledger-muted))]">
                  {titleCase(key)}
                </h4>
                <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-[hsl(var(--data-ledger-faint))] tabular-nums">
                  {summarizeValue(entry)}
                </span>
              </div>

              {Array.isArray(entry) ? (
                <DataArray label={key} items={entry} path={[...path, key]} depth={depth + 1} />
              ) : isRecord(entry) ? (
                <div className="py-0.5">
                  <DataRecord value={entry} path={[...path, key]} depth={depth + 1} />
                </div>
              ) : (
                <div className="py-0.5 text-[12px]">
                  <ScalarValue path={[...path, key]} value={entry} />
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export const KongDataTab: React.FC<KongDataTabProps> = React.memo(({ snapshot }) => {
  const displayModel = React.useMemo(() => (snapshot ? buildDisplayModel(snapshot) : { items: [] }), [snapshot])
  const endpointUrl = React.useMemo(
    () => (snapshot ? getKongVaultSnapshotUrl(snapshot.chainId, snapshot.address) : null),
    [snapshot]
  )
  const defaultOpenSections = React.useMemo(() => {
    return displayModel.items
      .filter((item): item is Extract<DisplayItem, { kind: 'section' }> => item.kind === 'section')
      .slice(0, 2)
      .map((item) => item.section.key)
  }, [displayModel.items])

  if (!snapshot) {
    return (
      <div className="min-h-[24rem] px-5 py-6 text-[hsl(var(--data-ledger-fg))] sm:px-6">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--data-ledger-muted))]">Kong Data</p>
          <h3 className="text-base font-medium">No snapshot returned for this vault</h3>
          <p className="max-w-2xl text-sm text-[hsl(var(--data-ledger-muted))]">
            The vault page is still using normalized data where available, but Kong did not return a raw snapshot to
            inspect here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[24rem] bg-[hsl(var(--data-ledger-bg))] px-5 py-5 text-[hsl(var(--data-ledger-fg))] sm:px-6">
      <div className="border-b border-[hsl(var(--data-ledger-border))] pb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--data-ledger-muted))]">
                Kong Snapshot
              </p>
              <h3 className="text-base font-medium">Raw vault payload, organized for inspection</h3>
              <p className="max-w-2xl text-sm text-[hsl(var(--data-ledger-muted))]">
                Expand any section to inspect the fields Kong returned for this vault, including nested arrays such as
                strategy composition, debts, and staking rewards.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--data-ledger-faint))]">
              <ValueChip>Chain {snapshot.chainId}</ValueChip>
              <ValueChip>{formatCompactAddress(snapshot.address)}</ValueChip>
            </div>
          </div>

          {endpointUrl && (
            <a
              href={endpointUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-sm text-[hsl(var(--data-ledger-muted))] underline decoration-[hsl(var(--data-ledger-border))] underline-offset-4 transition-colors hover:text-[hsl(var(--data-ledger-fg))]"
            >
              <span>Query raw endpoint</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          )}
        </div>
      </div>

      {displayModel.items.length > 0 && (
        <div className="divide-y divide-[hsl(var(--data-ledger-border-subtle))]">
          {displayModel.items.map((item) => {
            if (item.kind === 'row') {
              return (
                <dl key={item.row.id}>
                  <DataRow row={item.row} />
                </dl>
              )
            }

            const { section } = item
            const isDefaultOpen = defaultOpenSections.includes(section.key)

            return (
              <Accordion
                key={section.key}
                type="multiple"
                defaultValue={isDefaultOpen ? [section.key] : []}
                className="w-full"
              >
                <AccordionItem value={section.key} className="border-0">
                  <AccordionTrigger className="justify-start gap-2 py-3 text-left hover:no-underline [&>svg]:order-first [&>svg]:text-[hsl(var(--data-ledger-muted))]">
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--data-ledger-muted))]">
                        {section.label}
                      </p>
                      <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-[hsl(var(--data-ledger-faint))] tabular-nums">
                        {summarizeValue(section.value)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <div className="pb-2">
                      {Array.isArray(section.value) ? (
                        <DataArray label={section.label} items={section.value} path={[section.key]} depth={1} />
                      ) : isRecord(section.value) ? (
                        <DataRecord value={section.value} path={[section.key]} depth={1} />
                      ) : (
                        <div className={cn('py-1 text-[12px]', 'text-[hsl(var(--data-ledger-fg))]')}>
                          <ScalarValue path={[section.key]} value={section.value} />
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )
          })}
        </div>
      )}
    </div>
  )
})

KongDataTab.displayName = 'KongDataTab'
