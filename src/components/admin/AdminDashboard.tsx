'use client'

import { useEffect, useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { TeeTimeCard } from '@/components/admin/TeeTimeCard'
import { AddTeeTimeDialog } from '@/components/admin/AddTeeTimeDialog'
import { AdminTeeTimeDetail } from '@/components/admin/AdminTeeTimeDetail'
import { ManageRosterTab } from '@/components/admin/ManageRosterTab'

interface RsvpWithMember {
  id: string
  status: 'in' | 'out' | 'pending'
  note: string | null
  member: {
    id: string
    invited_name: string | null
    profiles: { name: string } | { name: string }[] | null
  } | null
}

interface TeeTimeWithRsvps {
  id: string
  date: string
  start_time: string
  course: string
  max_slots: number
  notes: string | null
  deleted_at: string | null
  rsvps: RsvpWithMember[]
}

interface GroupInfo {
  name: string
  home_course: string | null
}

interface AdminDashboardProps {
  groupId: string
  memberId: string
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-36 bg-muted rounded" />
        <div className="h-5 w-20 bg-muted rounded-full" />
      </div>
      <div className="h-3 w-24 bg-muted rounded" />
      <div className="flex gap-2 mt-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-6 w-6 rounded-full bg-muted" />)}
      </div>
    </div>
  )
}

export function AdminDashboard({ groupId, memberId }: AdminDashboardProps) {
  const [teeTimes, setTeeTimes] = useState<TeeTimeWithRsvps[]>([])
  const [pastTeeTimes, setPastTeeTimes] = useState<TeeTimeWithRsvps[]>([])
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedTeeTime, setSelectedTeeTime] = useState<TeeTimeWithRsvps | null>(null)

  const fetchTeeTimes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tee-times?groupId=${groupId}`)
      if (res.ok) {
        const data = await res.json()
        setTeeTimes(data.upcoming ?? [])
        setPastTeeTimes(data.past ?? [])
        setGroupInfo(data.group ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => { fetchTeeTimes() }, [fetchTeeTimes])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Admin Dashboard</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {groupInfo?.name ?? 'Your Group'}
          </h1>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="shrink-0">
          + Add Tee Time
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upcoming">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="upcoming" className="flex-1 sm:flex-none">Upcoming</TabsTrigger>
          <TabsTrigger value="past" className="flex-1 sm:flex-none">Past Rounds</TabsTrigger>
          <TabsTrigger value="roster" className="flex-1 sm:flex-none">Roster</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {loading ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : teeTimes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="text-4xl">📅</div>
              <p className="font-medium">No upcoming tee times</p>
              <p className="text-sm text-muted-foreground">
                Click &quot;Add Tee Time&quot; to schedule your next round.
              </p>
            </div>
          ) : (
            teeTimes.map((tt) => (
              <TeeTimeCard key={tt.id} teeTime={tt} rsvps={tt.rsvps} onClick={() => setSelectedTeeTime(tt)} />
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4 space-y-3">
          {loading ? (
            <><SkeletonCard /><SkeletonCard /></>
          ) : pastTeeTimes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="text-4xl">🏌️</div>
              <p className="font-medium">No past rounds yet</p>
              <p className="text-sm text-muted-foreground">Completed tee times will show up here.</p>
            </div>
          ) : (
            pastTeeTimes.map((tt) => (
              <TeeTimeCard key={tt.id} teeTime={tt} rsvps={tt.rsvps} onClick={() => setSelectedTeeTime(tt)} />
            ))
          )}
        </TabsContent>

        <TabsContent value="roster">
          <ManageRosterTab groupId={groupId} />
        </TabsContent>
      </Tabs>

      {/* Add Tee Time Dialog */}
      <AddTeeTimeDialog
        groupId={groupId}
        homeCourse={groupInfo?.home_course ?? ''}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => { setAddDialogOpen(false); fetchTeeTimes() }}
      />

      {/* Detail Sheet */}
      {selectedTeeTime && (
        <AdminTeeTimeDetail
          teeTime={selectedTeeTime}
          onClose={() => setSelectedTeeTime(null)}
          onRefresh={fetchTeeTimes}
        />
      )}
    </div>
  )
}
