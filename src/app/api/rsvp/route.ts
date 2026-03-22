import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  let body: {
    teeTimeId: string
    memberId: string
    status: 'in' | 'out'
    note?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { teeTimeId, memberId, status, note } = body

  if (!teeTimeId || !memberId || !status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (status !== 'in' && status !== 'out') {
    return NextResponse.json({ error: 'status must be "in" or "out"' }, { status: 400 })
  }

  // Verify the memberId belongs to the requesting user
  const { data: memberRecord } = await supabase
    .from('group_members')
    .select('id, user_id, group_id, invited_name')
    .eq('id', memberId)
    .maybeSingle()

  if (!memberRecord || memberRecord.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Verify the member has an invite for this tee time
  const { data: invite } = await supabase
    .from('invites')
    .select('id')
    .eq('tee_time_id', teeTimeId)
    .eq('member_id', memberId)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json(
      { error: 'You do not have an invite for this tee time.' },
      { status: 403 },
    )
  }

  // Fetch existing RSVP to detect status changes
  const { data: existingRsvp } = await supabase
    .from('rsvps')
    .select('id, status')
    .eq('tee_time_id', teeTimeId)
    .eq('member_id', memberId)
    .maybeSingle()

  const previousStatus = existingRsvp?.status ?? 'pending'

  // Upsert the RSVP
  const { data: rsvp, error: upsertError } = await supabase
    .from('rsvps')
    .upsert(
      {
        tee_time_id: teeTimeId,
        member_id: memberId,
        status,
        note: note?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'tee_time_id,member_id',
      },
    )
    .select()
    .single()

  if (upsertError || !rsvp) {
    return NextResponse.json(
      { error: upsertError?.message ?? 'Failed to update RSVP' },
      { status: 500 },
    )
  }

  // Detect changed RSVP (was 'in', now 'out') — notify admin
  if (previousStatus === 'in' && status === 'out') {
    // Fetch admin members of the group to notify
    const { data: admins } = await supabase
      .from('group_members')
      .select('id, invited_name, invited_email')
      .eq('group_id', memberRecord.group_id)
      .eq('is_admin', true)

    // Stub: log the notification — email sending via Resend wired up in a later step
    console.log(
      `[rsvp POST] TODO: notify admins that ${memberRecord.invited_name ?? 'a player'} changed RSVP from 'in' to 'out' for tee time ${teeTimeId}.`,
      'Admin members:',
      admins?.map((a) => a.invited_email).join(', '),
    )

    // Record a notification entry in the DB for tracking
    if (admins && admins.length > 0) {
      const notifInserts = admins.map((admin) => ({
        member_id: admin.id,
        tee_time_id: teeTimeId,
        type: 'rsvp_change' as const,
        channel: 'email' as const,
        payload: {
          changed_by_name: memberRecord.invited_name,
          from_status: previousStatus,
          to_status: status,
          note: note ?? null,
        },
      }))

      await supabase.from('notifications').insert(notifInserts)
    }
  }

  return NextResponse.json({ rsvp })
}
