'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RSVPCard } from '@/components/player/RSVPCard'
import { authFetch } from '@/lib/auth-fetch'

interface TeeTime {
  id: string
  date: string
  start_time: string
  course: string
  max_slots: number
}

interface MyRsvp {
  status: 'in' | 'out' | 'pending' | 'requested_in'
  note: string | null
}

interface ConfirmedPlayer {
  name: string
  note: string | null
}

interface TeeTimeRSVPViewProps {
  teeTime: TeeTime
  myRsvp: MyRsvp
  confirmedPlayers: ConfirmedPlayer[]
  pendingPlayers: string[]
  memberId: string
}

export function TeeTimeRSVPView({
  teeTime,
  myRsvp: initialRsvp,
  confirmedPlayers: initialConfirmedPlayers,
  pendingPlayers,
  memberId,
}: TeeTimeRSVPViewProps) {
  const router = useRouter()
  const [myRsvp, setMyRsvp] = useState<MyRsvp>(initialRsvp)
  const [confirmedPlayers, setConfirmedPlayers] = useState<ConfirmedPlayer[]>(initialConfirmedPlayers)

  async function handleRsvp(status: 'in' | 'out' | null, note?: string) {
    const effectiveStatus = status ?? myRsvp.status ?? 'pending'
    const res = await authFetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teeTimeId: teeTime.id, memberId, status: effectiveStatus, note }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Failed to update RSVP.')
      throw new Error(data.error)
    }

    const effective = data.effectiveStatus ?? effectiveStatus
    if (status === null) {
      toast.success('Note saved.')
    } else if (effective === 'requested_in') {
      toast.success("Request sent — the admin will approve or decline.")
    } else {
      toast.success(effective === 'in' ? "You're in! See you on the course." : "Got it — you're out.")
    }

    setMyRsvp({ status: effective as 'in' | 'out' | 'pending' | 'requested_in', note: note ?? null })

    // Refresh server data to get updated confirmed player list
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">RSVP</h1>
        <p className="text-sm text-muted-foreground">
          Let your group know if you can make it.
        </p>
      </div>

      <RSVPCard
        teeTime={teeTime}
        myRsvp={myRsvp}
        confirmedPlayers={confirmedPlayers}
        pendingPlayers={pendingPlayers}
        onRsvp={handleRsvp}
      />
    </div>
  )
}
