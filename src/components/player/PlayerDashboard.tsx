'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { RSVPCard } from '@/components/player/RSVPCard'
import { AddTeeTimeDialog } from '@/components/admin/AddTeeTimeDialog'
import { AdminTeeTimeDetail } from '@/components/admin/AdminTeeTimeDetail'
import { authFetch } from '@/lib/auth-fetch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface RsvpStatus {
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

interface PlayerTeeTime {
  id: string
  member_id: string
  date: string
  start_time: string
  course: string
  max_slots: number
  invited_by: string | null
  created_by_me: boolean
  myRsvp: RsvpStatus
  confirmedPlayers: ConfirmedPlayer[]
  pendingPlayers: string[]
  requestedInCount: number
  pendingProposal: PendingProposal | null
}

interface AdminGroup {
  id: string
  name: string
  homeCourse: string
}

interface PlayerDashboardProps {
  memberIds: string[]
  adminGroups?: AdminGroup[]
}

type FilterMode = 'all' | 'mine'

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

export function PlayerDashboard({ memberIds, adminGroups = [] }: PlayerDashboardProps) {
  const [teeTimes, setTeeTimes] = useState<PlayerTeeTime[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterMode>('all')

  // Add tee time dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addGroupId, setAddGroupId] = useState<string | null>(null)

  // Manage dialog
  const [managingTeeTimeId, setManagingTeeTimeId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [managingTeeTime, setManagingTeeTime] = useState<any | null>(null)
  const [managingGroupId, setManagingGroupId] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

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

  // Fetch full tee time detail for admin manage dialog
  useEffect(() => {
    if (!managingTeeTimeId) { setManagingTeeTime(null); return }
    setLoadingDetail(true)
    authFetch(`/api/tee-times/${managingTeeTimeId}`)
      .then(r => r.json())
      .then(data => {
        setManagingTeeTime(data)
        setManagingGroupId(data.group_id ?? null)
      })
      .catch(() => toast.error('Failed to load tee time details.'))
      .finally(() => setLoadingDetail(false))
  }, [managingTeeTimeId])

  function handleOpenAdd() {
    if (adminGroups.length === 1) {
      setAddGroupId(adminGroups[0]!.id)
      setAddOpen(true)
    } else if (adminGroups.length > 1) {
      // For multi-group admins, default to first group; user can extend later
      setAddGroupId(adminGroups[0]!.id)
      setAddOpen(true)
    }
  }

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

  async function handleProposalResponse(proposalId: string, response: 'yes' | 'no', memberId: string) {
    const res = await authFetch(`/api/proposals/${proposalId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response, memberId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to respond.')
      return
    }
    if (data.status === 'accepted') {
      toast.success("Everyone agreed — the tee time has been updated! Remember to update your calendar.")
    } else if (data.status === 'rejected') {
      toast.info("You've declined the proposed change. The admin has been notified.")
    } else {
      toast.success("Your response has been recorded.")
    }
    await fetchTeeTimes()
  }

  const today = new Date().toISOString().split('T')[0]!
  const filtered = filter === 'mine' ? teeTimes.filter(tt => tt.created_by_me) : teeTimes
  const upcoming = filtered.filter((tt) => tt.date >= today)
  const past = filtered.filter((tt) => tt.date < today)

  const activeAddGroup = adminGroups.find(g => g.id === addGroupId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tee Times</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tap a round to RSVP or update your response.
          </p>
        </div>
        {adminGroups.length > 0 && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Add Tee Time
          </button>
        )}
      </div>

      {/* Filter toggle — only show if admin has tee times */}
      {adminGroups.length > 0 && teeTimes.some(tt => tt.created_by_me) && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('mine')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === 'mine'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Tee Times I Created
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="upcoming" className="flex-1 sm:flex-none font-semibold uppercase tracking-wider">
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="past" className="flex-1 sm:flex-none font-semibold uppercase tracking-wider">
              Past Rounds
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4">
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                <div className="text-5xl">⛳</div>
                <p className="font-semibold text-lg">No upcoming tee times</p>
                <p className="text-muted-foreground text-sm max-w-xs">
                  {adminGroups.length > 0
                    ? "Use the Add Tee Time button to schedule your first round."
                    : "Your admin hasn't posted any upcoming rounds. Check back soon!"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((tt) => (
                  <RSVPCard
                    key={tt.id}
                    teeTime={tt}
                    myRsvp={tt.myRsvp}
                    confirmedPlayers={tt.confirmedPlayers}
                    pendingPlayers={tt.pendingPlayers}
                    requestedInCount={tt.requestedInCount}
                    invitedBy={tt.invited_by}
                    createdByMe={tt.created_by_me}
                    onRsvp={(status, note) => handleRsvp(tt.id, status, note)}
                    pendingProposal={tt.pendingProposal}
                    onProposalResponse={(proposalId, response) => handleProposalResponse(proposalId, response, tt.member_id)}
                    onManage={tt.created_by_me ? () => setManagingTeeTimeId(tt.id) : undefined}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            {past.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                <div className="text-5xl">⛳</div>
                <p className="font-semibold text-lg">No past rounds yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {past.map((tt) => (
                  <RSVPCard
                    key={tt.id}
                    teeTime={tt}
                    myRsvp={tt.myRsvp}
                    confirmedPlayers={tt.confirmedPlayers}
                    pendingPlayers={tt.pendingPlayers}
                    invitedBy={tt.invited_by}
                    createdByMe={tt.created_by_me}
                    onRsvp={(status, note) => handleRsvp(tt.id, status ?? null, note)}
                    onManage={tt.created_by_me ? () => setManagingTeeTimeId(tt.id) : undefined}
                    isPast
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Add Tee Time dialog */}
      {activeAddGroup && (
        <AddTeeTimeDialog
          groupId={activeAddGroup.id}
          homeCourse={activeAddGroup.homeCourse}
          open={addOpen}
          onOpenChange={setAddOpen}
          onSuccess={() => { setAddOpen(false); fetchTeeTimes() }}
        />
      )}

      {/* Admin manage dialog */}
      {managingTeeTimeId && !loadingDetail && managingTeeTime && managingGroupId && (
        <AdminTeeTimeDetail
          teeTime={managingTeeTime}
          groupId={managingGroupId}
          onClose={() => setManagingTeeTimeId(null)}
          onRefresh={() => {
            fetchTeeTimes()
            // Re-fetch the detail so the dialog updates
            authFetch(`/api/tee-times/${managingTeeTimeId}`)
              .then(r => r.json())
              .then(setManagingTeeTime)
          }}
        />
      )}
    </div>
  )
}
