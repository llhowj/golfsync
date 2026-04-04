'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/auth-fetch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { CourseLink } from '@/components/ui/CourseLink'

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

interface ProposalResponse {
  member_id: string
  response: string | null
}

interface PendingProposal {
  id: string
  proposed_date: string
  proposed_start_time: string
  proposed_course: string
  proposal_responses: ProposalResponse[]
}

interface TeeTime {
  id: string
  date: string
  start_time: string
  course: string
  max_slots: number
  notes?: string | null
  deleted_at: string | null
  rsvps: RsvpEntry[]
  pendingProposal?: PendingProposal | null
}

interface BackupMember {
  id: string
  name: string
}

interface AdminTeeTimeDetailProps {
  teeTime: TeeTime
  groupId: string
  onClose: () => void
  onRefresh: () => void
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(timeStr: string): string {
  const [hourStr, minuteStr] = timeStr.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${minuteStr} ${ampm}`
}

export function AdminTeeTimeDetail({ teeTime, groupId, onClose, onRefresh }: AdminTeeTimeDetailProps) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelComment, setCancelComment] = useState('')
  const [uninvited, setUninvited] = useState<BackupMember[]>([])
  const [selectedInvitee, setSelectedInvitee] = useState('')
  const [inviting, setInviting] = useState(false)
  const [togglingMemberId, setTogglingMemberId] = useState<string | null>(null)

  // Edit / propose change
  const [showEdit, setShowEdit] = useState(false)
  const [editDate, setEditDate] = useState(teeTime.date)
  const [editTime, setEditTime] = useState(teeTime.start_time.slice(0, 5))
  const [editCourse, setEditCourse] = useState(teeTime.course)
  const [proposing, setProposing] = useState(false)
  const [proposeError, setProposeError] = useState<string | null>(null)

  const inPlayers = teeTime.rsvps.filter((r) => r.status === 'in')
  const pendingPlayers = teeTime.rsvps.filter((r) => r.status === 'pending')
  const requestedInPlayers = teeTime.rsvps.filter((r) => r.status === 'requested_in')
  const outPlayers = teeTime.rsvps.filter((r) => r.status === 'out')
  const openSlots = teeTime.max_slots - inPlayers.length
  // Slots available for new invites: exclude "out" players so replacements can be invited
  const activeInvites = teeTime.rsvps.filter((r) => r.status !== 'out').length
  const inviteSlots = teeTime.max_slots - activeInvites
  const today = new Date().toISOString().split('T')[0]!
  const isUpcoming = teeTime.date >= today

  // Invited member IDs (already have an invite)
  const invitedMemberIds = new Set(teeTime.rsvps.map((r) => r.member?.id).filter(Boolean))

  useEffect(() => {
    if (inviteSlots <= 0 || !isUpcoming) return
    authFetch(`/api/members?groupId=${groupId}`)
      .then(r => r.json())
      .then(data => {
        const available = (data.members ?? [])
          .filter((m: { id: string }) => !invitedMemberIds.has(m.id))
          .map((m: { id: string; invited_name: string | null; profiles: { name: string } | { name: string }[] | null }) => {
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
            return { id: m.id, name: profile?.name ?? m.invited_name ?? 'Unknown' }
          })
        setUninvited(available)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, inviteSlots, isUpcoming])

  async function handleSetRsvp(memberId: string, newStatus: 'in' | 'out') {
    setTogglingMemberId(memberId)
    try {
      const res = await authFetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teeTimeId: teeTime.id, memberId, status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to update RSVP.')
        return
      }
      onRefresh()
    } catch {
      toast.error('Network error — please try again.')
    } finally {
      setTogglingMemberId(null)
    }
  }

  async function handleInviteBackup() {
    if (!selectedInvitee) return
    setInviting(true)
    try {
      const res = await authFetch(`/api/tee-times/${teeTime.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selectedInvitee }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to invite player.'); return }
      toast.success('Player invited.')
      setSelectedInvitee('')
      onRefresh()
    } catch {
      toast.error('Network error — please try again.')
    } finally {
      setInviting(false)
    }
  }

  async function handlePropose() {
    setProposeError(null)
    setProposing(true)
    try {
      const res = await authFetch(`/api/tee-times/${teeTime.id}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editDate, time: editTime, course: editCourse.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setProposeError(data.error ?? 'Failed to submit change.'); return }
      if (data.applied) {
        toast.success('Tee time updated.')
      } else {
        toast.success('Change proposed — waiting for players to confirm.')
      }
      setShowEdit(false)
      onRefresh()
    } catch {
      setProposeError('Network error — please try again.')
    } finally {
      setProposing(false)
    }
  }

  function buildGoogleCalendarUrl() {
    const [year, month, day] = teeTime.date.split('-').map(Number)
    const [hour, minute] = teeTime.start_time.split(':').map(Number)
    const pad = (n: number) => String(n).padStart(2, '0')
    const start = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`
    const end = `${year}${pad(month)}${pad(day)}T${pad(hour + 5)}${pad(minute)}00`
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Golf ${formatTime(teeTime.start_time)} — ${teeTime.course}`,
      dates: `${start}/${end}`,
      location: teeTime.course,
    })
    return `https://www.google.com/calendar/render?${params.toString()}`
  }

  async function handleCancel() {
    setCancelling(true)
    try {
      const res = await authFetch(`/api/tee-times/${teeTime.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: cancelComment.trim() || null }),
      })
      if (res.ok) {
        toast.success('Tee time cancelled.')
        onClose()
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to cancel tee time.')
      }
    } catch {
      toast.error('Network error — please try again.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatDate(teeTime.date)}</DialogTitle>
          <DialogDescription>
            {formatTime(teeTime.start_time)} &bull; <CourseLink course={teeTime.course} className="underline underline-offset-2 hover:text-foreground transition-colors" />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Slot summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {inPlayers.length}/{teeTime.max_slots} confirmed
            </Badge>
            {inPlayers.length < teeTime.max_slots && (
              <Badge
                variant="outline"
                className="text-sm border-amber-400 text-amber-600 bg-amber-50"
              >
                {teeTime.max_slots - inPlayers.length} open slot
                {teeTime.max_slots - inPlayers.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {!teeTime.deleted_at && (
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

          {teeTime.notes && (
            <div className="rounded-md bg-muted/50 border border-border px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Note: </span>{teeTime.notes}
            </div>
          )}

          {/* Pending proposal status */}
          {teeTime.pendingProposal && (() => {
            const p = teeTime.pendingProposal!
            const responses = p.proposal_responses
            const yesCount = responses.filter(r => r.response === 'yes').length
            const noCount = responses.filter(r => r.response === 'no').length
            const total = responses.length
            return (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-semibold text-blue-700">Proposed Change Awaiting Approval</p>
                <p className="text-sm">
                  {formatDate(p.proposed_date)} &bull; {formatTime(p.proposed_start_time)} &bull; {p.proposed_course}
                </p>
                <p className="text-xs text-blue-600">
                  {noCount > 0
                    ? `Declined by ${noCount} player${noCount > 1 ? 's' : ''} — change will not be applied.`
                    : `${yesCount}/${total} confirmed`}
                </p>
              </div>
            )
          })()}

          {/* Edit tee time */}
          {!teeTime.deleted_at && !showEdit && !teeTime.pendingProposal && (
            <button
              type="button"
              onClick={() => { setShowEdit(true); setProposeError(null) }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Edit tee time
            </button>
          )}

          {showEdit && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Propose Change</p>
              {proposeError && <p className="text-xs text-destructive">{proposeError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8 text-sm" disabled={proposing} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Time</Label>
                  <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="h-8 text-sm" disabled={proposing} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Course</Label>
                <Input type="text" value={editCourse} onChange={e => setEditCourse(e.target.value)} className="h-8 text-sm" disabled={proposing} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handlePropose} disabled={proposing}>
                  {proposing ? 'Submitting...' : 'Submit Change'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowEdit(false)} disabled={proposing}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* In */}
          {inPlayers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-600">
                In ({inPlayers.length})
              </p>
              <ul className="space-y-1.5">
                {inPlayers.map((r, i) => {
                  const p = Array.isArray(r.member?.profiles) ? r.member?.profiles[0] : r.member?.profiles
                  const name = p?.name ?? r.member?.invited_name ?? 'Unknown'
                  const memberId = r.member?.id
                  return (
                    <li key={r.id ?? i} className="flex items-center gap-2 text-sm">
                      <span className="text-green-600">✓</span>
                      <span className="font-medium flex-1">{name}</span>
                      {r.note && <span className="text-muted-foreground text-xs italic">&ldquo;{r.note}&rdquo;</span>}
                      {memberId && !teeTime.deleted_at && (
                        <button
                          onClick={() => handleSetRsvp(memberId, 'out')}
                          disabled={togglingMemberId === memberId}
                          className="text-xs text-muted-foreground hover:text-red-500 shrink-0"
                        >
                          Mark Out
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Pending */}
          {pendingPlayers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pending ({pendingPlayers.length})
              </p>
              <ul className="space-y-1.5">
                {pendingPlayers.map((r, i) => {
                  const p = Array.isArray(r.member?.profiles) ? r.member?.profiles[0] : r.member?.profiles
                  const name = p?.name ?? r.member?.invited_name ?? 'Unknown'
                  const memberId = r.member?.id
                  return (
                    <li key={r.id ?? i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>–</span>
                      <span className="flex-1">{name}</span>
                      {memberId && !teeTime.deleted_at && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleSetRsvp(memberId, 'in')}
                            disabled={togglingMemberId === memberId || openSlots <= 0}
                            className="text-xs text-muted-foreground hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={openSlots <= 0 ? 'Tee time is full' : undefined}
                          >
                            Mark In
                          </button>
                          <button
                            onClick={() => handleSetRsvp(memberId, 'out')}
                            disabled={togglingMemberId === memberId}
                            className="text-xs text-muted-foreground hover:text-red-500"
                          >
                            Mark Out
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Requested In */}
          {requestedInPlayers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Requested In ({requestedInPlayers.length})
              </p>
              {openSlots <= 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  Tee time is full — accepting will require marking someone else out first.
                </p>
              )}
              <ul className="space-y-1.5">
                {requestedInPlayers.map((r, i) => {
                  const p = Array.isArray(r.member?.profiles) ? r.member?.profiles[0] : r.member?.profiles
                  const name = p?.name ?? r.member?.invited_name ?? 'Unknown'
                  const memberId = r.member?.id
                  return (
                    <li key={r.id ?? i} className="flex items-center gap-2 text-sm">
                      <span className="text-amber-600">⏳</span>
                      <span className="flex-1 font-medium">{name}</span>
                      {r.note && <span className="text-muted-foreground text-xs italic">&ldquo;{r.note}&rdquo;</span>}
                      {memberId && !teeTime.deleted_at && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleSetRsvp(memberId, 'in')}
                            disabled={togglingMemberId === memberId || openSlots <= 0}
                            className="text-xs font-medium text-green-700 hover:text-green-900 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={openSlots <= 0 ? 'No open slots' : undefined}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleSetRsvp(memberId, 'out')}
                            disabled={togglingMemberId === memberId}
                            className="text-xs text-muted-foreground hover:text-red-500"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Out */}
          {outPlayers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-500">
                Out ({outPlayers.length})
              </p>
              <ul className="space-y-1.5">
                {outPlayers.map((r, i) => {
                  const p = Array.isArray(r.member?.profiles) ? r.member?.profiles[0] : r.member?.profiles
                  const name = p?.name ?? r.member?.invited_name ?? 'Unknown'
                  const memberId = r.member?.id
                  return (
                    <li key={r.id ?? i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="text-red-500">✕</span>
                      <span className="flex-1">{name}</span>
                      {r.note && <span className="text-muted-foreground text-xs italic">&ldquo;{r.note}&rdquo;</span>}
                      {memberId && !teeTime.deleted_at && (
                        <button
                          onClick={() => handleSetRsvp(memberId, 'in')}
                          disabled={togglingMemberId === memberId || openSlots <= 0}
                          className="text-xs text-muted-foreground hover:text-green-600 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={openSlots <= 0 ? 'Tee time is full' : undefined}
                        >
                          Mark In
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {teeTime.rsvps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No RSVPs yet.
            </p>
          )}

          {/* Invite player */}
          {!teeTime.deleted_at && isUpcoming && inviteSlots > 0 && uninvited.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Invite Player
                </p>
                <div className="flex gap-2">
                  <Select value={selectedInvitee} onValueChange={(v) => setSelectedInvitee(v ?? '')}>
                    <SelectTrigger className="flex-1">
                      <SelectValue>
                        {selectedInvitee
                          ? (uninvited.find(m => m.id === selectedInvitee)?.name ?? 'Player')
                          : <span className="text-muted-foreground">Select player...</span>}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {uninvited.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInviteBackup} disabled={!selectedInvitee || inviting} size="sm">
                    {inviting ? 'Inviting...' : 'Invite'}
                  </Button>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Cancel button */}
          {!teeTime.deleted_at && (
            <AlertDialog>
              <AlertDialogTrigger
                className={cn(buttonVariants({ variant: 'destructive' }), 'w-full')}
                disabled={cancelling}
              >
                Cancel Tee Time
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this tee time?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All players will be notified. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <textarea
                  placeholder="Reason for cancelling (optional) — included in the notification email"
                  value={cancelComment}
                  onChange={e => setCancelComment(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setCancelComment('')}>Keep It</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
