import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import { type ChartDateRange, getChartDate } from '@/components/charts/chart-utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export function CustomTimeframePicker({
  value,
  active,
  onApply,
  className
}: {
  value: ChartDateRange | null
  active: boolean
  onApply: (range: ChartDateRange) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectingEnd, setSelectingEnd] = useState(false)
  const id = useId()
  const today = format(new Date(), 'yyyy-MM-dd')
  const valid = Boolean(start && end && getChartDate(start) && getChartDate(end) && start <= end && end <= today)
  const reversed = Boolean(start && end && start > end)
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const weekdays = Array.from({ length: 7 }, (_, index) => format(addDays(startOfWeek(month), index), 'EEEEE'))

  const selectDay = (date: string) => {
    if (!selectingEnd || date < start) {
      setStart(date)
      setEnd('')
      setSelectingEnd(true)
    } else {
      setEnd(date)
      setSelectingEnd(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setStart(value?.start ?? '')
          setEnd(value?.end ?? '')
          setMonth(startOfMonth(value ? parseISO(value.start) : new Date()))
          setSelectingEnd(false)
        }
        setOpen(nextOpen)
      }}
    >
      <DialogTrigger asChild>
        <button type="button" aria-pressed={active} className={className}>
          Custom
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg p-4 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Custom timeframe</DialogTitle>
          <DialogDescription>Pick a start and end date. Both dates are included.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid) return
            onApply({ start, end })
            setOpen(false)
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label htmlFor={`${id}-start`} className="space-y-1 text-sm">
              <span>Start date</span>
              <Input
                id={`${id}-start`}
                type="date"
                required
                max={today}
                value={start}
                className="min-w-0"
                onChange={(event) => {
                  const date = event.target.value
                  setStart(date)
                  if (getChartDate(date)) setMonth(startOfMonth(parseISO(date)))
                }}
              />
            </label>
            <label htmlFor={`${id}-end`} className="space-y-1 text-sm">
              <span>End date</span>
              <Input
                id={`${id}-end`}
                type="date"
                required
                min={start || undefined}
                max={today}
                value={end}
                className="min-w-0"
                onChange={(event) => {
                  const date = event.target.value
                  setEnd(date)
                  if (getChartDate(date)) setMonth(startOfMonth(parseISO(date)))
                }}
              />
            </label>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                onClick={() => setMonth(addMonths(month, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium" aria-live="polite">
                {format(month, 'MMMM yyyy')}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Next month"
                disabled={format(month, 'yyyy-MM') >= today.slice(0, 7)}
                onClick={() => setMonth(addMonths(month, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 text-center">
              {weekdays.map((day, index) => (
                <span key={`${index}-${day}`} className="py-2 text-xs text-gray-500">
                  {day}
                </span>
              ))}
              {days.map((day, index) => {
                const date = format(day, 'yyyy-MM-dd')
                const boundary = date === start || date === end
                const inRange = Boolean(start && end && date >= start && date <= end)
                return (
                  <button
                    key={date}
                    type="button"
                    aria-label={format(day, 'MMMM d, yyyy')}
                    aria-pressed={boundary || inRange}
                    aria-current={date === today ? 'date' : undefined}
                    disabled={date > today}
                    style={index === 0 ? { gridColumnStart: day.getDay() + 1 } : undefined}
                    className={`h-10 rounded-md text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0657f9] disabled:opacity-30 ${boundary ? 'bg-[#0657f9] text-white' : inRange ? 'bg-blue-50 text-[#0657f9]' : 'hover:bg-gray-100'}`}
                    onClick={() => selectDay(date)}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-500" aria-live="polite">
              {selectingEnd ? 'Select the end date.' : 'Select a start date, then an end date.'}
            </p>
          </div>
          {reversed && (
            <p role="alert" className="text-sm text-red-600">
              End date must be on or after start date.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid}>
              Apply range
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
