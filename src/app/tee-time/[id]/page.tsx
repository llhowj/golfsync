import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { TeeTimeRSVPView } from '@/components/player/TeeTimeRSVPView'

interface TeeTimePageProps {
  params: Promise<{ id: string }>
}

export default async function TeeTimePage({ params }: TeeTimePageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=/tee-time/${id}`)

  // Find any member record for this user that has an invite to this tee time
  const adminSupabase = createAdminClient()

  // Fetch the tee time first (need group_id and created_by)
  const { data: teeTime, error: ttError } = await adminSupabase
    .from('tee_times')
    .select('id, date, start_time, course, max_slots, notes, deleted_at, group_id, created_by')
    .eq('id', id)
    .single()

  if (ttError || !teeTime) redirect('/dashboard')

  // Find the member record for this user in the tee time's group
  const { data: member } = await adminSupabase
    .from('group_members')
    .select('id, group_id, invited_name, player_type')
    .eq('user_id', user.id)
    .eq('group_id', teeTime.group_id)
    .maybeSingle()

  if (!member) redirect('/dashboard')

  // Fetch this member's invite
  const { data: invite } = await adminSupabase
    .from('invites')
    .select('id')
    .eq('tee_time_id', id)
    .eq('member_id', member.id)
    .maybeSingle()

  if (!invite) redirect('/dashboard')

  // Fetch RSVP, other RSVPs, and creator profile in parallel
  const [{ data: myRsvpData }, { data: othersRsvps }, { data: creatorProfile }] = await Promise.all([
    adminSupabase
      .from('rsvps')
      .select('status, note')
      .eq('tee_time_id', id)
      .eq('member_id', member.id)
      .maybeSingle(),
    adminSupabase
      .from('rsvps')
      .select('member_id, status, note, member:group_members ( invited_name )')
      .eq('tee_time_id', id)
      .in('status', ['in', 'pending'])
      .neq('member_id', member.id),
    teeTime.created_by
      ? adminSupabase.from('profiles').select('name').eq('id', teeTime.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const myRsvp = {
    status: (myRsvpData?.status ?? 'pending') as 'in' | 'out' | 'pending' | 'requested_in',
    note: myRsvpData?.note ?? null,
  }

  const confirmedPlayers = (othersRsvps ?? [])
    .filter((r) => r.status === 'in')
    .map((r) => {
      const m = r.member as { invited_name: string | null } | null
      const name = m?.invited_name ?? null
      if (!name) return null
      return { name, note: r.note ?? null }
    })
    .filter((p): p is { name: string; note: string | null } => p !== null)

  const pendingPlayers = (othersRsvps ?? [])
    .filter((r) => r.status === 'pending')
    .map((r) => {
      const m = r.member as { invited_name: string | null } | null
      return m?.invited_name ?? null
    })
    .filter((name): name is string => name !== null)

  // Use teeTime without created_by in the prop (TeeTimeRSVPView doesn't need it)
  const { created_by: _cb, ...teeTimeProps } = teeTime

  return (
    <div className="flex flex-col min-h-full">
      <Navbar user={user} />
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 sm:px-6">
        <TeeTimeRSVPView
          teeTime={teeTimeProps}
          myRsvp={myRsvp}
          confirmedPlayers={confirmedPlayers}
          pendingPlayers={pendingPlayers}
          invitedBy={creatorProfile?.name ?? null}
          memberId={member.id}
        />
      </main>
    </div>
  )
}
