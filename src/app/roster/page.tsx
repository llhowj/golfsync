import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { ManageRosterTab } from '@/components/admin/ManageRosterTab'

interface RosterPageProps {
  searchParams: Promise<{ g?: string }>
}

export default async function RosterPage({ searchParams }: RosterPageProps) {
  const { g: groupId } = await searchParams
  if (!groupId) redirect('/dashboard')

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/roster?g=' + groupId)

  const { data: members } = await supabase
    .from('group_members')
    .select('id, group_id, is_admin, groups(id, name, home_course)')
    .eq('user_id', user.id)

  const allMembers = members ?? []
  const activeMember = allMembers.find((m) => m.group_id === groupId)
  if (!activeMember?.is_admin) redirect('/dashboard')

  const adminGroups = allMembers
    .filter((m) => m.is_admin)
    .map((m) => {
      const g = Array.isArray(m.groups) ? m.groups[0] : m.groups
      return { id: m.group_id, name: g?.name ?? 'My Group' }
    })

  return (
    <div className="flex flex-col min-h-full">
      <Navbar user={user} adminGroups={adminGroups} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:px-6">
        <div className="space-y-1 mb-6">
          <a href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            ← My Tee Times
          </a>
          <h1 className="text-2xl font-bold tracking-tight">Player Roster</h1>
        </div>
        <ManageRosterTab groupId={groupId} />
      </main>
    </div>
  )
}
