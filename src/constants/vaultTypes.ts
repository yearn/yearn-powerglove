export const VAULT_TYPES: {
  [key: string]: { id: number; name: string; icon?: string }
} = {
  'Tranched Vault': {
    id: 6,
    name: 'Tranched Vault'
  },
  'Allocator Vault': {
    id: 1,
    name: 'Allocator Vault',
    icon: '/placeholder-allocator-icon.svg'
  },
  'Strategy Vault': {
    id: 2,
    name: 'Strategy Vault',
    icon: '/placeholder-strategy-icon.svg'
  },
  'Factory Vault': {
    id: 3,
    name: 'Factory Vault',
    icon: '/placeholder-factory-icon.svg'
  },
  'Legacy Vault': {
    id: 4,
    name: 'Legacy Vault',
    icon: '/placeholder-legacy-icon.svg'
  },
  'External Vault': {
    id: 5,
    name: 'External Vault',
    icon: '/placeholder-external-icon.svg'
  }
}

export const VAULT_TYPE_LIST = Object.keys(VAULT_TYPES)
