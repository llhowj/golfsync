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
  max_slots: number
  notes?: string | null
}

interface MyRsvp {
  status: 'in' | 'out' | 'pending' | 'requested_in'
  note: string | null
}

interface ConfirmedPlayer {
  name: string
  note: string | null
}

interface PendingProposal {
  id: string
  proposed_date: string
  proposed_start_time: string
  proposed_course: string
  myResponse: string | null
}

interface RSVPCardProps {
  teeTime: TeeTimeInfo
  myRsvp: MyRsvp
  confirmedPlayers: ConfirmedPlayer[]
  pendingPlayers?: string[]
  invitedBy?: string | null
  onRsvp: (status: 'in' | 'out' | null, note?: string) => Promise<void>
  isPast?: boolean
  pendingProposal?: PendingProposal | null
  onProposalResponse?: (proposalId: string, response: 'yes' | 'no') => Promise<void>
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
  pendingPlayers = [],
  invitedBy,
  onRsvp,
  isPast = false,
  pendingProposal,
  onProposalResponse,
}: RSVPCardProps) {
  const [note, setNote] = useState(myRsvp.note ?? '')
  const [showNote, setShowNote] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<'in' | 'out' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showCalendarReminder, setShowCalendarReminder] = useState(false)
  const [proposalSubmitting, setProposalSubmitting] = useState(false)

  async function handleRsvp(status: 'in' | 'out') {
    if (submitting) return
    const wasIn = myRsvp.status === 'in'
    setPendingStatus(status)
    setSubmitting(true)
    try {
      await onRsvp(status, note.trim() || undefined)
      if (wasIn && status === 'out') setShowCalendarReminder(true)
      else setShowCalendarReminder(false)
    } finally {
      setSubmitting(false)
      setPendingStatus(null)
    }
  }

  async function handleSaveNote() {
    if (submitting) return
    setPendingStatus(null)
    setSubmitting(true)
    try {
      await onRsvp(null, note.trim() || undefined)
      setShowNote(false)
    } finally {
      setSubmitting(false)
    }
  }

  const statusLabel =
    myRsvp.status === 'in'
      ? 'You are IN'
      : myRsvp.status === 'out'
      ? 'You are OUT'
      : myRsvp.status === 'requested_in'
      ? 'Request pending'
      : 'Awaiting your RSVP'

  const statusColor =
    myRsvp.status === 'in'
      ? 'text-green-600'
      : myRsvp.status === 'out'
      ? 'text-red-500'
      : myRsvp.status === 'requested_in'
      ? 'text-amber-600'
      : 'text-muted-foreground'

  const othersGoing = confirmedPlayers

  const totalIn = confirmedPlayers.length + (myRsvp.status === 'in' ? 1 : 0)
  const isFull = totalIn >= teeTime.max_slots

  function buildGoogleCalendarUrl() {
    const [year, month, day] = teeTime.date.split('-').map(Number)
    const [hour, minute] = teeTime.start_time.split(':').map(Number)
    const pad = (n: number) => String(n).padStart(2, '0')
    const start = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`
    const endHour = hour + 5
    const end = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(minute)}00`
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Golf — ${teeTime.course}`,
      dates: `${start}/${end}`,
      location: teeTime.course,
    })
    return `https://www.google.com/calendar/render?${params.toString()}`
  }

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
            {invitedBy && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Invited by: {invitedBy}
              </p>
            )}
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 text-xs font-medium ${
              myRsvp.status === 'in'
                ? 'border-green-400 text-green-600 bg-green-50'
                : myRsvp.status === 'out'
                ? 'border-red-400 text-red-500 bg-red-50'
                : myRsvp.status === 'requested_in'
                ? 'border-amber-400 text-amber-600 bg-amber-50'
                : 'border-border text-muted-foreground'
            }`}
          >
            {myRsvp.status === 'in'
              ? '✓ In'
              : myRsvp.status === 'out'
              ? '✕ Out'
              : myRsvp.status === 'requested_in'
              ? '⏳ Requested'
              : 'Pending'}
          </Badge>
        </div>

        {/* Admin note */}
        {teeTime.notes && (
          <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground flex items-baseline justify-between gap-4">
            <span>{teeTime.notes}</span>
            {invitedBy && (
              <span className="text-xs shrink-0">— {invitedBy.split(' ')[0]}</span>
            )}
          </div>
        )}

        {/* Who else is going / pending */}
        {(othersGoing.length > 0 || pendingPlayers.length > 0) && (
          <div className="text-sm space-y-1">
            {othersGoing.length > 0 && (
              <>
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Also playing: </span>
                  {othersGoing.map((p) => p.name).join(', ')}
                </div>
                {othersGoing.filter((p) => p.note).map((p) => (
                  <p key={p.name} className="text-xs text-muted-foreground italic pl-1">
                    {p.name}: &ldquo;{p.note}&rdquo;
                  </p>
                ))}
              </>
            )}
            {pendingPlayers.length > 0 && (
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">Pending: </span>
                {pendingPlayers.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Current status */}
        <div className="flex items-center gap-3">
          <p className={`text-sm font-medium ${statusColor}`}>{statusLabel}</p>
          {myRsvp.status === 'in' && !isPast && (
            <a
              href={buildGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
            >
              + Add to Google Calendar
            </a>
          )}
        </div>

        {/* Calendar reminder */}
        {showCalendarReminder && (
          <div className="flex items-start justify-between gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            <span>
              Did you add this to Google Calendar?{' '}
              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 font-medium"
              >
                Open Google Calendar
              </a>{' '}
              to remove it.
            </span>
            <button
              type="button"
              onClick={() => setShowCalendarReminder(false)}
              className="shrink-0 text-amber-600 hover:text-amber-900 font-bold leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Note from previous RSVP */}
        {myRsvp.note && !showNote && (
          <p className="text-xs text-muted-foreground italic">
            Your note: &ldquo;{myRsvp.note}&rdquo;
          </p>
        )}

        {/* Proposed change */}
        {pendingProposal && !isPast && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 space-y-2">
            <p className="text-xs font-semibold text-blue-700">Proposed Change</p>
            <p className="text-sm text-blue-900">
              {formatDate(pendingProposal.proposed_date)} &bull; {formatTime(pendingProposal.proposed_start_time)} &bull; {pendingProposal.proposed_course}
            </p>
            {pendingProposal.myResponse === null && onProposalResponse ? (
              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={proposalSubmitting}
                  onClick={async () => {
                    setProposalSubmitting(true)
                    try { await onProposalResponse(pendingProposal.id, 'yes') } finally { setProposalSubmitting(false) }
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Works for me
                </button>
                <button
                  type="button"
                  disabled={proposalSubmitting}
                  onClick={async () => {
                    setProposalSubmitting(true)
                    try { await onProposalResponse(pendingProposal.id, 'no') } finally { setProposalSubmitting(false) }
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Can&apos;t make it
                </button>
              </div>
            ) : (
              <p className="text-xs text-blue-600">
                {pendingProposal.myResponse === 'yes' ? '✓ You agreed to this change — waiting on others.' : '✕ You declined this change.'}
              </p>
            )}
          </div>
        )}

        {/* RSVP buttons */}
        {!isPast && (
          <div className="space-y-3">
            {myRsvp.status === 'requested_in' && (
              <p className="text-xs text-center text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Your request to rejoin is pending admin approval. Click &ldquo;I&apos;m Out&rdquo; to cancel it.
              </p>
            )}
            {isFull && myRsvp.status !== 'in' && myRsvp.status !== 'requested_in' && (
              <p className="text-xs text-center text-amber-600 font-medium">
                This tee time is full — all {teeTime.max_slots} slots are taken.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                variant={myRsvp.status === 'in' ? 'default' : 'outline'}
                className={`w-full text-base font-semibold h-14 ${
                  myRsvp.status === 'in'
                    ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                    : myRsvp.status === 'requested_in'
                    ? 'border-amber-400 text-amber-600 bg-amber-50 cursor-not-allowed'
                    : 'border-green-400 text-green-700 hover:bg-green-50 hover:border-green-500'
                }`}
                onClick={() => handleRsvp('in')}
                disabled={submitting || myRsvp.status === 'requested_in' || (isFull && myRsvp.status !== 'in')}
              >
                {submitting && pendingStatus === 'in' ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </span>
                ) : myRsvp.status === 'requested_in' ? (
                  <>⏳ Requested</>
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
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{note.length}/140</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSaveNote}
                    disabled={submitting}
                  >
                    {submitting && pendingStatus === null ? 'Saving...' : 'Save Note'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
