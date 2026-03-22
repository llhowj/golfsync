import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendTeeTimePostedEmails } from '@/lib/email'
import { getUserFromRequest } from '@/lib/get-user'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('groupId')

  if (!groupId) {
    return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
  }

  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient()

  // Verify user is a member of this group
  const { data: member } = await adminSupabase
    .from('group_members')
    .select('id, is_admin')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch group info
  const { data: group } = await adminSupabase
    .from('groups')
    .select('name, home_course')
    .eq('id', groupId)
    .single()

  const today = new Date().toISOString().split('T')[0]

  const { data: upcomingRaw, error: upcomingError } = await adminSupabase
    .from('tee_times')
    .select(`
      id, date, start_time, course, max_slots, notes, deleted_at, created_at, group_id,
      rsvps (
        id, status, note,
        member:group_members ( id, invited_name, profiles ( name ) )
      )
    `)
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .gte('date', today)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (upcomingError) {
    return NextResponse.json({ error: upcomingError.message }, { status: 500 })
  }

  const { data: pastRaw, error: pastError } = await adminSupabase
    .from('tee_times')
    .select(`
      id, date, start_time, course, max_slots, notes, deleted_at, created_at, group_id,
      rsvps (
        id, status, note,
        member:group_members ( id, invited_name, profiles ( name ) )
      )
    `)
    .eq('group_id', groupId)
    .lt('date', today)
    .order('date', { ascending: false })
    .limit(20)

  if (pastError) {
    return NextResponse.json({ error: pastError.message }, { status: 500 })
  }

  return NextResponse.json({
    upcoming: upcomingRaw ?? [],
    past: pastRaw ?? [],
    group,
  })
}

export async function POST(request: NextRequest) {
  try {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { groupId: string; date: string; time: string; course: string; maxSlots: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { groupId, date, time, course, maxSlots } = body

  if (!groupId || !date || !time || !course) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  // Verify user is an admin of this group
  const { data: adminMember } = await adminSupabase
    .from('group_members')
    .select('id, is_admin')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminMember?.is_admin) {
    return NextResponse.json({ error: 'Only group admins can create tee times.' }, { status: 403 })
  }

  // Create the tee time
  const { data: teeTime, error: ttError } = await adminSupabase
    .from('tee_times')
    .insert({
      group_id: groupId,
      date,
      start_time: time,
      course: course.trim(),
      max_slots: maxSlots ?? 4,
      created_by: user.id,
    })
    .select()
    .single()

  if (ttError || !teeTime) {
    return NextResponse.json({ error: ttError?.message ?? 'Failed to create tee time' }, { status: 500 })
  }

  // Fetch all core members
  const { data: coreMembers } = await adminSupabase
    .from('group_members')
    .select('id, invited_email, invited_name, profiles(name, email)')
    .eq('group_id', groupId)
    .eq('player_type', 'core')

  if (coreMembers && coreMembers.length > 0) {
    await adminSupabase.from('invites').insert(
      coreMembers.map((m) => ({
        tee_time_id: teeTime.id,
        member_id: m.id,
        invite_type: 'core' as const,
      }))
    )

    await adminSupabase.from('rsvps').insert(
      coreMembers.map((m) => ({
        tee_time_id: teeTime.id,
        member_id: m.id,
        status: m.id === adminMember.id ? ('in' as const) : ('pending' as const),
      }))
    )

    const { data: groupData } = await adminSupabase
      .from('groups')
      .select('name')
      .eq('id', groupId)
      .single()

    const recipients = coreMembers
      .filter((m) => m.id !== adminMember.id)
      .map((m) => {
        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
        const email = profile?.email ?? m.invited_email
        const name = profile?.name ?? m.invited_name ?? 'Player'
        return email ? { name, email } : null
      })
      .filter(Boolean) as { name: string; email: string }[]

    await sendTeeTimePostedEmails(recipients, {
      teeTimeId: teeTime.id,
      date: teeTime.date,
      startTime: teeTime.start_time,
      course: teeTime.course,
      groupName: groupData?.name ?? 'Your Golf Group',
    })
  }

  return NextResponse.json({ teeTime }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/tee-times] Unhandled error:', message)
    return NextResponse.json({ error: `Internal error: ${message}` }, { status: 500 })
  }
}
