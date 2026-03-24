import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

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

  // Declined → immediately reject the proposal
  if (response === 'no') {
    await db
      .from('tee_time_proposals')
      .update({ status: 'rejected' })
      .eq('id', proposalId)

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

    return NextResponse.json({ status: 'accepted' })
  }

  return NextResponse.json({ status: 'pending', yesCount, total })
}
