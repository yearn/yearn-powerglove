// src/lib/apollo-client.ts
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'

export const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: import.meta.env.VITE_PUBLIC_GRAPHQL_URL }),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first'
    }
  }
})
