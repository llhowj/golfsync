import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

async function getWatchAndVerifyAdmin(
  supabase: ReturnType<typeof createAdminClient>,
  watchId: string,
  userId: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: watch } = await (supabase as any)
    .from('tee_time_watches')
    .select('id, group_id')
    .eq('id', watchId)
    .maybeSingle()

  if (!watch) return { watch: null, error: 'Not found' }

  const { data: admin } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', watch.group_id)
    .eq('user_id', userId)
    .eq('is_admin', true)
    .maybeSingle()

  if (!admin) return { watch, error: 'Forbidden' }
  return { watch, error: null }
}

// PATCH /api/watches/[id]
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { watch, error } = await getWatchAndVerifyAdmin(supabase, id, user.id)
  if (!watch) return NextResponse.json({ error }, { status: 404 })
  if (error) return NextResponse.json({ error }, { status: 403 })

  const body = await request.json()
  const allowed = ['days_of_week', 'earliest_time', 'latest_time', 'min_slots', 'mode', 'repeat', 'is_active']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateError } = await (supabase as any)
    .from('tee_time_watches')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ watch: updated })
}

// DELETE /api/watches/[id]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { watch, error } = await getWatchAndVerifyAdmin(supabase, id, user.id)
  if (!watch) return NextResponse.json({ error }, { status: 404 })
  if (error) return NextResponse.json({ error }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('tee_time_watches').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
