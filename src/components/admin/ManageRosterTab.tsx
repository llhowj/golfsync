'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { authFetch } from '@/lib/auth-fetch'

interface MemberProfile {
  id: string
  name: string
  email: string
  phone: string | null
}

interface Member {
  id: string
  player_type: 'core' | 'backup'
  backup_rank: number | null
  is_admin: boolean
  invited_name: string | null
  invited_email: string | null
  profiles: MemberProfile | null
}

interface ManageRosterTabProps {
  groupId: string
}

const EMPTY_FORM = { name: '', email: '', phone: '', playerType: 'core', isAdmin: false }

export function ManageRosterTab({ groupId }: ManageRosterTabProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSaving, setAddSaving] = useState(false)

  // Edit dialog
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/members?groupId=${groupId}`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const corePlayers = members.filter(m => m.player_type === 'core')
  const backupPlayers = members
    .filter(m => m.player_type === 'backup')
    .sort((a, b) => (a.backup_rank ?? 99) - (b.backup_rank ?? 99))

  function displayName(m: Member) { return m.profiles?.name ?? m.invited_name ?? 'Unknown' }
  function displayEmail(m: Member) { return m.profiles?.email ?? m.invited_email ?? '' }
  function isActive(m: Member) { return !!m.profiles }

  // ── Add player ────────────────────────────────────────────────────────────

  async function handleAdd() {
    setAddError(null)
    if (!addForm.name.trim() || !addForm.email.trim()) {
      setAddError('Name and email are required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email)) {
      setAddError('Please enter a valid email address.')
      return
    }
    if (addForm.playerType === 'core' && corePlayers.filter(m => !m.is_admin).length >= 4) {
      setAddError('You already have 4 core players. Add as a backup instead.')
      return
    }
    setAddSaving(true)
    try {
      const res = await authFetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          name: addForm.name.trim(),
          email: addForm.email.trim().toLowerCase(),
          phone: addForm.phone.trim() || null,
          playerType: addForm.playerType,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error ?? 'Something went wrong.'); return }
      toast.success(`${addForm.name} added to the roster.`)
      setAddForm(EMPTY_FORM)
      setAddOpen(false)
      fetchMembers()
    } finally {
      setAddSaving(false)
    }
  }

  // ── Edit player ───────────────────────────────────────────────────────────

  function openEdit(m: Member) {
    setEditMember(m)
    setEditError(null)
    setConfirmDelete(false)
    setEditForm({
      name: displayName(m),
      email: displayEmail(m),
      phone: m.profiles?.phone ?? '',
      playerType: m.player_type,
      isAdmin: m.is_admin,
    })
  }

  async function handleDelete() {
    if (!editMember) return
    setDeleting(true)
    try {
      const res = await authFetch('/api/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: editMember.id, groupId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to remove player.'); return }
      toast.success(`${displayName(editMember)} removed from the roster.`)
      setEditMember(null)
      setConfirmDelete(false)
      fetchMembers()
    } finally {
      setDeleting(false)
    }
  }

  async function handleEdit() {
    if (!editMember) return
    setEditError(null)
    if (!editForm.name.trim()) { setEditError('Name is required.'); return }

    setEditSaving(true)
    try {
      const res = await authFetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: editMember.id,
          groupId,
          name: editForm.name.trim(),
          email: editForm.email.trim().toLowerCase(),
          phone: editForm.phone.trim() || null,
          playerType: editForm.playerType,
          isAdmin: editForm.isAdmin,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error ?? 'Something went wrong.'); return }
      toast.success('Player updated.')
      setEditMember(null)
      fetchMembers()
    } finally {
      setEditSaving(false)
    }
  }

  // ── Reorder backup pool ───────────────────────────────────────────────────

  async function moveBackup(memberId: string, direction: 'up' | 'down') {
    const sorted = [...backupPlayers]
    const index = sorted.findIndex(m => m.id === memberId)
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === sorted.length - 1) return
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    ;[sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]]
    await authFetch('/api/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, orderedMemberIds: sorted.map(m => m.id) }),
    })
    fetchMembers()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3 pt-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 rounded-xl border border-border bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {corePlayers.filter(m => !m.is_admin).length}/4 core players
        </p>
        <Button size="sm" onClick={() => { setAddError(null); setAddForm(EMPTY_FORM); setAddOpen(true) }}>
          + Add Player
        </Button>
      </div>

      {/* Core Players */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Core Players</h3>
        {corePlayers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No core players yet.</p>
        ) : corePlayers.map(m => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{displayName(m)}</p>
                {m.is_admin && <Badge variant="secondary" className="text-xs shrink-0">Admin</Badge>}
              </div>
              <p className="text-sm text-muted-foreground truncate">{displayEmail(m)}</p>
            </div>
            <Badge variant={isActive(m) ? 'default' : 'outline'} className="shrink-0 text-xs">
              {isActive(m) ? 'Active' : 'Invited'}
            </Badge>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => openEdit(m)}>
              Edit
            </Button>
          </div>
        ))}
      </div>

      {/* Backup Pool */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Backup Pool</h3>
        <p className="text-xs text-muted-foreground">
          Backups are contacted in order when a core slot opens. Use ↑↓ to reorder.
        </p>
        {backupPlayers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No backups yet.</p>
        ) : backupPlayers.map((m, index) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <span className="text-sm font-mono text-muted-foreground w-5 shrink-0 text-center">{index + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{displayName(m)}</p>
                {m.is_admin && <Badge variant="secondary" className="text-xs shrink-0">Admin</Badge>}
              </div>
              <p className="text-sm text-muted-foreground truncate">{displayEmail(m)}</p>
            </div>
            <Badge variant={isActive(m) ? 'default' : 'outline'} className="shrink-0 text-xs">
              {isActive(m) ? 'Active' : 'Invited'}
            </Badge>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => openEdit(m)}>
              Edit
            </Button>
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => moveBackup(m.id, 'up')} disabled={index === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-25 leading-none px-1" aria-label="Move up">↑</button>
              <button onClick={() => moveBackup(m.id, 'down')} disabled={index === backupPlayers.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-25 leading-none px-1" aria-label="Move down">↓</button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Player Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Player</DialogTitle></DialogHeader>
          <PlayerForm
            form={addForm}
            onChange={setAddForm}
            error={addError}
            isActive={false}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSaving}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addSaving}>{addSaving ? 'Adding...' : 'Add Player'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Player Dialog */}
      <Dialog open={!!editMember} onOpenChange={open => { if (!open) { setEditMember(null); setConfirmDelete(false) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Player</DialogTitle></DialogHeader>
          {confirmDelete ? (
            <div className="space-y-4 py-2">
              <p className="text-sm">
                Remove <strong>{editMember && displayName(editMember)}</strong> from the group? This cannot be undone.
              </p>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Removing...' : 'Remove Player'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <PlayerForm
                form={editForm}
                onChange={setEditForm}
                error={editError}
                isActive={!!editMember && isActive(editMember)}
                showAdminToggle
              />
              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="destructive" className="sm:mr-auto" onClick={() => setConfirmDelete(true)} disabled={editSaving}>
                  Remove
                </Button>
                <Button variant="outline" onClick={() => setEditMember(null)} disabled={editSaving}>Cancel</Button>
                <Button onClick={handleEdit} disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Shared form fields ────────────────────────────────────────────────────────

interface PlayerFormProps {
  form: { name: string; email: string; phone: string; playerType: string; isAdmin: boolean }
  onChange: (f: { name: string; email: string; phone: string; playerType: string; isAdmin: boolean }) => void
  error: string | null
  isActive: boolean
  showAdminToggle?: boolean
}

function PlayerForm({ form, onChange, error, isActive, showAdminToggle }: PlayerFormProps) {
  return (
    <div className="space-y-4 py-2">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {isActive && (
        <p className="text-sm text-muted-foreground">
          This player has an active account. Name and email are managed by the player.
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="pf-name">Full Name</Label>
        <Input id="pf-name" placeholder="Jane Smith" value={form.name} disabled={isActive}
          onChange={e => onChange({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-email">Email</Label>
        <Input id="pf-email" type="email" placeholder="jane@example.com" value={form.email} disabled={isActive}
          onChange={e => onChange({ ...form, email: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-phone">Phone <span className="text-muted-foreground font-normal">(optional, for SMS)</span></Label>
        <Input id="pf-phone" type="tel" placeholder="+1 555 000 0000" value={form.phone}
          onChange={e => onChange({ ...form, phone: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pf-type">Role</Label>
        <Select value={form.playerType} onValueChange={v => onChange({ ...form, playerType: v ?? 'core' })}>
          <SelectTrigger id="pf-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="core">Core Player — invited to every tee time</SelectItem>
            <SelectItem value="backup">Backup — contacted when a slot opens</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {showAdminToggle && (
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-primary"
            checked={form.isAdmin}
            onChange={e => onChange({ ...form, isAdmin: e.target.checked })}
          />
          <span className="text-sm">Admin — can create and manage tee times</span>
        </label>
      )}
    </div>
  )
}
