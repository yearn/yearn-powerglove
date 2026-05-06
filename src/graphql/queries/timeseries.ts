// src/graphql/queries/timeseries.ts
import { gql } from '@apollo/client'

export const GET_VAULT_TIMESERIES = gql`
  query VaultTimeseries(
    $chainId: Int!
    $address: String!
    $label: String!
    $component: String!
    $limit: Int
  ) {
    timeseries(
      chainId: $chainId
      address: $address
      label: $label
      component: $component
      limit: $limit
    ) {
      chainId
      address
      label
      component
      period
      time
      value
    }
  }
`

export const queryAPY = gql`
  query ApyQuery(
    $label: String!
    $chainId: Int
    $address: String
    $limit: Int
    $component: String
  ) {
    timeseries(
      label: $label
      chainId: $chainId
      address: $address
      limit: $limit
      component: $component
    ) {
      chainId
      address
      label
      component
      period
      time
      value
    }
  }
`

export const queryTVL = gql`
  query TvlQuery(
    $label: String!
    $chainId: Int
    $address: String
    $limit: Int
  ) {
    timeseries(
      label: $label
      chainId: $chainId
      address: $address
      limit: $limit
    ) {
      chainId
      address
      label
      period
      time
      value
    }
  }
`
// label is 'pps' and component is 'humanized'
export const queryPPS = gql`
  query PPSquery(
    $label: String!
    $component: String
    $address: String
    $limit: Int
  ) {
    timeseries(
      label: $label
      component: $component
      address: $address
      limit: $limit
    ) {
      chainId
      address
      label
      component
      period
      time
      value
    }
  }
`

export const queryReports = gql`
  query reportQuery($chainId: Int, $address: String) {
    vaultReports(chainId: $chainId, address: $address) {
      blockTime
      apr {
        net
      }
      gainUsd
      lossUsd
      totalGain
      totalGainUsd
      protocolFeesUsd
      totalFees
      totalFeesUsd
      eventName
      transactionHash
    }
  }
`
