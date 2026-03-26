import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

async function verifyAdmin(supabase: ReturnType<typeof createAdminClient>, groupId: string, userId: string) {
  const { data } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('is_admin', true)
    .maybeSingle()
  return data
}

// GET /api/watches?groupId=X
export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })

  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const admin = await verifyAdmin(supabase, groupId, user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('tee_time_watches')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ watches: data ?? [] })
}

// POST /api/watches
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { groupId, daysOfWeek, earliestTime, latestTime, minSlots, mode, repeat } = body

  if (!groupId || !daysOfWeek || !earliestTime || !latestTime || minSlots == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const admin = await verifyAdmin(supabase, groupId, user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Require phone number on file
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.phone) {
    return NextResponse.json({ error: 'A phone number is required to use Tee Time Watch. Add one in your profile.' }, { status: 422 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: watch, error } = await (supabase as any)
    .from('tee_time_watches')
    .insert({
      group_id: groupId,
      created_by: user.id,
      days_of_week: daysOfWeek,
      earliest_time: earliestTime,
      latest_time: latestTime,
      min_slots: minSlots,
      mode: mode ?? 'notify',
      repeat: repeat ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ watch }, { status: 201 })
}
