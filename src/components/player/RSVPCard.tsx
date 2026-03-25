'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

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
  createdByMe?: boolean
  onRsvp: (status: 'in' | 'out' | null, note?: string) => Promise<void>
  isPast?: boolean
  pendingProposal?: PendingProposal | null
  onProposalResponse?: (proposalId: string, response: 'yes' | 'no') => Promise<void>
  onManage?: () => void
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
  createdByMe = false,
  onRsvp,
  isPast = false,
  pendingProposal,
  onProposalResponse,
  onManage,
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

  const hasButtons = !isPast || (createdByMe && !!onManage)

  return (
    <Card className={isPast ? 'opacity-70' : undefined}>
      <CardContent className="p-3 space-y-2">

        {/* 3-column main row */}
        <div className="flex gap-3">

          {/* Col 1: date / time / notes */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm">{formatDate(teeTime.date)}</p>
              {createdByMe && (
                <span title="You set up this tee time" className="inline-flex items-center rounded-full bg-blue-100 p-0.5 text-blue-700 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.563 2 12.162 2 7a11.8 11.8 0 0 1 .104-1.589.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.749Z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {formatTime(teeTime.start_time)} &bull; {teeTime.course}
              </p>
              {myRsvp.status === 'in' && !isPast && (
                <a href={buildGoogleCalendarUrl()} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline-offset-4 hover:underline hover:text-blue-800">
                  +&nbsp;Google Cal
                </a>
              )}
            </div>
            {invitedBy && (
              <p className="text-xs text-muted-foreground">Invited by {invitedBy}</p>
            )}
            {teeTime.notes && (
              <div className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                {teeTime.notes}
              </div>
            )}
            {myRsvp.note && !showNote && (
              <p className="text-xs text-muted-foreground italic">Your note: &ldquo;{myRsvp.note}&rdquo;</p>
            )}
            {!isPast && (
              <button type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setShowNote(v => !v)}>
                {showNote ? 'Hide note' : myRsvp.note ? 'Edit note' : 'Add a note'}
              </button>
            )}
          </div>

          {/* Col 2: who's in / pending */}
          {(myRsvp.status === 'in' || othersGoing.length > 0 || pendingPlayers.length > 0) && (
            <div className="w-[110px] shrink-0 space-y-0.5">
              {(myRsvp.status === 'in' || othersGoing.length > 0) && (
                <>
                  <p className="text-xs font-medium text-foreground">In</p>
                  {myRsvp.status === 'in' && (
                    <p className="text-xs text-muted-foreground truncate">You</p>
                  )}
                  {othersGoing.map(p => (
                    <p key={p.name} className="text-xs text-muted-foreground truncate">{p.name}</p>
                  ))}
                  {othersGoing.filter(p => p.note).map(p => (
                    <p key={p.name + '-note'} className="text-xs text-muted-foreground italic pl-1 truncate">&ldquo;{p.note}&rdquo;</p>
                  ))}
                </>
              )}
              {pendingPlayers.length > 0 && (
                <>
                  <p className="text-xs font-medium text-foreground mt-1">Pending</p>
                  {pendingPlayers.map(name => (
                    <p key={name} className="text-xs text-muted-foreground truncate">{name}</p>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Col 3: vertical button stack */}
          {hasButtons && (
            <div className="flex flex-col gap-1.5 shrink-0 w-[88px]">
              {!isPast && (
                <>
                  <Button
                    size="sm"
                    variant={myRsvp.status === 'in' ? 'default' : 'outline'}
                    className={`w-full text-xs font-semibold px-2 ${
                      myRsvp.status === 'in'
                        ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                        : myRsvp.status === 'requested_in'
                        ? 'border-amber-400 text-amber-600 bg-amber-50 cursor-not-allowed'
                        : 'border-green-400 text-green-700 hover:bg-green-50 hover:border-green-500'
                    }`}
                    onClick={() => handleRsvp('in')}
                    disabled={submitting || myRsvp.status === 'requested_in' || (isFull && myRsvp.status !== 'in')}
                  >
                    {submitting && pendingStatus === 'in'
                      ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      : myRsvp.status === 'requested_in' ? '⏳ Pending' : '✓ I\'m In'}
                  </Button>
                  <Button
                    size="sm"
                    variant={myRsvp.status === 'out' ? 'default' : 'outline'}
                    className={`w-full text-xs font-semibold px-2 ${
                      myRsvp.status === 'out'
                        ? 'bg-red-500 hover:bg-red-600 text-white border-red-500'
                        : 'border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400'
                    }`}
                    onClick={() => handleRsvp('out')}
                    disabled={submitting}
                  >
                    {submitting && pendingStatus === 'out'
                      ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      : '✕ I\'m Out'}
                  </Button>
                </>
              )}
              {createdByMe && onManage && (
                <button type="button" onClick={onManage}
                  className="w-full text-xs text-muted-foreground border border-border rounded-md py-1.5 hover:bg-muted hover:text-foreground transition-colors text-center">
                  Manage →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Full-width extras below the main row */}

        {isFull && !isPast && myRsvp.status !== 'in' && myRsvp.status !== 'requested_in' && (
          <p className="text-xs text-amber-600 font-medium">
            This tee time is full — all {teeTime.max_slots} slots are taken.
          </p>
        )}
        {myRsvp.status === 'requested_in' && !isPast && (
          <p className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
            Your request to rejoin is pending approval. Click &ldquo;I&apos;m Out&rdquo; to cancel it.
          </p>
        )}

        {showNote && !isPast && (
          <div className="space-y-1.5">
            <Textarea
              placeholder="e.g. I might be 5 min late…"
              value={note}
              onChange={e => { if (e.target.value.length <= 140) setNote(e.target.value) }}
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{note.length}/140</p>
              <Button type="button" size="sm" variant="outline" onClick={handleSaveNote} disabled={submitting}>
                {submitting && pendingStatus === null ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </div>
        )}

        {pendingProposal && !isPast && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 space-y-1.5">
            <p className="text-xs font-semibold text-blue-700">Proposed Change</p>
            <p className="text-xs text-blue-900">
              {formatDate(pendingProposal.proposed_date)} &bull; {formatTime(pendingProposal.proposed_start_time)} &bull; {pendingProposal.proposed_course}
            </p>
            {pendingProposal.myResponse === null && onProposalResponse ? (
              <div className="flex gap-2">
                <button type="button" disabled={proposalSubmitting}
                  onClick={async () => { setProposalSubmitting(true); try { await onProposalResponse(pendingProposal.id, 'yes') } finally { setProposalSubmitting(false) } }}
                  className="text-xs font-medium px-3 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                  Works for me
                </button>
                <button type="button" disabled={proposalSubmitting}
                  onClick={async () => { setProposalSubmitting(true); try { await onProposalResponse(pendingProposal.id, 'no') } finally { setProposalSubmitting(false) } }}
                  className="text-xs font-medium px-3 py-1 rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50">
                  Can&apos;t make it
                </button>
              </div>
            ) : (
              <p className="text-xs text-blue-600">
                {pendingProposal.myResponse === 'yes' ? '✓ You agreed — waiting on others.' : '✕ You declined this change.'}
              </p>
            )}
          </div>
        )}

        {showCalendarReminder && (
          <div className="flex items-start justify-between gap-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-800">
            <span>
              Did you add this to Google Calendar?{' '}
              <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium">Open Google Calendar</a>{' '}
              to remove it.
            </span>
            <button type="button" onClick={() => setShowCalendarReminder(false)} className="shrink-0 text-amber-600 hover:text-amber-900 font-bold leading-none" aria-label="Dismiss">×</button>
          </div>
        )}

      </CardContent>
    </Card>
  )
}
