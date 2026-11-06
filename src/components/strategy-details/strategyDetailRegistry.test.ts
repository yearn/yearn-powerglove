import { describe, expect, it } from 'vitest'
import { YVUSD_STRATEGY_ADDRESSES } from '@/constants/yvUsdStrategies'
import { getStrategyDetailConfig, getStrategyDetailSummary, STRATEGY_DETAIL_CONFIGS } from './strategyDetailRegistry'
import { getStrategyResearch, STRATEGY_RESEARCH } from './strategyResearch'

describe('strategy detail registry', () => {
  it('registers researched strategy pages and keeps the Pawn lender separate from the yvUSD looper', () => {
    for (const record of STRATEGY_RESEARCH)
      expect(getStrategyDetailConfig(record.chainId, record.address)?.template).toBe('researched')
    expect(getStrategyResearch(1, '0xe63a2abc24cd9538398d825a4bfe5778d25687df')?.adapter.kind).toBe('pawn-lender')
    expect(getStrategyDetailConfig(1, YVUSD_STRATEGY_ADDRESSES.pawn)?.template).toBe('leverage-looper')
    expect(getStrategyResearch(10, STRATEGY_RESEARCH[0].address)).toBeUndefined()
  })

  it('classifies every yvUSD strategy with an explicit template', () => {
    const expectedTemplates = {
      morpho: 'morpho-compounder',
      katana: 'katana-yvusd-compounder',
      pawn: 'leverage-looper',
      sUsds: 'depositor',
      grove: 'depositor',
      sUsdsPendle: 'pendle',
      usd3Pendle: 'pendle'
    } as const

    for (const [key, address] of Object.entries(YVUSD_STRATEGY_ADDRESSES)) {
      expect(getStrategyDetailConfig(1, address)?.template).toBe(
        expectedTemplates[key as keyof typeof expectedTemplates]
      )
    }
  })

  it('matches addresses case-insensitively and rejects other chains', () => {
    expect(getStrategyDetailConfig(1, YVUSD_STRATEGY_ADDRESSES.morpho.toUpperCase())?.template).toBe(
      'morpho-compounder'
    )
    expect(getStrategyDetailConfig(10, YVUSD_STRATEGY_ADDRESSES.morpho)).toBeNull()
  })

  it('does not contain duplicate chain and address entries', () => {
    const keys = STRATEGY_DETAIL_CONFIGS.map((config) => `${config.chainId}:${config.address.toLowerCase()}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('describes the template type and destination in plain language', () => {
    const morphoConfig = getStrategyDetailConfig(1, YVUSD_STRATEGY_ADDRESSES.morpho)
    expect(morphoConfig?.template === 'morpho-compounder' && morphoConfig.curatorName).toBe('Yearn')
    expect(morphoConfig && getStrategyDetailSummary(morphoConfig)).toBe(
      'This strategy is a Morpho Compounder that deposits into the Yearn OG USDC MetaMorpho vault.'
    )

    for (const config of STRATEGY_DETAIL_CONFIGS) {
      expect(getStrategyDetailSummary(config)).toMatch(/^This strategy is a .+\.$/)
    }
  })
})
