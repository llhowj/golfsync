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
    status: 'in' | 'out' | 'pending'
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

  if (status !== 'in' && status !== 'out' && status !== 'pending') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Fetch the target member record
  const { data: memberRecord } = await supabase
    .from('group_members')
    .select('id, user_id, group_id, invited_name')
    .eq('id', memberId)
    .maybeSingle()

  if (!memberRecord) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Allow if the user owns the member record, or is a group admin
  const isOwnRecord = memberRecord.user_id === user.id
  let isAdmin = false
  if (!isOwnRecord) {
    const { data: adminCheck } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', memberRecord.group_id)
      .eq('user_id', user.id)
      .eq('is_admin', true)
      .maybeSingle()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    isAdmin = true
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

  // If a player (not admin) who is 'out' requests to go 'in', convert to a request
  // that requires admin approval rather than directly changing status.
  let effectiveStatus: string = status
  if (status === 'in' && previousStatus === 'out' && isOwnRecord && !isAdmin) {
    effectiveStatus = 'requested_in'
  }

  // Enforce max slot limit when actually marking 'in' (admin override or first-time)
  if (effectiveStatus === 'in' && previousStatus !== 'in') {
    const { data: teeTime } = await supabase
      .from('tee_times')
      .select('max_slots')
      .eq('id', teeTimeId)
      .maybeSingle()

    const { count: inCount } = await supabase
      .from('rsvps')
      .select('id', { count: 'exact', head: true })
      .eq('tee_time_id', teeTimeId)
      .eq('status', 'in')

    if ((inCount ?? 0) >= (teeTime?.max_slots ?? 4)) {
      return NextResponse.json({ error: 'This tee time is full — no open slots remaining.' }, { status: 409 })
    }
  }

  // Upsert the RSVP
  const { data: rsvp, error: upsertError } = await supabase
    .from('rsvps')
    .upsert(
      {
        tee_time_id: teeTimeId,
        member_id: memberId,
        // Cast needed until Supabase types are regenerated after migration
        status: effectiveStatus as 'in' | 'out' | 'pending',
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

  // Notify admins when player requests to rejoin after being 'out'
  if (effectiveStatus === 'requested_in') {
    const { data: admins } = await supabase
      .from('group_members')
      .select('id, invited_name, invited_email')
      .eq('group_id', memberRecord.group_id)
      .eq('is_admin', true)

    console.log(
      `[rsvp POST] ${memberRecord.invited_name ?? 'A player'} requested to rejoin tee time ${teeTimeId}.`,
    )

    if (admins && admins.length > 0) {
      await supabase.from('notifications').insert(
        admins.map((admin) => ({
          member_id: admin.id,
          tee_time_id: teeTimeId,
          type: 'rsvp_change' as const,
          channel: 'email' as const,
          payload: {
            changed_by_name: memberRecord.invited_name,
            from_status: previousStatus,
            to_status: 'requested_in',
            note: note ?? null,
          },
        }))
      )
    }
  }

  return NextResponse.json({ rsvp, effectiveStatus })
}
