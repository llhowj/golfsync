'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { RSVPCard } from '@/components/player/RSVPCard'
import { authFetch } from '@/lib/auth-fetch'

interface RsvpStatus {
  status: 'in' | 'out' | 'pending'
  note: string | null
}

interface PlayerTeeTime {
  id: string
  date: string
  start_time: string
  course: string
  group_name: string
  myRsvp: RsvpStatus
  confirmedPlayers: string[]
}

interface PlayerDashboardProps {
  memberId: string
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

export function PlayerDashboard({ memberId }: PlayerDashboardProps) {
  const [teeTimes, setTeeTimes] = useState<PlayerTeeTime[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTeeTimes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/player/tee-times?memberId=${memberId}`)
      if (res.ok) {
        const data = await res.json()
        setTeeTimes(data.teeTimes ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    fetchTeeTimes()
  }, [fetchTeeTimes])

  async function handleRsvp(teeTimeId: string, status: 'in' | 'out', note?: string) {
    const res = await authFetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teeTimeId, memberId, status, note }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Failed to update RSVP.')
      throw new Error(data.error)
    }

    toast.success(status === 'in' ? "You're in! See you on the course." : "Got it — you're out.")

    // Optimistically update local state
    setTeeTimes((prev) =>
      prev.map((tt) =>
        tt.id === teeTimeId
          ? {
              ...tt,
              myRsvp: { status, note: note ?? null },
              confirmedPlayers:
                status === 'in'
                  ? tt.confirmedPlayers // server will return updated list; refetch for accuracy
                  : tt.confirmedPlayers,
            }
          : tt,
      ),
    )

    // Refetch to get the authoritative list of confirmed players
    await fetchTeeTimes()
  }

  const upcoming = teeTimes.filter((tt) => {
    const [y, m, d] = tt.date.split('-').map(Number)
    return new Date(y, m - 1, d) >= new Date(new Date().toDateString())
  })

  const past = teeTimes.filter((tt) => {
    const [y, m, d] = tt.date.split('-').map(Number)
    return new Date(y, m - 1, d) < new Date(new Date().toDateString())
  })

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
                  onRsvp={(status, note) => handleRsvp(tt.id, status, note)}
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
