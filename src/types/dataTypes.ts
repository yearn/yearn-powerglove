import type { ChainId } from '../constants/chains'

export type MainInfoPanelProps = {
  vaultId: string
  deploymentDate: string
  vaultName: string
  vaultAddress: string
  description: string
  vaultToken: {
    icon: string
    name: string
  }
  totalSupply: string
  network: {
    icon: string
    name: string
  }
  oneDayAPY: string
  thirtyDayAPY: string
  managementFee: string
  performanceFee: string
  apiVersion: string
  blockExplorerLink?: string
  yearnVaultLink?: string
}

export interface TimeseriesDataPoint {
  address?: string
  chainId?: ChainId
  label: string
  component?: string // Optional, as it's not present in TVL data points
  period: string
  time: string
  value: number | null
}

export interface Timeseries {
  address: string
  chainId: ChainId
  apy: TimeseriesDataPoint[]
  tvl: TimeseriesDataPoint[]
  pps: TimeseriesDataPoint[]
}

// Chart data point interface for type safety
export interface ChartDataPoint {
  date: string
  [key: string]: number | string | null
}

export type tvlChartData = {
  date: string
  TVL: number | null
}[]
export type ppsChartData = {
  date: string
  PPS: number | null
  time?: number
}[]

export type aprApyChartData = {
  date: string
  sevenDayApy: number | null
  thirtyDayApy: number | null
  derivedApr: number | null
  derivedApy: number | null
  oracleApr?: number | null
  oracleApy30dAvg?: number | null
}[]

type StrategyDetails = {
  chainId: ChainId
  vaultAddress: string
  managementFee: number
  performanceFee: number
  isVault: boolean
  isEndorsed?: boolean
}

// Define the type for strategy data
export type Strategy = {
  id: number
  name: string
  allocationPercent: number
  allocationAmount: string
  allocationAmountUsd: number
  estimatedAPY: string
  estimatedApySource?: 'ydaemon' | 'oracle' | 'graph'
  tokenSymbol: string
  tokenIconUri: string
  details: StrategyDetails
}

export type StrategyAllocationChartDatum = {
  id: string
  name: string
  value: number
  amount: string
  color?: string
}

export type VaultDebtData = {
  address: string
  currentDebt: string
  currentDebtUsd: number
  chainId?: ChainId
  name?: string
  erc4626?: boolean
  v3?: boolean
  yearn?: boolean
  apy?: {
    net: number
    InceptionNet: number
    grossApr: number
  }
  fees?: {
    managementFee: number
    performanceFee: number
  }
  assetIcon?: string
}
