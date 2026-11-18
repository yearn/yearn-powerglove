export const VAULT_TYPES: {
  [key: string]: { id: number; name: string; icon?: string }
} = {
  'Single Asset': {
    id: 1,
    name: 'Single Asset',
    icon: '/placeholder-allocator-icon.svg'
  },
  'Tokenized Strategy': {
    id: 2,
    name: 'Tokenized Strategy',
    icon: '/placeholder-strategy-icon.svg'
  },
  'Factory Vault': {
    id: 3,
    name: 'Factory Vault',
    icon: '/placeholder-factory-icon.svg'
  },
  'External Vault': {
    id: 5,
    name: 'External Vault',
    icon: '/placeholder-external-icon.svg'
  }
}

export const VAULT_TYPE_LIST = Object.keys(VAULT_TYPES)
