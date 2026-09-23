type VaultEventsPaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function VaultEventsPagination({ currentPage, totalPages, onPageChange }: VaultEventsPaginationProps) {
  if (totalPages <= 1) return null

  const buttonClassName =
    'rounded-none border border-border px-2 py-1 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div className="flex items-center gap-2 text-xs text-[#808080]" aria-label="Event pages">
      <span className="whitespace-nowrap">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPageChange(1)} disabled={currentPage === 1} className={buttonClassName}>
          First
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={buttonClassName}
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={buttonClassName}
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={buttonClassName}
        >
          Last
        </button>
      </div>
    </div>
  )
}
