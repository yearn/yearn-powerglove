import type { ChainId } from '@/constants/chains'

export const YVUSD_CHAIN_ID = 1 as ChainId
export const YVUSD_UNLOCKED_ADDRESS = '0x696d02Db93291651ED510704c9b286841d506987'
export const YVUSD_LOCKED_ADDRESS = '0xAaaFEa48472f77563961Cdb53291DEDfB46F9040'

const toAddressKey = (address: string) => address.toLowerCase()

export const isYvUsdAddress = (chainId: ChainId, address?: string) =>
  chainId === YVUSD_CHAIN_ID &&
  Boolean(address) &&
  [YVUSD_UNLOCKED_ADDRESS, YVUSD_LOCKED_ADDRESS].some((candidate) => toAddressKey(candidate) === address!.toLowerCase())
