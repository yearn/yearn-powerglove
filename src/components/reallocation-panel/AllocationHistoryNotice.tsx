import type { AllocationHistoryIssue } from '@/types/reallocationTypes'

export function AllocationHistoryNotice({
  error,
  issues = []
}: {
  error?: string | null
  issues?: AllocationHistoryIssue[]
}) {
  if (!error && issues.length === 0) return null

  return (
    <div role="alert" className="border-b border-border px-4 py-3 text-sm">
      <p className="font-semibold">{error ? 'Allocation history unavailable' : 'Allocation history incomplete'}</p>
      {error && <p className="mt-1 text-muted-foreground">{error}. Any loaded history may be incomplete.</p>}
      {issues.length > 0 && (
        <>
          <p className="mt-1 text-muted-foreground">
            {issues.length} allocation {issues.length === 1 ? 'interval could' : 'intervals could'} not be verified and{' '}
            {issues.length === 1 ? 'is' : 'are'} omitted from the chart. Verified intervals remain available.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer">Affected intervals</summary>
            <ul className="mt-2 space-y-2">
              {issues.map(({ entryId, reason }) => (
                <li key={entryId} className="break-words [overflow-wrap:anywhere]">
                  <span className="font-mono text-xs">{entryId}</span>: {reason}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  )
}
