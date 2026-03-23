import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { PlayerDashboard } from '@/components/player/PlayerDashboard'

interface DashboardPageProps {
  searchParams: Promise<{ g?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { g: selectedGroupId } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/dashboard')

  const { data: members } = await supabase
    .from('group_members')
    .select('id, group_id, is_admin, player_type, invited_name, groups(id, name, home_course)')
    .eq('user_id', user.id)

  const allMembers = members ?? []
  const adminMembers = allMembers.filter((m) => m.is_admin)

  // ?g=<groupId>: show admin dashboard for that group
  if (selectedGroupId) {
    const activeMember = allMembers.find((m) => m.group_id === selectedGroupId)
    if (!activeMember?.is_admin) redirect('/dashboard')

    return (
      <div className="flex flex-col min-h-full">
        <Navbar user={user} />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:px-6">
          <AdminDashboard groupId={activeMember.group_id} memberId={activeMember.id} />
        </main>
      </div>
    )
  }

  // Default: tee times view for everyone
  return (
    <div className="flex flex-col min-h-full">
      <Navbar user={user} />
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
            {adminMembers.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Your Groups
                </h2>
                <div className="flex flex-col gap-2">
                  {adminMembers.map((m) => {
                    const g = Array.isArray(m.groups) ? m.groups[0] : m.groups
                    return (
                      <a
                        key={m.group_id}
                        href={`/dashboard?g=${m.group_id}`}
                        className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">{g?.name ?? 'Unnamed Group'}</p>
                          <p className="text-xs text-muted-foreground">Admin</p>
                        </div>
                        <span className="text-muted-foreground text-sm">Manage →</span>
                      </a>
                    )
                  })}
                </div>
              </section>
            )}
            <PlayerDashboard memberIds={allMembers.map((m) => m.id)} />
          </div>
        )}
      </main>
    </div>
  )
}
