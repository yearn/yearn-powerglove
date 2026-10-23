import type { Address } from 'viem'

export interface RegisteredDepositor {
  id: string
  label: string
  chainId: number
  address: Address
  vaultAddress?: Address
  source: string
}

export interface DirectDepositGroup {
  id: string
  label: string
  depositors: readonly RegisteredDepositor[]
}

const treasurySource =
  'https://github.com/yearn/governance-apps/blob/5cbcb43e8d0d4da4f70dea63825d893cbc526452/docs/apps/treasury/registry.json'

/** Holder labels only. Product membership, TVL, and overlap accounting remain canonical API data.
 * Treasury accounts are scoped to Ethereum, as in the pinned registry. Connector targets
 * were checked with vault() and MYT() on 2026-10-23; never infer a vault from its name.
 */
export const DIRECT_DEPOSIT_REGISTRY = [
  {
    id: 'treasury',
    label: 'Yearn treasury deposits',
    depositors: [
      {
        id: 'ychad',
        label: 'ychad.eth',
        chainId: 1,
        address: '0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52',
        source: treasurySource
      },
      {
        id: 'treasury',
        label: 'treasury.ychad.eth',
        chainId: 1,
        address: '0x93A62dA5a14C80f265DAbC077fCEE437B1a0Efde',
        source: treasurySource
      },
      {
        id: 'robo-treasury',
        label: 'Robo Treasury',
        chainId: 1,
        address: '0xEf77cc176c748d291EfB6CdC982c5744fC7211c8',
        source: treasurySource
      }
    ]
  },
  {
    id: 'alchemix',
    label: 'Alchemix deposits',
    depositors: [
      {
        id: 'alchemix-yvusd',
        label: 'USDC MYT · yvUSD connector',
        chainId: 1,
        address: '0xdFDC17F784e16D7634AC270911D98755C68Ae220',
        vaultAddress: '0x696d02Db93291651ED510704c9b286841d506987',
        source: 'https://etherscan.io/address/0xdFDC17F784e16D7634AC270911D98755C68Ae220#code'
      },
      {
        id: 'alchemix-base-usdc',
        label: 'USDC MYT · Base Yearn OG connector',
        chainId: 8453,
        address: '0x81050315679972C403327A562ddd33be2346A656',
        vaultAddress: '0xe7D0DBE3493830e2Ab62619211A2BfF0Fc60dB42',
        source: 'https://basescan.org/address/0x81050315679972C403327A562ddd33be2346A656'
      },
      {
        id: 'alchemix-weth',
        label: 'WETH MYT · WETH-1 connector',
        chainId: 1,
        address: '0x8AACC947c2f4E24D2Be4CBa4498f004079F35D87',
        vaultAddress: '0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0',
        source: 'https://etherscan.io/address/0x8AACC947c2f4E24D2Be4CBa4498f004079F35D87#code'
      }
    ]
  }
] as const satisfies readonly DirectDepositGroup[]
