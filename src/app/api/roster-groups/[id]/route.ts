import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

// PUT /api/roster-groups/[id] — rename a roster group
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rg } = await (supabase as any)
    .from('roster_groups')
    .select('group_id, is_default')
    .eq('id', id)
    .maybeSingle()

  if (!rg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (rg.is_default) return NextResponse.json({ error: 'Cannot rename the Default group' }, { status: 400 })

  // Verify admin
  const { data: adminCheck } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', rg.group_id)
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('roster_groups')
    .update({ name: name.trim() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}

// DELETE /api/roster-groups/[id] — delete a roster group
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rg } = await (supabase as any)
    .from('roster_groups')
    .select('group_id, is_default')
    .eq('id', id)
    .maybeSingle()

  if (!rg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (rg.is_default) return NextResponse.json({ error: 'Cannot delete the Default group' }, { status: 400 })

  const { data: adminCheck } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', rg.group_id)
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('roster_groups').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
