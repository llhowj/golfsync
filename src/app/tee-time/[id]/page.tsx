import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { TeeTimeRSVPView } from '@/components/player/TeeTimeRSVPView'

interface TeeTimePageProps {
  params: Promise<{ id: string }>
}

export default async function TeeTimePage({ params }: TeeTimePageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirectTo=/tee-time/${id}`)
  }

  // Find the member record for this user
  const { data: member } = await supabase
    .from('group_members')
    .select('id, group_id, invited_name, player_type')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    redirect('/dashboard')
  }

  // Fetch the tee time
  const { data: teeTime, error: ttError } = await supabase
    .from('tee_times')
    .select('id, date, start_time, course, max_slots, notes, deleted_at, group_id')
    .eq('id', id)
    .single()

  if (ttError || !teeTime) {
    redirect('/dashboard')
  }

  // Verify the tee time belongs to the user's group
  if (teeTime.group_id !== member.group_id) {
    redirect('/dashboard')
  }

  // Fetch this member's invite for this tee time
  const { data: invite } = await supabase
    .from('invites')
    .select('id, invite_type')
    .eq('tee_time_id', id)
    .eq('member_id', member.id)
    .maybeSingle()

  if (!invite) {
    // Not invited — redirect to dashboard
    redirect('/dashboard')
  }

  // Fetch this member's RSVP
  const { data: myRsvpData } = await supabase
    .from('rsvps')
    .select('status, note')
    .eq('tee_time_id', id)
    .eq('member_id', member.id)
    .maybeSingle()

  const myRsvp = {
    status: (myRsvpData?.status ?? 'pending') as 'in' | 'out' | 'pending',
    note: myRsvpData?.note ?? null,
  }

  // Fetch who else is confirmed (status = 'in', not this member)
  const { data: confirmedRsvps } = await supabase
    .from('rsvps')
    .select('member_id, member:group_members ( invited_name )')
    .eq('tee_time_id', id)
    .eq('status', 'in')
    .neq('member_id', member.id)

  const confirmedPlayers = (confirmedRsvps ?? [])
    .map((r) => {
      const m = r.member as { invited_name: string | null } | null
      return m?.invited_name ?? null
    })
    .filter((name): name is string => name !== null)

  return (
    <div className="flex flex-col min-h-full">
      <Navbar user={user} />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 sm:px-6">
        <TeeTimeRSVPView
          teeTime={teeTime}
          myRsvp={myRsvp}
          confirmedPlayers={confirmedPlayers}
          memberId={member.id}
        />
      </main>
    </div>
  )
}
