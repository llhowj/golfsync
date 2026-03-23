import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface RsvpEntry {
  id?: string
  status: 'in' | 'out' | 'pending' | 'requested_in'
  note?: string | null
  member: {
    id?: string
    invited_name: string | null
    profiles: { name: string } | { name: string }[] | null
  } | null
}

interface TeeTime {
  id: string
  date: string
  start_time: string
  course: string
  max_slots: number
  deleted_at: string | null
}

interface TeeTimeCardProps {
  teeTime: TeeTime
  rsvps: RsvpEntry[]
  onClick: () => void
}

function formatDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD — parse as local date to avoid UTC offset shifts
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(timeStr: string): string {
  // timeStr is HH:MM or HH:MM:SS
  const [hourStr, minuteStr] = timeStr.split(':')
  const hour = parseInt(hourStr, 10)
  const minute = minuteStr
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${minute} ${ampm}`
}

export function TeeTimeCard({ teeTime, rsvps, onClick }: TeeTimeCardProps) {
  const confirmedCount = rsvps.filter((r) => r.status === 'in').length
  const pendingCount = rsvps.filter((r) => r.status === 'pending').length
  const requestedCount = rsvps.filter((r) => r.status === 'requested_in').length
  const outCount = rsvps.filter((r) => r.status === 'out').length
  const hasOpenSlot = confirmedCount < teeTime.max_slots
  const isPast = new Date(teeTime.date) < new Date(new Date().toDateString())

  return (
    <Card
      className="cursor-pointer hover:border-foreground/30 transition-colors active:scale-[0.99]"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Top row: date + badges */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold leading-tight">{formatDate(teeTime.date)}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatTime(teeTime.start_time)} &bull; {teeTime.course}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant="secondary" className="text-xs font-medium">
              {confirmedCount}/{teeTime.max_slots}
            </Badge>
            {!isPast && hasOpenSlot && (
              <Badge
                variant="outline"
                className="text-xs border-amber-400 text-amber-600 bg-amber-50"
              >
                Open Slot
              </Badge>
            )}
            {teeTime.deleted_at && (
              <Badge variant="destructive" className="text-xs">
                Cancelled
              </Badge>
            )}
          </div>
        </div>

        {/* RSVP avatars */}
        {rsvps.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {rsvps.map((rsvp, i) => {
              const profile = Array.isArray(rsvp.member?.profiles) ? rsvp.member.profiles[0] : rsvp.member?.profiles
              const name = rsvp.member?.invited_name ?? profile?.name ?? 'Player'
              const initials = (name.trim()[0] ?? '?').toUpperCase()

              const statusColor =
                rsvp.status === 'in'
                  ? 'bg-green-100 text-green-700 ring-green-300'
                  : rsvp.status === 'out'
                  ? 'bg-red-100 text-red-700 ring-red-300'
                  : rsvp.status === 'requested_in'
                  ? 'bg-amber-100 text-amber-700 ring-amber-300'
                  : 'bg-muted text-muted-foreground ring-border'

              return (
                <div key={rsvp.id ?? i} className="relative">
                  <div
                    title={rsvp.note
                    ? `${name}: ${rsvp.status === 'requested_in' ? 'requested in' : rsvp.status} — "${rsvp.note}"`
                    : `${name}: ${rsvp.status === 'requested_in' ? 'requested in' : rsvp.status}`}
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold ring-1 ${statusColor}`}
                  >
                    {initials}
                  </div>
                  {rsvp.note && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-1 ring-white" />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* RSVP summary text */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {confirmedCount > 0 && (
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <span>✓</span> {confirmedCount} in
            </span>
          )}
          {pendingCount > 0 && (
            <span className="flex items-center gap-1">
              <span>–</span> {pendingCount} pending
            </span>
          )}
          {requestedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <span>⏳</span> {requestedCount} requested
            </span>
          )}
          {outCount > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <span>✕</span> {outCount} out
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
