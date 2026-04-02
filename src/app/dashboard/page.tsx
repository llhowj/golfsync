import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { PlayerDashboard } from '@/components/player/PlayerDashboard'
import { NoGroupsEmptyState } from '@/components/admin/NoGroupsEmptyState'

interface DashboardPageProps {
  searchParams: Promise<{ g?: string; tab?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { g: selectedGroupId, tab } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/dashboard')

  // Link any group_members rows where invited_email matches this user's email.
  // Covers players who were added to a group after they already had an account
  // (the signup trigger only fires for new signups).
  if (user.email) {
    const adminSupabase = createAdminClient()
    await adminSupabase
      .from('group_members')
      .update({ user_id: user.id, invited_email: null })
      .eq('invited_email', user.email)
      .is('user_id', null)
  }

  const { data: members } = await supabase
    .from('group_members')
    .select('id, group_id, is_admin, invited_name, groups(id, name, home_course)')
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
          <NoGroupsEmptyState />
        ) : (
          <div className="space-y-8">
            <PlayerDashboard memberIds={allMembers.map((m) => m.id)} adminGroups={adminGroups} />
          </div>
        )}
      </main>
    </div>
  )
}
