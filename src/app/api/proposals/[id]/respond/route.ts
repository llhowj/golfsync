import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'
import { sendProposalDeclinedEmail, sendProposalAcceptedEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await context.params

  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { response, memberId } = body

  if (!response || !['yes', 'no'].includes(response)) {
    return NextResponse.json({ error: 'response must be yes or no' }, { status: 400 })
  }
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Verify the member belongs to the requesting user
  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify proposal exists and is still pending
  const { data: proposal } = await db
    .from('tee_time_proposals')
    .select('id, tee_time_id, proposed_date, proposed_start_time, proposed_course, status')
    .eq('id', proposalId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found or already resolved' }, { status: 404 })
  }

  // Record the response
  const { error: updateError } = await db
    .from('proposal_responses')
    .update({ response })
    .eq('proposal_id', proposalId)
    .eq('member_id', memberId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Helper: fetch admin email + player name + original tee time for notifications
  async function getNotificationData() {
    const { data: teeTime } = await supabase
      .from('tee_times')
      .select('date, start_time, course, group_id')
      .eq('id', proposal.tee_time_id)
      .single()

    if (!teeTime) return null

    const { data: adminMember } = await supabase
      .from('group_members')
      .select('user_id, profiles(name, email), groups(name)')
      .eq('group_id', teeTime.group_id)
      .eq('is_admin', true)
      .maybeSingle()

    const { data: playerMember } = await supabase
      .from('group_members')
      .select('invited_name, profiles(name, email)')
      .eq('id', memberId)
      .maybeSingle()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminProfile = Array.isArray((adminMember as any)?.profiles) ? (adminMember as any).profiles[0] : (adminMember as any)?.profiles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupData = Array.isArray((adminMember as any)?.groups) ? (adminMember as any).groups[0] : (adminMember as any)?.groups
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerProfile = Array.isArray((playerMember as any)?.profiles) ? (playerMember as any).profiles[0] : (playerMember as any)?.profiles

    const adminEmail = adminProfile?.email
    const adminName = adminProfile?.name ?? 'Admin'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerName = playerProfile?.name ?? (playerMember as any)?.invited_name ?? 'A player'

    if (!adminEmail) return null

    return {
      admin: { name: adminName, email: adminEmail },
      player: { name: playerName, email: '' },
      emailData: {
        teeTimeId: proposal.tee_time_id,
        originalDate: teeTime.date,
        originalTime: teeTime.start_time,
        originalCourse: teeTime.course,
        proposedDate: proposal.proposed_date,
        proposedTime: proposal.proposed_start_time,
        proposedCourse: proposal.proposed_course,
        groupName: groupData?.name ?? 'Your Golf Group',
      },
    }
  }

  // Declined → immediately reject the proposal and notify admin
  if (response === 'no') {
    await db
      .from('tee_time_proposals')
      .update({ status: 'rejected' })
      .eq('id', proposalId)

    const notif = await getNotificationData()
    if (notif) {
      await sendProposalDeclinedEmail(notif.admin, notif.player, notif.emailData)
    }

    return NextResponse.json({ status: 'rejected' })
  }

  // Check if everyone has now said yes
  const { data: allResponses } = await db
    .from('proposal_responses')
    .select('response')
    .eq('proposal_id', proposalId)

  const total = (allResponses ?? []).length
  const yesCount = (allResponses ?? []).filter((r: { response: string | null }) => r.response === 'yes').length

  if (yesCount === total) {
    // All agreed — apply the change
    await supabase
      .from('tee_times')
      .update({
        date: proposal.proposed_date,
        start_time: proposal.proposed_start_time,
        course: proposal.proposed_course,
      })
      .eq('id', proposal.tee_time_id)

    await db
      .from('tee_time_proposals')
      .update({ status: 'accepted' })
      .eq('id', proposalId)

    const notif = await getNotificationData()
    if (notif) {
      await sendProposalAcceptedEmail(notif.admin, notif.emailData)
    }

    return NextResponse.json({ status: 'accepted' })
  }

  return NextResponse.json({ status: 'pending', yesCount, total })
}
