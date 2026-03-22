import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { PlayerDashboard } from '@/components/player/PlayerDashboard'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/dashboard')
  }

  // Fetch the group_member record for this user (they may belong to one group)
  const { data: member } = await supabase
    .from('group_members')
    .select('id, group_id, is_admin, player_type, invited_name')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div className="flex flex-col min-h-full">
      <Navbar user={user} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:px-6">
        {!member ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="text-5xl">⛳</div>
            <h2 className="text-xl font-semibold">You&apos;re not in a group yet</h2>
            <p className="text-muted-foreground max-w-sm">
              Ask your golf group admin to add you to their GolfSync group. Once
              added, your upcoming tee times will appear here.
            </p>
          </div>
        ) : member.is_admin ? (
          <AdminDashboard groupId={member.group_id} memberId={member.id} />
        ) : (
          <PlayerDashboard memberId={member.id} />
        )}
      </main>
    </div>
  )
}
