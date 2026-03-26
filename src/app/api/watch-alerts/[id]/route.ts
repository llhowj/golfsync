import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

// PATCH /api/watch-alerts/[id]
// Body: { status: 'booked', teeTimeId: string }
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: alert } = await (supabase as any)
    .from('watch_alerts')
    .select('id, group_id')
    .eq('id', id)
    .maybeSingle()

  if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: admin } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', alert.group_id)
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status, teeTimeId } = await request.json()

  if (status !== 'booked') {
    return NextResponse.json({ error: 'Only status=booked is supported' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from('watch_alerts')
    .update({
      status: 'booked',
      booked_tee_time_id: teeTimeId ?? null,
      booked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alert: updated })
}
