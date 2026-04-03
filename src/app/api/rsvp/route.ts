import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'
import { sendRsvpChangeAlert, sendRequestedInAlert, sendRejoinAcceptedEmail, sendRejoinDeclinedEmail, sendAdminRsvpUpdateEmail } from '@/lib/email'

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

  // Email player when admin accepts or declines their requested_in
  if (isAdmin && (previousStatus as string) === 'requested_in' && (effectiveStatus === 'in' || effectiveStatus === 'out')) {
    const [teeTimeRes, playerProfileRes] = await Promise.all([
      supabase.from('tee_times').select('date, start_time, course, groups(name)').eq('id', teeTimeId).maybeSingle(),
      supabase.from('profiles').select('name, email').eq('id', memberRecord.user_id!).maybeSingle(),
    ])
    const teeTime = teeTimeRes.data
    const playerProfile = playerProfileRes.data
    if (teeTime && playerProfile?.email) {
      const groupName = (teeTime.groups as { name: string } | null)?.name ?? 'Your Group'
      const emailData = { teeTimeId, date: teeTime.date, startTime: teeTime.start_time, course: teeTime.course, groupName }
      if (effectiveStatus === 'in') {
        await sendRejoinAcceptedEmail({ name: playerProfile.name, email: playerProfile.email }, emailData)
      } else {
        await sendRejoinDeclinedEmail({ name: playerProfile.name, email: playerProfile.email }, emailData)
      }
    }
  }

  // Email player when admin directly changes their status to in or out (not via requested_in flow)
  if (isAdmin && (effectiveStatus === 'in' || effectiveStatus === 'out') && previousStatus !== effectiveStatus && (previousStatus as string) !== 'requested_in') {
    const [teeTimeRes, playerProfileRes] = await Promise.all([
      supabase.from('tee_times').select('date, start_time, course, groups(name)').eq('id', teeTimeId).maybeSingle(),
      memberRecord.user_id
        ? supabase.from('profiles').select('name, email').eq('id', memberRecord.user_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const teeTime = teeTimeRes.data
    const playerProfile = (playerProfileRes as { data: { name: string; email: string } | null }).data
    if (teeTime && playerProfile?.email) {
      const groupName = (teeTime.groups as { name: string } | null)?.name ?? 'Your Group'
      await sendAdminRsvpUpdateEmail(
        { name: playerProfile.name, email: playerProfile.email },
        { teeTimeId, date: teeTime.date, startTime: teeTime.start_time, course: teeTime.course, groupName },
        effectiveStatus as 'in' | 'out',
      )
    }
  }

  // Email admins when a player changes their own RSVP to in or out
  if (isOwnRecord && (effectiveStatus === 'in' || effectiveStatus === 'out') && previousStatus !== effectiveStatus) {
    const [teeTimeRes, playerProfileRes, adminMembersRes] = await Promise.all([
      supabase.from('tee_times').select('date, start_time, course, group_id, groups(name)').eq('id', teeTimeId).maybeSingle(),
      supabase.from('profiles').select('name, email').eq('id', user.id).maybeSingle(),
      supabase.from('group_members').select('user_id, invited_email, invited_name').eq('group_id', memberRecord.group_id).eq('is_admin', true),
    ])

    const teeTime = teeTimeRes.data
    const playerProfile = playerProfileRes.data
    const adminMembers = adminMembersRes.data ?? []

    if (teeTime && playerProfile && adminMembers.length > 0) {
      const adminUserIds = adminMembers.map(a => a.user_id).filter(Boolean) as string[]
      const { data: adminProfiles } = await supabase.from('profiles').select('id, name, email').in('id', adminUserIds)
      const groupName = (teeTime.groups as { name: string } | null)?.name ?? 'Your Group'

      await Promise.allSettled(
        adminMembers
          .filter(a => a.user_id !== user.id)
          .map(admin => {
            const profile = adminProfiles?.find(p => p.id === admin.user_id)
            const adminEmail = profile?.email ?? admin.invited_email
            const adminName = profile?.name ?? admin.invited_name ?? 'Admin'
            if (!adminEmail) return Promise.resolve()
            return sendRsvpChangeAlert(
              { name: adminName, email: adminEmail },
              { name: playerProfile.name, email: playerProfile.email },
              { teeTimeId, date: teeTime.date, startTime: teeTime.start_time, course: teeTime.course, groupName },
              effectiveStatus as 'in' | 'out',
            )
          })
      )
    }
  }

  // Notify admins when player requests to rejoin after being 'out'
  if (effectiveStatus === 'requested_in') {
    const [teeTimeRes, playerProfileRes, adminMembersRes] = await Promise.all([
      supabase.from('tee_times').select('date, start_time, course, groups(name)').eq('id', teeTimeId).maybeSingle(),
      supabase.from('profiles').select('name, email').eq('id', user.id).maybeSingle(),
      supabase.from('group_members').select('id, user_id, invited_name, invited_email').eq('group_id', memberRecord.group_id).eq('is_admin', true),
    ])

    const teeTime = teeTimeRes.data
    const playerProfile = playerProfileRes.data
    const adminMembers = adminMembersRes.data ?? []

    if (teeTime && playerProfile && adminMembers.length > 0) {
      const adminUserIds = adminMembers.map(a => a.user_id).filter(Boolean) as string[]
      const { data: adminProfiles } = await supabase.from('profiles').select('id, name, email').in('id', adminUserIds)
      const groupName = (teeTime.groups as { name: string } | null)?.name ?? 'Your Group'

      await Promise.allSettled(
        adminMembers
          .filter(a => a.user_id !== user.id)
          .map(admin => {
            const profile = adminProfiles?.find(p => p.id === admin.user_id)
            const adminEmail = profile?.email ?? admin.invited_email
            const adminName = profile?.name ?? admin.invited_name ?? 'Admin'
            if (!adminEmail) return Promise.resolve()
            return sendRequestedInAlert(
              { name: adminName, email: adminEmail },
              { name: playerProfile.name, email: playerProfile.email },
              { teeTimeId, date: teeTime.date, startTime: teeTime.start_time, course: teeTime.course, groupName },
            )
          })
      )

      await supabase.from('notifications').insert(
        adminMembers.map((admin) => ({
          member_id: admin.id,
          tee_time_id: teeTimeId,
          type: 'rsvp_change' as const,
          channel: 'email' as const,
          payload: {
            changed_by_name: playerProfile.name,
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
