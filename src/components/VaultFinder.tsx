import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CHAIN_ID_TO_NAME } from '@/constants/chains'
import { useVaults } from '@/contexts/useVaults'

export function VaultFinder({ onOpen }: { onOpen?: () => void }) {
  const { vaults, loading, error } = useVaults()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const term = search.trim().toLowerCase()
  const matches = term
    ? vaults.filter((vault) =>
        `${vault.name} ${vault.address} ${vault.asset?.symbol ?? ''} ${CHAIN_ID_TO_NAME[vault.chainId]}`
          .toLowerCase()
          .includes(term)
      )
    : []
  const results = matches.slice(0, 50)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) onOpen?.()
        else setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 shrink-0 gap-2 rounded-none border border-gray-200 px-3 text-muted-foreground md:border-gray-300 hover:bg-muted hover:text-foreground data-[state=open]:bg-muted"
          aria-label="Find a vault"
          title="Find a vault"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">Find a vault</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(28rem,calc(100vw-2rem))] rounded-none p-0"
        aria-label="Find a vault"
      >
        <Command shouldFilter={false} label="Search all vaults" className="rounded-none">
          <CommandInput
            aria-label="Search all vaults"
            placeholder="Search by name, token, or address…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList label="Matching vaults" className="max-h-[min(24rem,60dvh)]">
            {!vaults.length && loading ? (
              <output className="block px-3 py-5 text-sm text-muted-foreground">Loading vaults…</output>
            ) : !vaults.length && error ? (
              <output className="block px-3 py-5 text-sm text-muted-foreground">Vault search is unavailable.</output>
            ) : !term ? (
              <p className="px-3 py-5 text-sm text-muted-foreground">Find a vault to open its detail page.</p>
            ) : !results.length ? (
              <output className="block px-3 py-5 text-sm text-muted-foreground">No matching vaults.</output>
            ) : (
              results.map((vault) => (
                <CommandItem
                  key={`${vault.chainId}:${vault.address}`}
                  value={`${vault.chainId}:${vault.address}`}
                  className="cursor-pointer rounded-none border-b px-3 py-3 last:border-b-0 data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
                  onSelect={() => {
                    setOpen(false)
                    setSearch('')
                    void navigate({
                      to: '/vaults/$chainId/$vaultAddress',
                      params: { chainId: String(vault.chainId), vaultAddress: vault.address }
                    })
                  }}
                >
                  <span className="min-w-0">
                    <span className="block break-words font-medium">{vault.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {CHAIN_ID_TO_NAME[vault.chainId]}
                      {vault.apiVersion && ` · v${vault.apiVersion.replace(/^v/i, '')}`} · {vault.address.slice(0, 6)}…
                      {vault.address.slice(-4)}
                    </span>
                  </span>
                </CommandItem>
              ))
            )}
          </CommandList>
          {matches.length > results.length && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing {results.length} of {matches.length} matches. Refine your search to find more.
            </p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
