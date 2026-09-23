import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, ExternalLink, Info } from 'lucide-react'
import React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CHAIN_ID_TO_BLOCK_EXPLORER, CHAIN_ID_TO_NAME } from '@/constants/chains'
import { useStrategyDebtEvidence } from '@/hooks/useStrategyDebtEvidence'
import { formatAllocationPercent, formatTvlDisplay } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Strategy } from '@/types/dataTypes'

interface StrategyRowProps {
  strategy: Strategy
  isExpanded: boolean
  onToggle: () => void
  isUnallocated?: boolean
}

const formatTokenAmount = (value: number) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 1 ? 6 : 8
  }).format(value)

const formatUsdPrice = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 1 ? 4 : 8
  }).format(value)

export const StrategyRow: React.FC<StrategyRowProps> = React.memo(
  ({ strategy, isExpanded, onToggle, isUnallocated = false }) => {
    const shortVaultAddress = `${strategy.details.vaultAddress.slice(0, 6)}...${strategy.details.vaultAddress.slice(-4)}`
    const shouldLoadDebtEvidence = isExpanded && strategy.valuationBasis === 'currentDebtUsd'
    const debtEvidence = useStrategyDebtEvidence(
      {
        chainId: strategy.details.parentVaultChainId,
        vaultAddress: strategy.details.parentVaultAddress,
        strategyAddress: strategy.details.vaultAddress,
        assetAddress: strategy.details.assetAddress,
        assetDecimals: strategy.details.assetDecimals
      },
      shouldLoadDebtEvidence
    )

    return (
      <div
        className={cn('border-t border-[#f5f5f5]', (strategy.allocationPercent === 0 || isUnallocated) && 'opacity-50')}
      >
        <button
          type="button"
          className={cn(
            'w-full cursor-pointer bg-transparent p-3 text-left hover:bg-[#f5f5f5]/50',
            isExpanded && 'bg-[#f5f5f5]/30'
          )}
          aria-expanded={isExpanded}
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
        </button>

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
                {strategy.valuationBasis === 'totalDebtUsd' && (
                  <div>NAV valuation basis: Kong {strategy.valuationBasis}</div>
                )}
                {strategy.valuationBasis === 'currentDebtUsd' && (
                  <div className="pt-1">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex cursor-help items-center gap-1 text-left font-medium"
                          >
                            Live NAV calculation
                            <Info className="h-3.5 w-3.5 text-[#808080]" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-80 leading-relaxed">
                          This live calculation reads current debt over RPC and combines it with a current DefiLlama
                          price. It may differ from other values on this site because each data source can update at a
                          different time.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <div className="mt-1 space-y-1 pl-4">
                      {debtEvidence.isPending && <div className="text-[#808080]">Reading live inputs…</div>}
                      {debtEvidence.data && (
                        <>
                          <div>
                            Current debt:{' '}
                            <a
                              href={debtEvidence.data.debtSourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#4f4f4f] hover:underline"
                              title={
                                debtEvidence.data.currentDebtRaw === null
                                  ? 'Open the vault strategies(address) field'
                                  : `${debtEvidence.data.currentDebtRaw.toString()} base units from strategies(address)`
                              }
                            >
                              {debtEvidence.data.currentDebtTokens === null
                                ? 'Unavailable from RPC'
                                : `${formatTokenAmount(debtEvidence.data.currentDebtTokens)} ${strategy.details.assetSymbol}`}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <div>
                            Underlying price:{' '}
                            {debtEvidence.data.priceUsd !== null && debtEvidence.data.priceSourceUrl ? (
                              <a
                                href={debtEvidence.data.priceSourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#4f4f4f] hover:underline"
                                title={
                                  debtEvidence.data.priceTimestamp
                                    ? `DefiLlama spot price at ${new Date(debtEvidence.data.priceTimestamp * 1000).toLocaleString()}`
                                    : 'DefiLlama spot price'
                                }
                              >
                                {formatUsdPrice(debtEvidence.data.priceUsd)} via DefiLlama
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              'Unavailable from DefiLlama'
                            )}
                          </div>
                          <div>
                            Live calculation: current debt × underlying price ={' '}
                            {debtEvidence.data.calculatedDebtUsd === null
                              ? 'Unavailable without both inputs'
                              : formatTvlDisplay(debtEvidence.data.calculatedDebtUsd)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)
