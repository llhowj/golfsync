'use client'

import { useState } from 'react'
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

interface AddTeeTimeDialogProps {
  groupId: string
  homeCourse: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddTeeTimeDialog({
  groupId,
  homeCourse,
  open,
  onOpenChange,
  onSuccess,
}: AddTeeTimeDialogProps) {
  // Default to tomorrow's date
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const [date, setDate] = useState(tomorrowStr)
  const [time, setTime] = useState('08:00')
  const [course, setCourse] = useState(homeCourse)
  const [maxSlots, setMaxSlots] = useState(4)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep course in sync if homeCourse loads after mount
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setCourse(homeCourse)
      setDate(tomorrowStr)
      setTime('08:00')
      setMaxSlots(4)
      setError(null)
    }
    onOpenChange(val)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

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
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to create tee time.')
        setSubmitting(false)
        return
      }

      toast.success('Tee time added! Players have been notified.')
      onSuccess()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
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
