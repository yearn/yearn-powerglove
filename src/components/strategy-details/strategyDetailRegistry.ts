import { STRATEGY_RESEARCH, type StrategyResearch } from '@/components/strategy-details/strategyResearch'
import { YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS } from '@/constants/featuredVaults'
import { YVUSD_STRATEGY_ADDRESSES } from '@/constants/yvUsdStrategies'
import type { PendlePositionKey } from '@/lib/yvusd-reporting-client'

export type StrategyDetailTemplate =
  | 'researched'
  | 'morpho-compounder'
  | 'pendle'
  | 'leverage-looper'
  | 'katana-yvusd-compounder'
  | 'depositor'
  | 'lender'
  | 'lender-borrower'

type ParentVault = {
  chainId: number
  address: string
  name: string
}

type BaseStrategyDetailConfig = {
  chainId: number
  address: string
  template: StrategyDetailTemplate
  templateLabel: string
  parentVault?: ParentVault
}

export type MorphoCompounderConfig = BaseStrategyDetailConfig & {
  template: 'morpho-compounder'
  morphoVaultAddress: string
  morphoVaultUrl: string
  marketName: string
  curatorName: string
}

export type PendleStrategyConfig = BaseStrategyDetailConfig & {
  template: 'pendle'
  positionKey: PendlePositionKey
  marketName: string
}

export type LeverageLooperConfig = BaseStrategyDetailConfig & {
  template: 'leverage-looper'
  model: 'pawn-yvusd'
  collateralName: string
  borrowMarketName: string
}

export type KatanaYvUsdCompounderConfig = BaseStrategyDetailConfig & {
  template: 'katana-yvusd-compounder'
  destinationVault: ParentVault
  marketName: string
}

export type DepositorConfig = BaseStrategyDetailConfig & {
  template: 'depositor'
  depositPath: string
  marketName: string
  yieldSource: string
  liquidityDependency: string
}

export type LenderConfig = BaseStrategyDetailConfig & {
  template: 'lender'
  protocol: string
  suppliedAsset: string
  marketLabel?: string
}

export type LenderBorrowerConfig = BaseStrategyDetailConfig & {
  template: 'lender-borrower'
  protocol: string
  collateralAsset: string
  borrowedAsset: string
}

export type ResearchedStrategyConfig = BaseStrategyDetailConfig & { template: 'researched'; research: StrategyResearch }

export type StrategyDetailConfig =
  | ResearchedStrategyConfig
  | MorphoCompounderConfig
  | PendleStrategyConfig
  | LeverageLooperConfig
  | KatanaYvUsdCompounderConfig
  | DepositorConfig
  | LenderConfig
  | LenderBorrowerConfig

const yvUsdParent: ParentVault = {
  chainId: YVUSD_CHAIN_ID,
  address: YVUSD_UNLOCKED_ADDRESS,
  name: 'yvUSD'
}

/**
 * Transitional adapter for strategy-detail metadata.
 *
 * CMS strategy records currently expose names, descriptions and protocols, but
 * not a stable template discriminator or per-template configuration. Keeping
 * this registry typed makes that future CMS contract explicit and avoids
 * inferring mechanics from display names.
 */
