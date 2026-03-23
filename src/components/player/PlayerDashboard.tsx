'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { RSVPCard } from '@/components/player/RSVPCard'
import { authFetch } from '@/lib/auth-fetch'

interface RsvpStatus {
  status: 'in' | 'out' | 'pending' | 'requested_in'
  note: string | null
}

interface ConfirmedPlayer {
  name: string
  note: string | null
}

interface PlayerTeeTime {
  id: string
  member_id: string
  date: string
  start_time: string
  course: string
  max_slots: number
  invited_by: string | null
  myRsvp: RsvpStatus
  confirmedPlayers: ConfirmedPlayer[]
  pendingPlayers: string[]
}

interface PlayerDashboardProps {
  memberIds: string[]
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="h-3 w-32 bg-muted rounded" />
      </div>
      <div className="flex gap-3">
        <div className="h-12 flex-1 bg-muted rounded-lg" />
        <div className="h-12 flex-1 bg-muted rounded-lg" />
      </div>
    </div>
  )
}

export function PlayerDashboard({ memberIds }: PlayerDashboardProps) {
  const [teeTimes, setTeeTimes] = useState<PlayerTeeTime[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTeeTimes = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        memberIds.map((memberId) =>
          authFetch(`/api/player/tee-times?memberId=${memberId}`)
            .then((res) => (res.ok ? res.json() : { teeTimes: [] }))
            .then((data) => (data.teeTimes ?? []) as PlayerTeeTime[])
        )
      )

      // Flatten and deduplicate by tee time id (keep first occurrence)
      const seen = new Set<string>()
      const combined: PlayerTeeTime[] = []
      for (const list of results) {
        for (const tt of list) {
          if (!seen.has(tt.id)) {
            seen.add(tt.id)
            combined.push(tt)
          }
        }
      }

      // Sort: upcoming first (ascending), then past (descending)
      const today = new Date().toISOString().split('T')[0]!
      const upcoming = combined
        .filter((tt) => tt.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
      const past = combined
        .filter((tt) => tt.date < today)
        .sort((a, b) => b.date.localeCompare(a.date))

      setTeeTimes([...upcoming, ...past])
    } finally {
      setLoading(false)
    }
  }, [memberIds])

  useEffect(() => {
    fetchTeeTimes()
  }, [fetchTeeTimes])

  async function handleRsvp(teeTimeId: string, status: 'in' | 'out' | null, note?: string) {
    const tt = teeTimes.find((t) => t.id === teeTimeId)
    const effectiveStatus = status ?? tt?.myRsvp.status ?? 'pending'
    const memberId = tt?.member_id

    const res = await authFetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teeTimeId, memberId, status: effectiveStatus, note }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Failed to update RSVP.')
      throw new Error(data.error)
    }

    const effective = data.effectiveStatus ?? status
    if (status === null) {
      toast.success('Note saved.')
    } else if (effective === 'requested_in') {
      toast.success("Request sent — the admin will approve or decline.")
    } else {
      toast.success(effective === 'in' ? "You're in! See you on the course." : "Got it — you're out.")
    }

    await fetchTeeTimes()
  }

  const today = new Date().toISOString().split('T')[0]!
  const upcoming = teeTimes.filter((tt) => tt.date >= today)
  const past = teeTimes.filter((tt) => tt.date < today)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Tee Times</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tap a round to RSVP or update your response.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <div className="text-5xl">⛳</div>
          <p className="font-semibold text-lg">No tee times yet</p>
          <p className="text-muted-foreground text-sm max-w-xs">
            Your admin hasn&apos;t posted any upcoming rounds. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Upcoming
              </h2>
              {upcoming.map((tt) => (
                <RSVPCard
                  key={tt.id}
                  teeTime={tt}
                  myRsvp={tt.myRsvp}
                  confirmedPlayers={tt.confirmedPlayers}
                  pendingPlayers={tt.pendingPlayers}
                  invitedBy={tt.invited_by}
                  onRsvp={(status, note) => handleRsvp(tt.id, status, note)}
                />
              ))}
            </section>
          )}

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Past Rounds
              </h2>
              {past.map((tt) => (
                <RSVPCard
                  key={tt.id}
                  teeTime={tt}
                  myRsvp={tt.myRsvp}
                  confirmedPlayers={tt.confirmedPlayers}
                  pendingPlayers={tt.pendingPlayers}
                  invitedBy={tt.invited_by}
                  onRsvp={(status, note) => handleRsvp(tt.id, status ?? null, note)}
                  isPast
                />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
