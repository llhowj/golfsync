'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  is_admin: boolean
  invited_name: string | null
  invited_email: string | null
  profiles: MemberProfile | null
}

interface RosterGroup {
  id: string
  name: string
  is_default: boolean
  memberIds: string[]
}

interface ManageRosterTabProps {
  groupId: string
}

const EMPTY_ADD_FORM = { name: '', email: '', phone: '', isAdmin: false, addToDefault: false }

export function ManageRosterTab({ groupId }: ManageRosterTabProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [rosterGroups, setRosterGroups] = useState<RosterGroup[]>([])
  const [loading, setLoading] = useState(true)

  // Add player dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSaving, setAddSaving] = useState(false)

  // Edit player dialog
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', isAdmin: false })
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Tab state (controlled so it doesn't reset on re-render)
  const [tab, setTab] = useState<'players' | 'groups'>('players')

  // Roster group state
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)

  // Add-members-to-group dialog
  const [addMembersGroupId, setAddMembersGroupId] = useState<string | null>(null)
  const [addMembersSelected, setAddMembersSelected] = useState<Set<string>>(new Set())


  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [membersRes, groupsRes] = await Promise.all([
        authFetch(`/api/members?groupId=${groupId}`),
        authFetch(`/api/roster-groups?groupId=${groupId}`),
      ])
      const membersData = membersRes.ok ? await membersRes.json() : { members: [] }
      const groupsData = groupsRes.ok ? await groupsRes.json() : { rosterGroups: [] }
      setMembers(membersData.members ?? [])
      setRosterGroups(groupsData.rosterGroups ?? [])
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => { fetchData() }, [fetchData])

  function displayName(m: Member) { return m.profiles?.name ?? m.invited_name ?? 'Unknown' }
  function displayEmail(m: Member) { return m.profiles?.email ?? m.invited_email ?? '' }
  function isActive(m: Member) { return !!m.profiles }

  // ── Add player ────────────────────────────────────────────────────────────

  const defaultGroup = rosterGroups.find(g => g.is_default)
  const defaultGroupFull = (defaultGroup?.memberIds.length ?? 0) >= 4

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
          playerType: 'core',
          addToDefault: addForm.addToDefault,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error ?? 'Something went wrong.'); return }
      toast.success(`${addForm.name} added to the roster.`)
      setAddForm(EMPTY_ADD_FORM)
      setAddOpen(false)
      fetchData()
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
      fetchData()
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
          playerType: 'core',
          isAdmin: editForm.isAdmin,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error ?? 'Something went wrong.'); return }
      toast.success('Player updated.')
      setEditMember(null)
      fetchData()
    } finally {
      setEditSaving(false)
    }
  }

  // ── Roster groups ─────────────────────────────────────────────────────────

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    try {
      const res = await authFetch('/api/roster-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, name: newGroupName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to create group.'); return }
      const newId: string = data.rosterGroup?.id
      setNewGroupName('')
      setShowNewGroupInput(false)
      await fetchData()
      // Stay on groups tab and open add-members dialog for the new group
      setTab('groups')
      if (newId) {
        setAddMembersSelected(new Set())
        setAddMembersGroupId(newId)
      }
    } finally {
      setCreatingGroup(false)
    }
  }

  async function handleRenameGroup(id: string) {
    if (!renameValue.trim()) return
    const res = await authFetch(`/api/roster-groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to rename.'); return }
    setRenamingGroupId(null)
    fetchData()
  }

  async function handleDeleteGroup(id: string) {
    setDeletingGroupId(id)
    try {
      const res = await authFetch(`/api/roster-groups/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to delete group.'); return }
      fetchData()
    } finally {
      setDeletingGroupId(null)
    }
  }

  async function handleAddMembersToGroup() {
    if (!addMembersGroupId || addMembersSelected.size === 0) {
      setAddMembersGroupId(null)
      return
    }
    await Promise.all(
      [...addMembersSelected].map(memberId =>
        authFetch(`/api/roster-groups/${addMembersGroupId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId }),
        })
      )
    )
    setAddMembersGroupId(null)
    setAddMembersSelected(new Set())
    fetchData()
  }

  async function handleRemoveFromGroup(rosterGroupId: string, memberId: string) {
    const res = await authFetch(`/api/roster-groups/${rosterGroupId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to remove player.'); return }
    fetchData()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 rounded-xl border border-border bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <Tabs value={tab} onValueChange={v => setTab(v as 'players' | 'groups')}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="players" className="flex-1 sm:flex-none">All Players</TabsTrigger>
          <TabsTrigger value="groups" className="flex-1 sm:flex-none">Groups</TabsTrigger>
        </TabsList>

        {/* ── All Players tab ── */}
        <TabsContent value="players" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setAddError(null); setAddForm(EMPTY_ADD_FORM); setAddOpen(true) }}>
              + Add Player
            </Button>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No players yet.</p>
          ) : members.map(m => (
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
        </TabsContent>

        {/* ── Groups tab ── */}
        <TabsContent value="groups" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Groups let you quickly invite a set of players when creating a tee time.
          </p>

        {rosterGroups.map(group => {
          const groupMembers = members.filter(m => group.memberIds.includes(m.id))
          const nonMembers = members.filter(m => !group.memberIds.includes(m.id))
          const isFull = group.memberIds.length >= 4

          return (
            <div key={group.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              {/* Group header */}
              <div className="flex items-center gap-2">
                {renamingGroupId === group.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      className="h-7 text-sm flex-1"
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameGroup(group.id); if (e.key === 'Escape') setRenamingGroupId(null) }}
                      autoFocus
                    />
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleRenameGroup(group.id)}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setRenamingGroupId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-sm flex-1">
                      {group.name}
                      {group.is_default && <span className="ml-2 text-xs text-muted-foreground font-normal">(Default)</span>}
                    </span>
                    <span className={`text-xs font-medium ${isFull ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {group.memberIds.length}/4{isFull ? ' — full' : ''}
                    </span>
                    {!group.is_default && (
                      <>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => { setRenamingGroupId(group.id); setRenameValue(group.name) }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                          disabled={deletingGroupId === group.id}
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          {deletingGroupId === group.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Members in this group */}
              {groupMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No players in this group yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {groupMembers.map(m => (
                    <div key={m.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{displayName(m)}</span>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        onClick={() => handleRemoveFromGroup(group.id, m.id)}
                        aria-label={`Remove ${displayName(m)}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add players button */}
              {!isFull && nonMembers.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { setAddMembersSelected(new Set()); setAddMembersGroupId(group.id) }}
                >
                  + Add players
                </button>
              )}
              {isFull && (
                <p className="text-xs text-amber-600">Group is full (max 4). Remove a player to add another.</p>
              )}
            </div>
          )
        })}

          {/* Create new group */}
          {showNewGroupInput ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Group name (e.g. Weekend Crew)"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                className="h-9 text-sm flex-1"
                onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowNewGroupInput(false) }}
                autoFocus
              />
              <Button size="sm" onClick={handleCreateGroup} disabled={creatingGroup || !newGroupName.trim()}>
                {creatingGroup ? 'Creating…' : 'Create'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowNewGroupInput(false); setNewGroupName('') }}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowNewGroupInput(true)}
            >
              + Create new group
            </button>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Members to Group Dialog */}
      {(() => {
        const targetGroup = rosterGroups.find(g => g.id === addMembersGroupId)
        const eligibleMembers = targetGroup
          ? members.filter(m => !targetGroup.memberIds.includes(m.id))
          : []
        const spotsLeft = targetGroup ? 4 - targetGroup.memberIds.length : 0
        return (
          <Dialog open={!!addMembersGroupId} onOpenChange={open => { if (!open) { setAddMembersGroupId(null); setAddMembersSelected(new Set()) } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Players to {targetGroup?.name ?? 'Group'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-2">
                {eligibleMembers.length === 0 || spotsLeft === 0 ? (
                  <p className="text-sm text-muted-foreground">This group is full (max 4 players).</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground pb-1">{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} remaining.</p>
                    {eligibleMembers.map(m => {
                      const checked = addMembersSelected.has(m.id)
                      const wouldExceed = !checked && addMembersSelected.size >= spotsLeft
                      return (
                        <label key={m.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer select-none transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-border'} ${wouldExceed ? 'opacity-40 cursor-not-allowed' : ''}`}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={checked}
                            disabled={wouldExceed}
                            onChange={() => {
                              setAddMembersSelected(prev => {
                                const next = new Set(prev)
                                if (next.has(m.id)) next.delete(m.id)
                                else next.add(m.id)
                                return next
                              })
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{displayName(m)}</p>
                            <p className="text-xs text-muted-foreground truncate">{displayEmail(m)}</p>
                          </div>
                        </label>
                      )
                    })}
                  </>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setAddMembersGroupId(null); setAddMembersSelected(new Set()) }}>
                  {addMembersSelected.size === 0 ? 'Close' : 'Cancel'}
                </Button>
                {addMembersSelected.size > 0 && (
                  <Button onClick={handleAddMembersToGroup}>
                    Add {addMembersSelected.size} Player{addMembersSelected.size !== 1 ? 's' : ''}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      })()}

      {/* Add Player Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Player</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {addError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {addError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pf-name">Full Name</Label>
              <Input id="pf-name" placeholder="Jane Smith" value={addForm.name}
                onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-email">Email</Label>
              <Input id="pf-email" type="email" placeholder="jane@example.com" value={addForm.email}
                onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-phone">Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="pf-phone" type="tel" placeholder="+1 555 000 0000" value={addForm.phone}
                onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
            </div>
            {!defaultGroupFull && defaultGroup && (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-primary"
                  checked={addForm.addToDefault}
                  onChange={e => setAddForm({ ...addForm, addToDefault: e.target.checked })}
                />
                <span className="text-sm">Place in Default group</span>
              </label>
            )}
          </div>
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
              <div className="space-y-4 py-2">
                {editError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                    {editError}
                  </div>
                )}
                {editMember && isActive(editMember) && (
                  <p className="text-sm text-muted-foreground">
                    This player has an active account. Name and email are managed by the player.
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="ef-name">Full Name</Label>
                  <Input id="ef-name" value={editForm.name} disabled={!!editMember && isActive(editMember)}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ef-email">Email</Label>
                  <Input id="ef-email" type="email" value={editForm.email} disabled={!!editMember && isActive(editMember)}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ef-phone">Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="ef-phone" type="tel" value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-primary"
                    checked={editForm.isAdmin}
                    onChange={e => setEditForm({ ...editForm, isAdmin: e.target.checked })}
                  />
                  <span className="text-sm">Admin — can create and manage tee times</span>
                </label>
              </div>
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

