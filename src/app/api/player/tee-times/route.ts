import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('memberId')

  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Verify the memberId belongs to the requesting user
  const { data: memberRecord } = await supabase
    .from('group_members')
    .select('id, user_id, invited_name, group_id')
    .eq('id', memberId)
    .maybeSingle()

  if (!memberRecord || memberRecord.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all invites for this member, joining tee time details
  const { data: invites, error: inviteError } = await supabase
    .from('invites')
    .select(
      `
      id,
      tee_time:tee_times (
        id, date, start_time, course, max_slots, notes, deleted_at, group_id, created_by,
        group:groups ( name )
      )
    `,
    )
    .eq('member_id', memberId)

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  if (!invites || invites.length === 0) {
    return NextResponse.json({ teeTimes: [] })
  }

  // Collect all tee time IDs and creator user IDs
  const teeTimeIds = invites
    .map((inv) => (inv.tee_time as { id: string } | null)?.id)
    .filter(Boolean) as string[]

  const creatorIds = [
    ...new Set(
      invites
        .map((inv) => (inv.tee_time as { created_by?: string } | null)?.created_by)
        .filter(Boolean) as string[]
    ),
  ]

  // Fetch creator profiles and RSVPs in parallel
  const [{ data: creatorProfiles }, { data: allRsvps, error: rsvpError }] = await Promise.all([
    supabase.from('profiles').select('id, name').in('id', creatorIds),
    supabase
      .from('rsvps')
      .select('id, tee_time_id, member_id, status, note, member:group_members ( id, invited_name )')
      .in('tee_time_id', teeTimeIds),
  ])

  if (rsvpError) {
    console.error('[player/tee-times GET] RSVP fetch error:', rsvpError.message)
  }

  const creatorNameById = Object.fromEntries(
    (creatorProfiles ?? []).map((p) => [p.id, p.name])
  )

  const rsvpsByTeeTime = (allRsvps ?? []).reduce<Record<string, typeof allRsvps>>(
    (acc, rsvp) => {
      const key = rsvp.tee_time_id
      if (!acc[key]) acc[key] = []
      acc[key]!.push(rsvp)
      return acc
    },
    {}
  )

  // Build the response shape
  const teeTimes = invites
    .map((inv) => {
      const tt = inv.tee_time as {
        id: string
        date: string
        start_time: string
        course: string
        max_slots: number
        notes: string | null
        deleted_at: string | null
        group_id: string
        created_by: string | null
        group: { name: string } | null
      } | null

      if (!tt || tt.deleted_at) return null

      const rsvpsForTeeTime = rsvpsByTeeTime[tt.id] ?? []

      const myRsvpEntry = rsvpsForTeeTime.find((r) => r.member_id === memberId)
      const myRsvp = {
        status: (myRsvpEntry?.status ?? 'pending') as 'in' | 'out' | 'pending' | 'requested_in',
        note: myRsvpEntry?.note ?? null,
      }

      const confirmedPlayers = rsvpsForTeeTime
        .filter((r) => r.status === 'in' && r.member_id !== memberId)
        .map((r) => {
          const m = r.member as { id: string; invited_name: string | null } | null
          const name = m?.invited_name ?? 'Unknown'
          return { name, note: r.note ?? null }
        })

      const pendingPlayers = rsvpsForTeeTime
        .filter((r) => r.status === 'pending' && r.member_id !== memberId)
        .map((r) => {
          const m = r.member as { id: string; invited_name: string | null } | null
          return m?.invited_name ?? 'Unknown'
        })

      const invitedBy = tt.created_by ? (creatorNameById[tt.created_by] ?? null) : null

      return {
        id: tt.id,
        member_id: memberId,
        date: tt.date,
        start_time: tt.start_time,
        course: tt.course,
        max_slots: tt.max_slots,
        notes: tt.notes,
        invited_by: invitedBy,
        myRsvp,
        confirmedPlayers,
        pendingPlayers,
      }
    })
    .filter(Boolean)

  // Sort: upcoming first, then past — both ascending within their group
  const today = new Date().toISOString().split('T')[0]
  const upcoming = teeTimes
    .filter((tt) => tt!.date >= today)
    .sort((a, b) => a!.date.localeCompare(b!.date))
  const past = teeTimes
    .filter((tt) => tt!.date < today)
    .sort((a, b) => b!.date.localeCompare(a!.date))

  return NextResponse.json({ teeTimes: [...upcoming, ...past] })
}
