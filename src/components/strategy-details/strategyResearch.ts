import type { ChainId } from '@/constants/chains'

export type StrategyResearchAdapter =
  | { kind: 'morpho-v1'; destination: string }
  | { kind: 'erc4626-destination'; destination: string; assetSymbol: string }
  | { kind: 'pawn-lender' }
  | { kind: 'spark-lender'; destination: string }

export interface StrategyResearch {
  chainId: ChainId
  address: string
  name: string
  family: string
  parentVault: { chainId: ChainId; address: string; name: string }
  reviewedAt: string
  sourceDate: string
  sourceUrl: string
  capitalPath: string
  yieldSource: string
  exitPath: string
  dependencies: string[]
  researchGap: string
  adapter: StrategyResearchAdapter
}

export const YVUSDC_RESEARCH_PARENT = {
  chainId: 1 as const,
  address: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
  name: 'USDC-1 yVault'
}

// Research is configuration and interpretation, never a stored current balance or queue position.
// Mutable relationships are checked by the live adapters. Audit applicability is not inferred.
const common = {
  chainId: 1 as const,
  parentVault: YVUSDC_RESEARCH_PARENT,
  reviewedAt: '2026-09-16',
  sourceDate: '2026-07-13',
  sourceUrl: 'https://curation.yearn.fi/report/yearn-yvusdc/'
}

export const STRATEGY_RESEARCH: readonly StrategyResearch[] = [
  {
    ...common,
    address: '0x39c0aec5738ed939876245224afc7e09c8480a52',
    name: 'USDC to USDS Depositor',
    family: 'Nested allocator vault',
    capitalPath: 'USDC → USDS → yvUSDS-1',
    yieldSource: 'Underlying yvUSDS strategies.',
    exitPath: 'Redeem yvUSDS shares, then convert USDS to USDC.',
    dependencies: ['yvUSDS withdrawal queue', 'USDS / USDC conversion'],
    researchGap: 'Conversion slippage and recursive downstream exposure need additional adapters.',
    adapter: {
      kind: 'erc4626-destination',
      destination: '0x182863131f9a4630ff9e27830d945b1413e347e8',
      assetSymbol: 'USDS'
    }
  },
  {
    ...common,
    address: '0x7130570bcefcedbe9d15b5b11a33006156460f8f',
    name: 'USDC to sUSDS Lender',
    family: 'Savings depositor',
    capitalPath: 'USDC → DAI → USDS → sUSDS',
    yieldSource: 'Sky savings accrual.',
    exitPath: 'Redeem sUSDS and reverse the conversion route.',
    dependencies: ['Sky savings vault', 'Conversion liquidity and fees'],
    researchGap: 'The complete conversion route is not simulated by an ERC-4626 withdrawal read.',
    adapter: {
      kind: 'erc4626-destination',
      destination: '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
      assetSymbol: 'USDS'
    }
  },
  {
    ...common,
    address: '0x68aea7b82df6ccdf76235d46445ed83f85f845a3',
    name: 'Yearn USDC',
    family: 'Direct MetaMorpho vault',
    capitalPath: 'USDC → MetaMorpho → isolated lending markets',
    yieldSource: 'Borrower interest across curated markets.',
    exitPath: 'Withdraw through the MetaMorpho withdrawal queue.',
    dependencies: ['Underlying market liquidity', 'Collateral and oracle dependencies'],
    researchGap: 'Shared market liquidity can constrain simultaneous exits.',
    adapter: { kind: 'morpho-v1', destination: '0x68aea7b82df6ccdf76235d46445ed83f85f845a3' }
  },
  {
    ...common,
    address: '0xe63a2abc24cd9538398d825a4bfe5778d25687df',
    name: 'stcUSD / USDC Pawn Broker Market',
    family: 'Collateralized lending market',
    capitalPath: 'USDC → loans secured by stcUSD',
    yieldSource: 'Borrower interest.',
    exitPath: 'Withdraw available USDC; borrowed capital requires repayment or liquidation.',
    dependencies: ['Borrower repayment', 'stcUSD collateral'],
    researchGap: 'Collateral realization and stressed exit timing are not established by cash balances.',
    adapter: { kind: 'pawn-lender' }
  },
  {
    ...common,
    address: '0x654a7c4ae5ac3c853a99f8dbead2bc85090f753a',
    name: 'Spark USDC Lender',
    family: 'Lending pool depositor',
    capitalPath: 'USDC → Spark Lend',
    yieldSource: 'Supply interest.',
    exitPath: 'Withdraw USDC from the lending pool.',
    dependencies: ['Spark reserve liquidity', 'Reserve controls'],
    researchGap: 'Reserve utilization and pause controls are not yet collected.',
    adapter: { kind: 'spark-lender', destination: '0xc13e21b648a5ee794902342038ff3adab66be987' }
  }
]

export function getStrategyResearch(chainId: number, address: string): StrategyResearch | undefined {
  return STRATEGY_RESEARCH.find(
    (record) => record.chainId === chainId && record.address.toLowerCase() === address.toLowerCase()
  )
}

export function getVaultStrategyResearch(chainId: number, address: string): StrategyResearch[] {
  return STRATEGY_RESEARCH.filter(
    (record) =>
      record.parentVault.chainId === chainId && record.parentVault.address.toLowerCase() === address.toLowerCase()
  )
}
