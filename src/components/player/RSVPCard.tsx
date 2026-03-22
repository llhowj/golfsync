'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface TeeTimeInfo {
  id: string
  date: string
  start_time: string
  course: string
}

interface MyRsvp {
  status: 'in' | 'out' | 'pending'
  note: string | null
}

interface RSVPCardProps {
  teeTime: TeeTimeInfo
  myRsvp: MyRsvp
  confirmedPlayers: string[]
  onRsvp: (status: 'in' | 'out', note?: string) => Promise<void>
  isPast?: boolean
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(timeStr: string): string {
  const [hourStr, minuteStr] = timeStr.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${minuteStr} ${ampm}`
}

export function RSVPCard({
  teeTime,
  myRsvp,
  confirmedPlayers,
  onRsvp,
  isPast = false,
}: RSVPCardProps) {
  const [note, setNote] = useState(myRsvp.note ?? '')
  const [showNote, setShowNote] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<'in' | 'out' | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleRsvp(status: 'in' | 'out') {
    if (submitting) return
    setPendingStatus(status)
    setSubmitting(true)
    try {
      await onRsvp(status, note.trim() || undefined)
    } finally {
      setSubmitting(false)
      setPendingStatus(null)
    }
  }

  const statusLabel =
    myRsvp.status === 'in'
      ? 'You are IN'
      : myRsvp.status === 'out'
      ? 'You are OUT'
      : 'Awaiting your RSVP'

  const statusColor =
    myRsvp.status === 'in'
      ? 'text-green-600'
      : myRsvp.status === 'out'
      ? 'text-red-500'
      : 'text-muted-foreground'

  const othersGoing = confirmedPlayers.filter((name) => name !== undefined)

  return (
    <Card className={isPast ? 'opacity-70' : undefined}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{formatDate(teeTime.date)}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatTime(teeTime.start_time)} &bull; {teeTime.course}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 text-xs font-medium ${
              myRsvp.status === 'in'
                ? 'border-green-400 text-green-600 bg-green-50'
                : myRsvp.status === 'out'
                ? 'border-red-400 text-red-500 bg-red-50'
                : 'border-border text-muted-foreground'
            }`}
          >
            {myRsvp.status === 'in' ? '✓ In' : myRsvp.status === 'out' ? '✕ Out' : 'Pending'}
          </Badge>
        </div>

        {/* Who else is going */}
        {othersGoing.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Also going: </span>
            {othersGoing.join(', ')}
          </div>
        )}

        {/* Current status */}
        <p className={`text-sm font-medium ${statusColor}`}>{statusLabel}</p>

        {/* Note from previous RSVP */}
        {myRsvp.note && !showNote && (
          <p className="text-xs text-muted-foreground italic">
            Your note: &ldquo;{myRsvp.note}&rdquo;
          </p>
        )}

        {/* RSVP buttons */}
        {!isPast && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                variant={myRsvp.status === 'in' ? 'default' : 'outline'}
                className={`w-full text-base font-semibold h-14 ${
                  myRsvp.status === 'in'
                    ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                    : 'border-green-400 text-green-700 hover:bg-green-50 hover:border-green-500'
                }`}
                onClick={() => handleRsvp('in')}
                disabled={submitting}
              >
                {submitting && pendingStatus === 'in' ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </span>
                ) : (
                  <>✓ I&apos;m In</>
                )}
              </Button>

              <Button
                size="lg"
                variant={myRsvp.status === 'out' ? 'default' : 'outline'}
                className={`w-full text-base font-semibold h-14 ${
                  myRsvp.status === 'out'
                    ? 'bg-red-500 hover:bg-red-600 text-white border-red-500'
                    : 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400'
                }`}
                onClick={() => handleRsvp('out')}
                disabled={submitting}
              >
                {submitting && pendingStatus === 'out' ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </span>
                ) : (
                  <>✕ I&apos;m Out</>
                )}
              </Button>
            </div>

            {/* Add/edit note toggle */}
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline w-full text-center"
              onClick={() => setShowNote((v) => !v)}
            >
              {showNote ? 'Hide note' : myRsvp.note ? 'Edit your note' : 'Add a note (optional)'}
            </button>

            {showNote && (
              <div className="space-y-2">
                <Textarea
                  placeholder="e.g. I might be 5 min late…"
                  value={note}
                  onChange={(e) => {
                    if (e.target.value.length <= 140) setNote(e.target.value)
                  }}
                  rows={2}
                  className="resize-none text-sm"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {note.length}/140
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
