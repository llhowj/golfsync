import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { WatchDashboard } from '@/components/admin/WatchDashboard'

interface WatchPageProps {
  searchParams: Promise<{ g?: string }>
}

export default async function WatchPage({ searchParams }: WatchPageProps) {
  const { g: groupId } = await searchParams
  if (!groupId) redirect('/dashboard')

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/watch?g=' + groupId)

  const { data: members } = await supabase
    .from('group_members')
    .select('id, group_id, is_admin, groups(id, name, home_course)')
    .eq('user_id', user.id)

  const allMembers = members ?? []
  const activeMember = allMembers.find((m) => m.group_id === groupId)
  if (!activeMember?.is_admin) redirect('/dashboard')

  const activeGroup = Array.isArray(activeMember.groups) ? activeMember.groups[0] : activeMember.groups
  const homeCourse = activeGroup?.home_course ?? ''

  const adminGroups = allMembers
    .filter((m) => m.is_admin)
    .map((m) => {
      const g = Array.isArray(m.groups) ? m.groups[0] : m.groups
      return { id: m.group_id, name: g?.name ?? 'My Group' }
    })

  // Check if admin has a phone number on file
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle()

  const hasPhone = !!profile?.phone

  return (
    <div className="flex flex-col min-h-full">
      <Navbar user={user} adminGroups={adminGroups} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:px-6">
        <div className="space-y-1 mb-6">
          <a href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            ← My Tee Times
          </a>
          <h1 className="text-2xl font-bold tracking-tight">Tee Time Watch</h1>
          <p className="text-sm text-muted-foreground">Get a text when a tee time matching your criteria opens up at Crystal Springs.</p>
        </div>
        <WatchDashboard groupId={groupId} homeCourse={homeCourse} hasPhone={hasPhone} />
      </main>
    </div>
  )
}
