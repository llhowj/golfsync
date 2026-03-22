'use client'

import { useState } from 'react'
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
import { cn } from '@/lib/utils'

interface RsvpEntry {
  id?: string
  status: 'in' | 'out' | 'pending'
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

interface AdminTeeTimeDetailProps {
  teeTime: TeeTime
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

export function AdminTeeTimeDetail({ teeTime, onClose, onRefresh }: AdminTeeTimeDetailProps) {
  const [cancelling, setCancelling] = useState(false)

  const inPlayers = teeTime.rsvps.filter((r) => r.status === 'in')
  const pendingPlayers = teeTime.rsvps.filter((r) => r.status === 'pending')
  const outPlayers = teeTime.rsvps.filter((r) => r.status === 'out')

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
          <div className="flex items-center gap-3">
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
          </div>

          <Separator />

          {/* In */}
          {inPlayers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-600">
                In ({inPlayers.length})
              </p>
              <ul className="space-y-1.5">
                {inPlayers.map((r, i) => (
                  <li key={r.id ?? i} className="flex items-center gap-2 text-sm">
                    <span className="text-green-600">✓</span>
                    <span className="font-medium">{(() => { const p = Array.isArray(r.member?.profiles) ? r.member.profiles[0] : r.member?.profiles; return r.member?.invited_name ?? p?.name ?? 'Unknown' })()}</span>
                    {r.note && (
                      <span className="text-muted-foreground text-xs italic">&ldquo;{r.note}&rdquo;</span>
                    )}
                  </li>
                ))}
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
                {pendingPlayers.map((r, i) => (
                  <li key={r.id ?? i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>–</span>
                    <span>{(() => { const p = Array.isArray(r.member?.profiles) ? r.member.profiles[0] : r.member?.profiles; return r.member?.invited_name ?? p?.name ?? 'Unknown' })()}</span>
                  </li>
                ))}
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
                {outPlayers.map((r, i) => (
                  <li key={r.id ?? i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-red-500">✕</span>
                    <span>{(() => { const p = Array.isArray(r.member?.profiles) ? r.member.profiles[0] : r.member?.profiles; return r.member?.invited_name ?? p?.name ?? 'Unknown' })()}</span>
                    {r.note && (
                      <span className="text-muted-foreground text-xs italic">&ldquo;{r.note}&rdquo;</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {teeTime.rsvps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No RSVPs yet.
            </p>
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
