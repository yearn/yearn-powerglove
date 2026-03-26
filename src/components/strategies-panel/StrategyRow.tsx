import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import React from 'react'
import { CHAIN_ID_TO_BLOCK_EXPLORER, CHAIN_ID_TO_NAME } from '@/constants/chains'
import { formatAllocationPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Strategy } from '@/types/dataTypes'

interface StrategyRowProps {
  strategy: Strategy
  isExpanded: boolean
  onToggle: () => void
  isUnallocated?: boolean
}

export const StrategyRow: React.FC<StrategyRowProps> = React.memo(
  ({ strategy, isExpanded, onToggle, isUnallocated = false }) => {
    const shortVaultAddress = `${strategy.details.vaultAddress.slice(0, 6)}...${strategy.details.vaultAddress.slice(-4)}`

    return (
      <div
        className={cn('border-t border-[#f5f5f5]', (strategy.allocationPercent === 0 || isUnallocated) && 'opacity-50')}
      >
        <div
          className={cn('cursor-pointer p-3 hover:bg-[#f5f5f5]/50', isExpanded && 'bg-[#f5f5f5]/30')}
          onClick={onToggle}
        >
          <div className="md:hidden">
            <div className="flex items-start gap-3">
              <div className="flex w-5 justify-center pt-1">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-[#4f4f4f]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#4f4f4f]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {strategy.tokenIconUri ? (
                    <img src={strategy.tokenIconUri} alt={strategy.tokenSymbol} className="h-6 w-6 shrink-0" />
                  ) : (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-300 text-white">
                      ?
                    </div>
                  )}
                  <span className="font-medium leading-5">{strategy.name}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-[#808080]">Allocation %</div>
                    <div className="mt-1 font-medium">{formatAllocationPercent(strategy.allocationPercent)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-[#808080]">amount</div>
                    <div className="mt-1 font-medium">{strategy.allocationAmount}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-[#808080]">APY</div>
                    <div className="mt-1 font-medium">{strategy.estimatedAPY} APY</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden items-center md:flex">
            <div className="flex w-8 justify-center">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-[#4f4f4f]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[#4f4f4f]" />
              )}
            </div>
            <div className="w-[calc(50%-2rem)] flex items-center gap-2">
              <div className="flex items-center">
                {strategy.tokenIconUri ? (
                  <img src={strategy.tokenIconUri} alt={strategy.tokenSymbol} className="h-6 w-6" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-white">?</div>
                )}
              </div>
              <span className="font-medium">{strategy.name}</span>
            </div>
            <div className="w-1/6 text-right">{formatAllocationPercent(strategy.allocationPercent)}</div>
            <div className="w-1/6 text-right">{strategy.allocationAmount}</div>
            <div className="w-1/6 text-right">{strategy.estimatedAPY} APY</div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-[#f5f5f5] bg-[#f5f5f5]/30 px-4 py-4 md:px-3">
            <div className="pl-5 md:pl-8">
              <div className="mb-4 flex flex-wrap gap-2">
                {strategy.details.isVault && (
                  <Link
                    to="/vaults/$chainId/$vaultAddress"
                    params={{
                      chainId: strategy.details.chainId.toString(),
                      vaultAddress: strategy.details.vaultAddress
                    }}
                    className="flex items-center gap-1 bg-[#f5f5f5] px-3 py-1 text-sm transition-colors hover:bg-[#e5e5e5]"
                  >
                    Data
                  </Link>
                )}
                {strategy.details.isEndorsed && strategy.details.isVault && (
                  <a
                    href={`https://yearn.fi/v3/${strategy.details.chainId}/${strategy.details.vaultAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-[#f5f5f5] px-3 py-1 text-sm transition-colors hover:bg-[#e5e5e5]"
                  >
                    Vault
                    <ExternalLink className="w-3 h-3 text-[#4f4f4f]" />
                  </a>
                )}
                <a
                  href={`${CHAIN_ID_TO_BLOCK_EXPLORER[strategy.details.chainId]}/address/${strategy.details.vaultAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-[#f5f5f5] px-3 py-1 text-sm transition-colors hover:bg-[#e5e5e5]"
                >
                  <span className="hidden sm:inline">{strategy.details.vaultAddress}</span>
                  <span className="sm:hidden">{shortVaultAddress}</span>
                  <ExternalLink className="w-3 h-3 text-[#4f4f4f]" />
                </a>
              </div>
              <div className="space-y-1 text-sm">
                <div>Chain: {CHAIN_ID_TO_NAME[strategy.details.chainId]}</div>
                <div>
                  Management Fee:{' '}
                  {strategy.details.managementFee
                    ? `${(Number(strategy.details.managementFee) / 100).toFixed(0)}%`
                    : '0%'}
                </div>
                <div>
                  Performance Fee:{' '}
                  {strategy.details.performanceFee
                    ? `${(Number(strategy.details.performanceFee) / 100).toFixed(0)}%`
                    : '0%'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)
