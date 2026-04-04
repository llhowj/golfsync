'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface NavbarProps {
  user: User
  adminGroups?: { id: string; name: string }[]
}

function getInitials(user: User): string {
  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    ''
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0] as string)[0]!.toUpperCase()
  return ((parts[0] as string)[0]! + (parts[parts.length - 1] as string)[0]!).toUpperCase()
}

function getDisplayName(user: User): string {
  return (
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'
  )
}

export function Navbar({ user, adminGroups = [] }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()

  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [homeCourse, setHomeCourse] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleFeedback(e: React.FormEvent) {
    e.preventDefault()
    if (!feedbackMessage.trim()) return
    setSendingFeedback(true)
    try {
      const res = await authFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: feedbackMessage.trim() }),
      })
      if (!res.ok) {
        toast.error('Failed to send. Please try again.')
        return
      }
      toast.success('Thanks — your feedback has been sent.')
      setFeedbackOpen(false)
      setFeedbackMessage('')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSendingFeedback(false)
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
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

      toast.success('Group created!')
      setCreateGroupOpen(false)
      setGroupName('')
      setHomeCourse('')
      router.push('/dashboard?g=' + data.group.id)
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const initials = getInitials(user)
  const displayName = getDisplayName(user)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <a
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
          >
            <span>⛳</span>
            <span>GolfSync</span>
          </a>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 px-2 h-9 rounded-full hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* Avatar circle */}
              <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                {initials}
              </div>
              {/* Name — hidden on very small screens */}
              <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">
                {displayName}
              </span>
              {/* Chevron */}
              <svg
                className="h-3.5 w-3.5 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => router.push('/profile')}>
                My Profile
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setCreateGroupOpen(true)}>
                Add a group
              </DropdownMenuItem>

              {adminGroups.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {adminGroups.map((g) => (
                    <DropdownMenuItem
                      key={g.id}
                      onClick={() => router.push(`/roster?g=${g.id}`)}
                    >
                      Roster{adminGroups.length > 1 ? ` — ${g.name}` : ''}
                    </DropdownMenuItem>
                  ))}
                  {process.env.NEXT_PUBLIC_WATCH_ENABLED === 'true' && adminGroups.map((g) => (
                    <DropdownMenuItem
                      key={`watch-${g.id}`}
                      onClick={() => router.push(`/watch?g=${g.id}`)}
                    >
                      Tee Time Watch{adminGroups.length > 1 ? ` — ${g.name}` : ''}
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
                Report an Issue
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleSignOut}
                variant="destructive"
                className="cursor-pointer"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={feedbackOpen} onOpenChange={(open) => { setFeedbackOpen(open); if (!open) setFeedbackMessage('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
            <DialogDescription>
              Describe the bug or share a suggestion. We&apos;ll get back to you at {user.email}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFeedback} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-message">Your message <span className="text-destructive">*</span></Label>
              <Textarea
                id="feedback-message"
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="What's happening, or what would you like to see?"
                rows={5}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setFeedbackOpen(false); setFeedbackMessage('') }} disabled={sendingFeedback}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendingFeedback || !feedbackMessage.trim()}>
                {sendingFeedback ? 'Sending…' : 'Send Feedback'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a group</DialogTitle>
            <DialogDescription>
              Set up a new golf group. You&apos;ll be the admin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name <span className="text-destructive">*</span></Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Saturday Stableford"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="home-course">Home Course <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="home-course"
                value={homeCourse}
                onChange={(e) => setHomeCourse(e.target.value)}
                placeholder="e.g. Pebble Beach Golf Links"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateGroupOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !groupName.trim()}>
                {submitting ? 'Creating…' : 'Create Group'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
