import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'
import { sendTeeTimePostedEmails } from '@/lib/email'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { memberId } = body
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const adminSupabase = createAdminClient()

  // Fetch tee time
  const { data: teeTime } = await adminSupabase
    .from('tee_times')
    .select('id, date, start_time, course, group_id, max_slots, deleted_at')
    .eq('id', id)
    .maybeSingle()

  if (!teeTime) return NextResponse.json({ error: 'Tee time not found' }, { status: 404 })
  if (teeTime.deleted_at) return NextResponse.json({ error: 'Tee time is cancelled' }, { status: 409 })

  // Verify admin
  const { data: adminCheck } = await adminSupabase
    .from('group_members')
    .select('id')
    .eq('group_id', teeTime.group_id)
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify member is a backup in this group
  const { data: member } = await adminSupabase
    .from('group_members')
    .select('id, invited_name, invited_email, player_type, profiles(name, email)')
    .eq('id', memberId)
    .eq('group_id', teeTime.group_id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Check open slots
  const { count: inCount } = await adminSupabase
    .from('rsvps')
    .select('id', { count: 'exact', head: true })
    .eq('tee_time_id', id)
    .eq('status', 'in')

  if ((inCount ?? 0) >= teeTime.max_slots) {
    return NextResponse.json({ error: 'No open slots remaining' }, { status: 409 })
  }

  // Check not already invited
  const { data: existing } = await adminSupabase
    .from('invites')
    .select('id')
    .eq('tee_time_id', id)
    .eq('member_id', memberId)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Player already invited' }, { status: 409 })

  // Create invite + pending RSVP
  await adminSupabase.from('invites').insert({
    tee_time_id: id,
    member_id: memberId,
    invite_type: 'backup',
  })

  await adminSupabase.from('rsvps').insert({
    tee_time_id: id,
    member_id: memberId,
    status: 'pending',
  })

  // Send notification email
  const { data: groupData } = await adminSupabase
    .from('groups').select('name').eq('id', teeTime.group_id).single()

  const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
  const email = profile?.email ?? member.invited_email
  const name = profile?.name ?? member.invited_name ?? 'Player'

  if (email) {
    await sendTeeTimePostedEmails([{ name, email }], {
      teeTimeId: id,
      date: teeTime.date,
      startTime: teeTime.start_time,
      course: teeTime.course,
      groupName: groupData?.name ?? 'Your Golf Group',
    })
  }

  return NextResponse.json({ ok: true })
}
