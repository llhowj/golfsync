import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: teeTimeId } = await context.params

  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { date, time, course } = body

  if (!date || !time || !course) {
    return NextResponse.json({ error: 'date, time, and course are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch tee time and verify it exists
  const { data: teeTime } = await supabase
    .from('tee_times')
    .select('id, group_id, deleted_at')
    .eq('id', teeTimeId)
    .maybeSingle()

  if (!teeTime || teeTime.deleted_at) {
    return NextResponse.json({ error: 'Tee time not found' }, { status: 404 })
  }

  // Verify requester is admin of this group
  const { data: adminMember } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', teeTime.group_id)
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all RSVP member IDs for this tee time
  const { data: rsvps } = await supabase
    .from('rsvps')
    .select('member_id')
    .eq('tee_time_id', teeTimeId)

  const rsvpMemberIds = (rsvps ?? []).map(r => r.member_id)

  // Find non-admin invitees (excluding the admin making this request)
  const { data: invitedMembers } = rsvpMemberIds.length > 0
    ? await supabase
        .from('group_members')
        .select('id, is_admin, user_id')
        .in('id', rsvpMemberIds)
    : { data: [] }

  const nonAdminInviteeIds = (invitedMembers ?? [])
    .filter(m => !m.is_admin && m.user_id !== user.id)
    .map(m => m.id)

  // No other players invited — apply immediately
  if (nonAdminInviteeIds.length === 0) {
    await supabase
      .from('tee_times')
      .update({ date, start_time: time, course })
      .eq('id', teeTimeId)

    return NextResponse.json({ applied: true })
  }

  // Cancel any existing pending proposal for this tee time
  await db
    .from('tee_time_proposals')
    .update({ status: 'cancelled' })
    .eq('tee_time_id', teeTimeId)
    .eq('status', 'pending')

  // Create new proposal
  const { data: proposal, error: proposalError } = await db
    .from('tee_time_proposals')
    .insert({
      tee_time_id: teeTimeId,
      proposed_date: date,
      proposed_start_time: time,
      proposed_course: course,
    })
    .select('id')
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 })
  }

  // Create a response record for each non-admin invitee
  await db
    .from('proposal_responses')
    .insert(nonAdminInviteeIds.map((memberId: string) => ({
      proposal_id: proposal.id,
      member_id: memberId,
    })))

  return NextResponse.json({ applied: false, proposalId: proposal.id })
}
