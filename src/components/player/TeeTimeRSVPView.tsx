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
}

interface MyRsvp {
  status: 'in' | 'out' | 'pending'
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
  memberId: string
}

export function TeeTimeRSVPView({
  teeTime,
  myRsvp: initialRsvp,
  confirmedPlayers: initialConfirmedPlayers,
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

    if (status === null) {
      toast.success('Note saved.')
    } else {
      toast.success(status === 'in' ? "You're in! See you on the course." : "Got it — you're out.")
    }

    setMyRsvp({ status: effectiveStatus as 'in' | 'out' | 'pending', note: note ?? null })

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
        onRsvp={handleRsvp}
      />
    </div>
  )
}
