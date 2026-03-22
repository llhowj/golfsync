import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'
import { sendTeeTimeCancelledEmails } from '@/lib/email'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = createAdminClient()

  // Fetch the tee time and verify the user is an admin of the group
  const { data: teeTime } = await adminSupabase
    .from('tee_times')
    .select('id, date, start_time, course, group_id, deleted_at')
    .eq('id', id)
    .maybeSingle()

  if (!teeTime) return NextResponse.json({ error: 'Tee time not found' }, { status: 404 })
  if (teeTime.deleted_at) return NextResponse.json({ error: 'Already cancelled' }, { status: 409 })

  const { data: adminCheck } = await adminSupabase
    .from('group_members')
    .select('id')
    .eq('group_id', teeTime.group_id)
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Soft-delete the tee time
  await adminSupabase
    .from('tee_times')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  // Send cancellation emails to all core members with RSVPs
  const { data: groupData } = await adminSupabase
    .from('groups').select('name').eq('id', teeTime.group_id).single()

  const { data: rsvps } = await adminSupabase
    .from('rsvps')
    .select('member:group_members(invited_name, invited_email, user_id, profiles(name, email))')
    .eq('tee_time_id', id)

  const recipients = (rsvps ?? [])
    .map((r) => {
      const m = r.member as { invited_name: string | null; invited_email: string | null; user_id: string | null; profiles: { name: string; email: string } | { name: string; email: string }[] | null } | null
      if (!m) return null
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      const email = profile?.email ?? m.invited_email
      const name = profile?.name ?? m.invited_name ?? 'Player'
      return email ? { name, email } : null
    })
    .filter(Boolean) as { name: string; email: string }[]

  await sendTeeTimeCancelledEmails(recipients, {
    teeTimeId: id,
    date: teeTime.date,
    startTime: teeTime.start_time,
    course: teeTime.course,
    groupName: groupData?.name ?? 'Your Golf Group',
  })

  return NextResponse.json({ ok: true })
}
