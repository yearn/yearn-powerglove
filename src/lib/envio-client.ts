const ENVIO_GRAPHQL_URL = import.meta.env.VITE_PUBLIC_ENVIO_GRAPHQL_URL || 'http://localhost:8080/v1/graphql'

const headers: Record<string, string> = {
  'Content-Type': 'application/json'
}

export async function queryEnvio<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENVIO_GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) {
    throw new Error(`Envio request failed: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> }

  if (json.errors && json.errors.length > 0) {
    throw new Error(`Envio GraphQL error: ${json.errors.map((e) => e.message).join(', ')}`)
  }

  return json.data as T
}
