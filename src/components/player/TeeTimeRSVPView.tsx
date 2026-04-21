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

interface PendingProposal {
  id: string
  proposed_date: string
  proposed_start_time: string
  proposed_course: string
  myResponse: string | null
}

interface TeeTimeRSVPViewProps {
  teeTime: TeeTime
  myRsvp: MyRsvp
  confirmedPlayers: ConfirmedPlayer[]
  pendingPlayers: string[]
  invitedBy?: string | null
  memberId: string
  pendingProposal?: PendingProposal | null
}

export function TeeTimeRSVPView({
  teeTime,
  myRsvp: initialRsvp,
  confirmedPlayers: initialConfirmedPlayers,
  pendingPlayers,
  invitedBy,
  memberId,
  pendingProposal: initialPendingProposal,
}: TeeTimeRSVPViewProps) {
  const router = useRouter()
  const [myRsvp, setMyRsvp] = useState<MyRsvp>(initialRsvp)
  const [confirmedPlayers, setConfirmedPlayers] = useState<ConfirmedPlayer[]>(initialConfirmedPlayers)
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null | undefined>(initialPendingProposal)

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

  async function handleProposalResponse(proposalId: string, response: 'yes' | 'no') {
    const res = await authFetch(`/api/proposals/${proposalId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response, memberId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to submit response.')
      throw new Error(data.error)
    }
    toast.success(response === 'yes' ? "Got it — waiting on others." : "Got it — the admin will be notified.")
    setPendingProposal(prev => prev ? { ...prev, myResponse: response } : prev)
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
        invitedBy={invitedBy}
        onRsvp={handleRsvp}
        pendingProposal={pendingProposal}
        onProposalResponse={handleProposalResponse}
      />
    </div>
  )
}
