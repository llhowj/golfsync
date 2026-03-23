'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authFetch } from '@/lib/auth-fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface GroupEntry {
  groupId: string
  memberId: string
  name: string
  isAdmin: boolean
}

interface GroupChooserProps {
  groups: GroupEntry[]
}

export function GroupChooser({ groups }: GroupChooserProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [homeCourse, setHomeCourse] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!groupName.trim()) return
    setSubmitting(true)
    try {
      const res = await authFetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName.trim(), homeCourse: homeCourse.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create group.')
        return
      }
      toast.success(`"${groupName.trim()}" created!`)
      setDialogOpen(false)
      router.push(`/dashboard?g=${data.group.id}`)
      router.refresh()
    } catch {
      toast.error('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Groups</h1>
          <p className="text-sm text-muted-foreground mt-1">Select a group to view its dashboard.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="shrink-0">
          + New Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="text-5xl">⛳</div>
          <h2 className="text-xl font-semibold">You&apos;re not in any groups yet</h2>
          <p className="text-muted-foreground max-w-sm">
            Create your own group or ask a group admin to add you.
          </p>
          <Button onClick={() => setDialogOpen(true)}>Create a Group</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <Card
              key={g.groupId}
              className="cursor-pointer hover:border-foreground/30 transition-colors active:scale-[0.99]"
              onClick={() => router.push(`/dashboard?g=${g.groupId}`)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{g.name}</p>
                </div>
                <Badge variant={g.isAdmin ? 'default' : 'secondary'} className="shrink-0">
                  {g.isAdmin ? 'Admin' : 'Player'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a New Group</DialogTitle>
            <DialogDescription>
              You&apos;ll be the admin. Add players after creating the group.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="e.g. Saturday Morning Crew"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="home-course">
                Home Course <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="home-course"
                placeholder="e.g. Pebble Beach Golf Links"
                value={homeCourse}
                onChange={(e) => setHomeCourse(e.target.value)}
                disabled={submitting}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !groupName.trim()}>
                {submitting ? 'Creating...' : 'Create Group'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
