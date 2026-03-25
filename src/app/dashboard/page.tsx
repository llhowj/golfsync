import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { PlayerDashboard } from '@/components/player/PlayerDashboard'

interface DashboardPageProps {
  searchParams: Promise<{ g?: string; tab?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { g: selectedGroupId, tab } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/dashboard')

  const { data: members } = await supabase
    .from('group_members')
    .select('id, group_id, is_admin, player_type, invited_name, groups(id, name, home_course)')
    .eq('user_id', user.id)

  const allMembers = members ?? []
  const adminMembers = allMembers.filter((m) => m.is_admin)
  const adminGroups = adminMembers.map((m) => {
    const g = Array.isArray(m.groups) ? m.groups[0] : m.groups
    return { id: m.group_id, name: g?.name ?? 'My Group', homeCourse: g?.home_course ?? '' }
  })

  // ?g=<groupId>: show admin dashboard for that group
  if (selectedGroupId) {
    const activeMember = allMembers.find((m) => m.group_id === selectedGroupId)
    if (!activeMember?.is_admin) redirect('/dashboard')

    return (
      <div className="flex flex-col min-h-full">
        <Navbar user={user} adminGroups={adminGroups} />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:px-6">
          <AdminDashboard groupId={activeMember.group_id} memberId={activeMember.id} defaultTab={tab} />
        </main>
      </div>
    )
  }

  // Default: tee times view for everyone
  return (
    <div className="flex flex-col min-h-full">
      <Navbar user={user} adminGroups={adminGroups} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:px-6">
        {allMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <div className="text-5xl">⛳</div>
            <p className="font-semibold text-lg">No groups yet</p>
            <p className="text-muted-foreground text-sm max-w-xs">
              You&apos;re not a member of any group yet. Use the menu above to create your own group, or ask an admin to invite you.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <PlayerDashboard memberIds={allMembers.map((m) => m.id)} adminGroups={adminGroups} />
          </div>
        )}
      </main>
    </div>
  )
}
