import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CHAIN_ID_TO_ICON, isSupportedChainId } from '@/constants/chains'

const CHAINS = [
  { id: 'all', label: 'All Chains' },
  { id: '1', label: 'Ethereum' },
  { id: '10', label: 'Optimism' },
  { id: '137', label: 'Polygon' },
  { id: '999', label: 'HyperEVM' },
  { id: '42161', label: 'Arbitrum' },
  { id: '8453', label: 'Base' },
  { id: '100', label: 'Gnosis' },
  { id: '747474', label: 'Katana' },
  { id: '80094', label: 'Berachain' },
  { id: '146', label: 'Sonic' }
]

function chainIcon(id: string): string {
  if (id === 'all') return '/yearn-all-chains.svg'
  if (id === '999') return 'https://icons.llamao.fi/icons/chains/rsz_hyperliquid.jpg'
  const chainId = Number(id)
  return isSupportedChainId(chainId)
    ? CHAIN_ID_TO_ICON[chainId]
    : `https://cdn.jsdelivr.net/gh/yearn/tokenassets@main/chains/${id}/logo-32.png`
}

export function StatsChainSelector({
  value,
  onValueChange
}: {
  value: string
  onValueChange: (value: string) => void
}) {
  const [keyboardFocus, setKeyboardFocus] = useState(true)

  useEffect(() => {
    // Radix restores focus after closing, so :focus-visible alone can also match mouse clicks.
    const onPointerDown = () => setKeyboardFocus(false)
    const onKeyDown = () => setKeyboardFocus(true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="stats-chain-select" aria-label="Chain" data-keyboard-focus={keyboardFocus}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="stats-chain-options rounded-none">
        {CHAINS.map((chain) => (
          <SelectItem key={chain.id} value={chain.id} textValue={chain.label} className="rounded-none">
            <span className="inline-flex items-center gap-2">
              <img src={chainIcon(chain.id)} alt="" width={20} height={20} className="h-5 w-5 shrink-0 rounded-full" />
              <span>{chain.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
