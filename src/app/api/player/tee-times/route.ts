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
        id, date, start_time, course, max_slots, notes, deleted_at, group_id,
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

  // Collect all tee time IDs
  const teeTimeIds = invites
    .map((inv) => (inv.tee_time as { id: string } | null)?.id)
    .filter(Boolean) as string[]

  // Fetch all RSVPs for those tee times (to show who else is going)
  const { data: allRsvps, error: rsvpError } = await supabase
    .from('rsvps')
    .select(
      `
      id, tee_time_id, member_id, status, note,
      member:group_members ( id, invited_name )
    `,
    )
    .in('tee_time_id', teeTimeIds)

  if (rsvpError) {
    console.error('[player/tee-times GET] RSVP fetch error:', rsvpError.message)
  }

  const rsvpsByTeeTime = (allRsvps ?? []).reduce<
    Record<string, typeof allRsvps>
  >((acc, rsvp) => {
    const key = rsvp.tee_time_id
    if (!acc[key]) acc[key] = []
    acc[key]!.push(rsvp)
    return acc
  }, {})

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
        group: { name: string } | null
      } | null

      if (!tt || tt.deleted_at) return null

      const rsvpsForTeeTime = rsvpsByTeeTime[tt.id] ?? []

      const myRsvpEntry = rsvpsForTeeTime.find((r) => r.member_id === memberId)
      const myRsvp = {
        status: (myRsvpEntry?.status ?? 'pending') as 'in' | 'out' | 'pending',
        note: myRsvpEntry?.note ?? null,
      }

      const confirmedPlayers = rsvpsForTeeTime
        .filter((r) => r.status === 'in' && r.member_id !== memberId)
        .map((r) => {
          const m = r.member as { id: string; invited_name: string | null } | null
          const name = m?.invited_name ?? 'Unknown'
          return { name, note: r.note ?? null }
        })

      return {
        id: tt.id,
        date: tt.date,
        start_time: tt.start_time,
        course: tt.course,
        notes: tt.notes,
        group_name: tt.group?.name ?? '',
        myRsvp,
        confirmedPlayers,
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
