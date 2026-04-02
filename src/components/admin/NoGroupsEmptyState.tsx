'use client'

import { useState } from 'react'
import { CreateGroupDialog } from '@/components/admin/CreateGroupDialog'

export function NoGroupsEmptyState() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <div className="text-5xl">⛳</div>
        <p className="font-semibold text-lg">No groups yet</p>
        <p className="text-muted-foreground text-sm max-w-xs">
          Create a group to start scheduling tee times, or ask an admin to invite you to theirs.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          + Create a Group
        </button>
      </div>
      <CreateGroupDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
