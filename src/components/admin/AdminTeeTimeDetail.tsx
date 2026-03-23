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
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

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
  notes?: string | null
  deleted_at: string | null
  rsvps: RsvpEntry[]
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
  const [backups, setBackups] = useState<BackupMember[]>([])
  const [selectedBackup, setSelectedBackup] = useState('')
  const [inviting, setInviting] = useState(false)
  const [togglingMemberId, setTogglingMemberId] = useState<string | null>(null)

  const inPlayers = teeTime.rsvps.filter((r) => r.status === 'in')
  const pendingPlayers = teeTime.rsvps.filter((r) => r.status === 'pending')
  const requestedInPlayers = teeTime.rsvps.filter((r) => r.status === 'requested_in')
  const outPlayers = teeTime.rsvps.filter((r) => r.status === 'out')
  const openSlots = teeTime.max_slots - inPlayers.length

  // Invited member IDs (already have an invite)
  const invitedMemberIds = new Set(teeTime.rsvps.map((r) => r.member?.id).filter(Boolean))

  useEffect(() => {
    if (openSlots <= 0) return
    authFetch(`/api/members?groupId=${groupId}`)
      .then(r => r.json())
      .then(data => {
        const available = (data.members ?? [])
          .filter((m: { id: string; player_type: string }) =>
            m.player_type === 'backup' && !invitedMemberIds.has(m.id)
          )
          .map((m: { id: string; invited_name: string | null; profiles: { name: string } | { name: string }[] | null }) => {
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
            return { id: m.id, name: profile?.name ?? m.invited_name ?? 'Unknown' }
          })
        setBackups(available)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, openSlots])

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
    if (!selectedBackup) return
    setInviting(true)
    try {
      const res = await authFetch(`/api/tee-times/${teeTime.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selectedBackup }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to invite player.'); return }
      toast.success('Backup player invited.')
      setSelectedBackup('')
      onRefresh()
      onClose()
    } catch {
      toast.error('Network error — please try again.')
    } finally {
      setInviting(false)
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
      text: `Golf — ${teeTime.course}`,
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
            {formatTime(teeTime.start_time)} &bull; {teeTime.course}
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
                  const name = r.member?.invited_name ?? p?.name ?? 'Unknown'
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
                  const name = r.member?.invited_name ?? p?.name ?? 'Unknown'
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
                  const name = r.member?.invited_name ?? p?.name ?? 'Unknown'
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
                  const name = r.member?.invited_name ?? p?.name ?? 'Unknown'
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

          {/* Invite backup */}
          {!teeTime.deleted_at && openSlots > 0 && backups.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Invite Backup Player
                </p>
                <div className="flex gap-2">
                  <Select value={selectedBackup} onValueChange={(v) => setSelectedBackup(v ?? '')}>
                    <SelectTrigger className="flex-1">
                      <SelectValue>
                        {selectedBackup
                          ? (backups.find(m => m.id === selectedBackup)?.name ?? 'Player')
                          : <span className="text-muted-foreground">Select backup player...</span>}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {backups.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInviteBackup} disabled={!selectedBackup || inviting} size="sm">
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
                    All players will be notified that this tee time has been cancelled.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep It</AlertDialogCancel>
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