export const STRATEGY_DETAIL_CONFIGS: readonly StrategyDetailConfig[] = [
  ...STRATEGY_RESEARCH.map(
    (research): ResearchedStrategyConfig => ({
      chainId: research.chainId,
      address: research.address,
      template: 'researched',
      templateLabel: research.family,
      parentVault: research.parentVault,
      research
    })
  ),
  {
    chainId: 1,
    address: YVUSD_STRATEGY_ADDRESSES.morpho,
    template: 'morpho-compounder',
    templateLabel: 'Morpho Compounder',
    parentVault: yvUsdParent,
    morphoVaultAddress: '0xF9bdDd4A9b3A45f980e11fDDE96e16364dDBEc49',
    morphoVaultUrl:
      'https://app.morpho.org/ethereum/vault/0xF9bdDd4A9b3A45f980e11fDDE96e16364dDBEc49/yearn-og-usdc#overview',
    marketName: 'Yearn OG USDC MetaMorpho vault',
    curatorName: 'Yearn'
  },
  {
    chainId: 1,
    address: YVUSD_STRATEGY_ADDRESSES.katana,
    template: 'katana-yvusd-compounder',
    templateLabel: 'Cross-chain compounder',
    parentVault: yvUsdParent,
    destinationVault: yvUsdParent,
    marketName: 'Katana yvUSDC vault'
  },
  {
    chainId: 1,
    address: YVUSD_STRATEGY_ADDRESSES.pawn,
    template: 'leverage-looper',
    templateLabel: 'Leverage looper',
    parentVault: yvUsdParent,
    model: 'pawn-yvusd',
    collateralName: 'stcUSD',
    borrowMarketName: 'Pawn Broker USDC market'
  },
  {
    chainId: 1,
    address: YVUSD_STRATEGY_ADDRESSES.grove,
    template: 'depositor',
    templateLabel: 'Grove USDS depositor',
    parentVault: yvUsdParent,
    depositPath: 'USDC → USDS → Grove',
    marketName: 'Grove USDS allocation',
    yieldSource: 'Grove allocation yield; composition requires verification',
    liquidityDependency: 'Grove withdrawal path and USDS conversion require verification'
  },
  {
    chainId: 1,
    address: YVUSD_STRATEGY_ADDRESSES.sUsds,
    template: 'depositor',
    templateLabel: 'Depositor',
    parentVault: yvUsdParent,
    depositPath: 'USDC → USDS → sUSDS',
    marketName: 'sUSDS savings vault',
    yieldSource: 'Sky Savings Rate',
    liquidityDependency: 'sUSDS redeemability'
  },
  {
    chainId: 1,
    address: YVUSD_STRATEGY_ADDRESSES.sUsdsPendle,
    template: 'pendle',
    templateLabel: 'Pendle principal-token strategy',
    parentVault: yvUsdParent,
    positionKey: 'sUsdsPendle',
    marketName: 'sUSDS principal-token market'
  },
  {
    chainId: 1,
    address: YVUSD_STRATEGY_ADDRESSES.usd3Pendle,
    template: 'pendle',
    templateLabel: 'Pendle principal-token strategy',
    parentVault: yvUsdParent,
    positionKey: 'usd3Pendle',
    marketName: 'USD3 principal-token market'
  }
] as const

export function getStrategyDetailConfig(chainId: number, address: string): StrategyDetailConfig | null {
  const normalizedAddress = address.toLowerCase()
  return (
    STRATEGY_DETAIL_CONFIGS.find(
      (config) => config.chainId === chainId && config.address.toLowerCase() === normalizedAddress
    ) ?? null
  )
}

export function getStrategyDetailSummary(config: StrategyDetailConfig): string {
  switch (config.template) {
    case 'researched':
      return `This strategy is a ${config.templateLabel.toLowerCase()}.`
    case 'morpho-compounder':
      return `This strategy is a ${config.templateLabel} that deposits into the ${config.marketName}.`
    case 'pendle':
      return `This strategy is a ${config.templateLabel} that deposits into the ${config.marketName}.`
    case 'leverage-looper':
      return `This strategy is a ${config.templateLabel} that supplies ${config.collateralName} and borrows through the ${config.borrowMarketName}.`
    case 'katana-yvusd-compounder':
      return `This strategy is a ${config.templateLabel} that deposits into the ${config.marketName}.`
    case 'depositor':
      return `This strategy is a ${config.templateLabel} that follows ${config.depositPath} into the ${config.marketName}.`
    case 'lender':
      return `This strategy is a ${config.templateLabel} that supplies ${config.suppliedAsset} to ${config.marketLabel ?? config.protocol}.`
    case 'lender-borrower':
      return `This strategy is a ${config.templateLabel} that supplies ${config.collateralAsset} and borrows ${config.borrowedAsset} on ${config.protocol}.`
  }
}
