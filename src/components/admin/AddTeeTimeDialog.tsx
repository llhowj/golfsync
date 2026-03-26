'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/auth-fetch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface MemberOption {
  id: string
  name: string
}

interface RosterGroup {
  id: string
  name: string
  is_default: boolean
  memberIds: string[]
}

// One invite slot per player in the selected group
interface Slot {
  memberId: string   // who fills this slot
  defaultMemberId: string  // the original group member for this slot
  name: string       // display name when slot is at default
}

interface AddTeeTimeDialogProps {
  groupId: string
  homeCourse: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (teeTimeId: string) => void
  prefillDate?: string
  prefillTime?: string
  prefillCourse?: string
}

export function AddTeeTimeDialog({
  groupId,
  homeCourse,
  open,
  onOpenChange,
  onSuccess,
  prefillDate,
  prefillTime,
  prefillCourse,
}: AddTeeTimeDialogProps) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const [date, setDate] = useState(tomorrowStr)
  const [time, setTime] = useState('08:00')
  const [course, setCourse] = useState(homeCourse)
  const [maxSlots, setMaxSlots] = useState(4)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [rosterGroups, setRosterGroups] = useState<RosterGroup[]>([])
  const [allMembers, setAllMembers] = useState<MemberOption[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Inline add-to-roster state
  const [addPlayerOpen, setAddPlayerOpen] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerEmail, setNewPlayerEmail] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCourse(prefillCourse ?? homeCourse)
    setDate(prefillDate ?? tomorrowStr)
    setTime(prefillTime ?? '08:00')
    setMaxSlots(4)
    setNotes('')
    setError(null)
    setAddPlayerOpen(false)
    setNewPlayerName('')
    setNewPlayerEmail('')
    setAddPlayerError(null)
    setLoadingMembers(true)

    Promise.all([
      authFetch(`/api/roster-groups?groupId=${groupId}`).then(r => r.json()),
      authFetch(`/api/members?groupId=${groupId}`).then(r => r.json()),
    ]).then(([groupsData, membersData]) => {
      const groups: RosterGroup[] = groupsData.rosterGroups ?? []
      const members: Array<{
        id: string
        invited_name: string | null
        profiles: { name: string } | { name: string }[] | null
      }> = membersData.members ?? []

      const getName = (m: typeof members[0]) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
        return p?.name ?? m.invited_name ?? 'Unknown'
      }

      setRosterGroups(groups)
      setAllMembers(members.map(m => ({ id: m.id, name: getName(m) })).sort((a, b) => a.name.localeCompare(b.name)))

      // Default to the Default group
      const defaultGroup = groups.find(g => g.is_default) ?? groups[0]
      if (defaultGroup) {
        setSelectedGroupId(defaultGroup.id)
        buildSlots(defaultGroup, members.map(m => ({ id: m.id, name: getName(m) })))
      } else {
        setSelectedGroupId('')
        setSlots([])
      }
    }).finally(() => setLoadingMembers(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupId])

  function buildSlots(group: RosterGroup, memberOptions: MemberOption[]) {
    const memberMap = new Map(memberOptions.map(m => [m.id, m.name]))
    setSlots(
      group.memberIds.map(mid => ({
        memberId: mid,
        defaultMemberId: mid,
        name: memberMap.get(mid) ?? 'Unknown',
      }))
    )
  }

  function handleGroupChange(newGroupId: string | null) {
    if (!newGroupId) return
    setSelectedGroupId(newGroupId)
    const group = rosterGroups.find(g => g.id === newGroupId)
    if (group) buildSlots(group, allMembers)
    else setSlots([])
  }

  function setSlotMember(index: number, memberId: string) {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, memberId } : s))
  }

  function getSlotOptions(slotIndex: number): MemberOption[] {
    const usedIds = new Set(slots.filter((_, i) => i !== slotIndex && slots[i].memberId !== 'none').map(s => s.memberId))
    return [
      ...allMembers.filter(m => !usedIds.has(m.id)),
      { id: 'none', name: 'None' },
    ]
  }

  async function handleAddPlayer() {
    setAddPlayerError(null)
    if (!newPlayerName.trim() || !newPlayerEmail.trim()) {
      setAddPlayerError('Name and email are required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newPlayerEmail)) {
      setAddPlayerError('Please enter a valid email address.')
      return
    }
    setAddingPlayer(true)
    try {
      const res = await authFetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          name: newPlayerName.trim(),
          email: newPlayerEmail.trim().toLowerCase(),
          playerType: 'core',
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddPlayerError(data.error ?? 'Failed to add player.'); return }

      const newMember: MemberOption = { id: data.member?.id, name: newPlayerName.trim() }
      setAllMembers(prev => [...prev, newMember])

      toast.success(`${newPlayerName.trim()} added to roster.`)
      setAddPlayerOpen(false)
      setNewPlayerName('')
      setNewPlayerEmail('')
    } finally {
      setAddingPlayer(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const inviteeIds = slots.map(s => s.memberId).filter(id => id !== 'none')

    try {
      const res = await authFetch('/api/tee-times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          date,
          time,
          course: course.trim(),
          maxSlots,
          inviteeIds,
          notes: notes.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to create tee time.')
        setSubmitting(false)
        return
      }

      toast.success('Tee time added! Players have been notified.')

      // Auto-open Google Calendar
      const [year, month, day] = date.split('-').map(Number)
      const [hour, minute] = time.split(':').map(Number)
      const pad = (n: number) => String(n).padStart(2, '0')
      const start = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`
      const end = `${year}${pad(month)}${pad(day)}T${pad(hour + 5)}${pad(minute)}00`
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 === 0 ? 12 : hour % 12
      const formattedTime = `${displayHour}:${pad(minute)} ${ampm}`
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: `Golf ${formattedTime} — ${course.trim()}`,
        dates: `${start}/${end}`,
        location: course.trim(),
      })
      window.open(`https://www.google.com/calendar/render?${params.toString()}`, '_blank')

      onSuccess(data.teeTime?.id ?? '')
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Tee Time</DialogTitle>
          <DialogDescription>
            Schedule a new round and invite your group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tt-date">Date</Label>
              <Input
                id="tt-date"
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tt-time">Tee Time</Label>
              <Input
                id="tt-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-course">Course</Label>
            <Input
              id="tt-course"
              type="text"
              placeholder="e.g. Pebble Beach Golf Links"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-slots">Max Players</Label>
            <Input
              id="tt-slots"
              type="number"
              min={1}
              max={8}
              value={maxSlots}
              onChange={(e) => setMaxSlots(parseInt(e.target.value, 10))}
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-notes">Note for Players <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <textarea
              id="tt-notes"
              rows={2}
              placeholder="e.g. Meet at the driving range 30 min early"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
          </div>

          {/* Invited players */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Invited Players</Label>
              {rosterGroups.length > 1 && (
                <Select value={selectedGroupId} onValueChange={handleGroupChange} disabled={loadingMembers || submitting}>
                  <SelectTrigger className="h-7 w-40 text-xs">
                    <SelectValue>
                      {rosterGroups.find(g => g.id === selectedGroupId)?.name ?? 'Select group…'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {rosterGroups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {loadingMembers ? (
              <p className="text-sm text-muted-foreground">Loading players...</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players in the Default group yet. Add players in Roster settings.</p>
            ) : (
              <div className="space-y-1.5">
                {slots.map((slot, index) => {
                  const options = getSlotOptions(index)
                  return (
                    <Select
                      key={index}
                      value={slot.memberId}
                      onValueChange={(v) => v && setSlotMember(index, v)}
                      disabled={submitting}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue>
                          {slot.memberId === 'none'
                            ? <span className="text-muted-foreground">None</span>
                            : (allMembers.find(m => m.id === slot.memberId)?.name ?? 'Unknown')}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {options.map(o => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name === 'None' ? <span className="text-muted-foreground">None</span> : o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                })}
              </div>
            )}

            {/* Inline add-to-roster */}
            {!loadingMembers && !addPlayerOpen && (
              <button
                type="button"
                onClick={() => setAddPlayerOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                + Add new player to roster
              </button>
            )}

            {addPlayerOpen && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 mt-1">
                <p className="text-xs font-medium">Add to roster</p>
                {addPlayerError && (
                  <p className="text-xs text-destructive">{addPlayerError}</p>
                )}
                <Input
                  placeholder="Name"
                  value={newPlayerName}
                  onChange={e => setNewPlayerName(e.target.value)}
                  className="h-8 text-sm"
                  disabled={addingPlayer}
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={newPlayerEmail}
                  onChange={e => setNewPlayerEmail(e.target.value)}
                  className="h-8 text-sm"
                  disabled={addingPlayer}
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleAddPlayer} disabled={addingPlayer}>
                    {addingPlayer ? 'Adding...' : 'Add to Roster'}
                  </Button>
                  <Button
                    type="button" size="sm" variant="ghost"
                    onClick={() => { setAddPlayerOpen(false); setAddPlayerError(null) }}
                    disabled={addingPlayer}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loadingMembers}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </span>
              ) : (
                'Add Tee Time'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
