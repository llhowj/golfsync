'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Watch {
  id: string
  days_of_week: number[]
  earliest_time: string
  latest_time: string
  min_slots: number
  repeat: boolean
  is_active: boolean
}

interface WatchDialogProps {
  groupId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  existing?: Watch | null
}

export function WatchDialog({ groupId, open, onOpenChange, onSaved, existing }: WatchDialogProps) {
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([6, 0]) // Sat + Sun default
  const [earliestTime, setEarliestTime] = useState('07:00')
  const [latestTime, setLatestTime] = useState('10:00')
  const [minSlots, setMinSlots] = useState(4)
  const [repeat, setRepeat] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setDaysOfWeek(existing.days_of_week)
      setEarliestTime(existing.earliest_time.slice(0, 5))
      setLatestTime(existing.latest_time.slice(0, 5))
      setMinSlots(existing.min_slots)
      setRepeat(existing.repeat)
    } else {
      setDaysOfWeek([6, 0])
      setEarliestTime('07:00')
      setLatestTime('10:00')
      setMinSlots(4)
      setRepeat(true)
    }
    setError(null)
  }, [open, existing])

  function toggleDay(day: number) {
    setDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (daysOfWeek.length === 0) { setError('Select at least one day.'); return }
    if (earliestTime >= latestTime) { setError('Earliest time must be before latest time.'); return }

    setSubmitting(true)
    try {
      const payload = { groupId, daysOfWeek, earliestTime, latestTime, minSlots, repeat }
      const res = existing
        ? await authFetch(`/api/watches/${existing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await authFetch('/api/watches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save watch.'); return }
      onSaved()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit Watch' : 'New Tee Time Watch'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Days of Week</Label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    daysOfWeek.includes(i)
                      ? 'bg-green-600 text-white border-green-600'
                      : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="w-earliest">Earliest Tee Time</Label>
              <Input
                id="w-earliest"
                type="time"
                value={earliestTime}
                onChange={e => setEarliestTime(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-latest">Latest Tee Time</Label>
              <Input
                id="w-latest"
                type="time"
                value={latestTime}
                onChange={e => setLatestTime(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="w-slots">Minimum Open Slots Needed</Label>
            <Input
              id="w-slots"
              type="number"
              min={1}
              max={8}
              value={minSlots}
              onChange={e => setMinSlots(parseInt(e.target.value, 10))}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label>After First Match</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRepeat(false)}
                className={`flex-1 py-2 rounded-md text-sm border transition-colors ${
                  !repeat ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                Stop watching
              </button>
              <button
                type="button"
                onClick={() => setRepeat(true)}
                className={`flex-1 py-2 rounded-md text-sm border transition-colors ${
                  repeat ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                Keep watching
              </button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : existing ? 'Save Changes' : 'Create Watch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
