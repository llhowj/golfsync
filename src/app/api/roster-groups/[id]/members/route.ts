import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

async function getRosterGroupAndVerifyAdmin(supabase: ReturnType<typeof createAdminClient>, rosterGroupId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rg } = await (supabase as any)
    .from('roster_groups')
    .select('id, group_id, is_default')
    .eq('id', rosterGroupId)
    .maybeSingle()

  if (!rg) return { rg: null, adminCheck: null, error: 'Not found' }

  const { data: adminCheck } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', rg.group_id)
    .eq('user_id', userId)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminCheck) return { rg, adminCheck: null, error: 'Forbidden' }

  return { rg, adminCheck, error: null }
}

// POST /api/roster-groups/[id]/members — add a member to a roster group
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { memberId } = body
  if (!memberId) return NextResponse.json({ error: 'memberId is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { rg, adminCheck, error } = await getRosterGroupAndVerifyAdmin(supabase, id, user.id)

  if (!rg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!adminCheck) return NextResponse.json({ error: error }, { status: 403 })

  // Enforce 4-member cap on all groups
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('roster_group_members')
    .select('*', { count: 'exact', head: true })
    .eq('roster_group_id', id)

  if ((count ?? 0) >= 4) {
    return NextResponse.json({ error: 'This group is full (max 4 players).' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any)
    .from('roster_group_members')
    .insert({ roster_group_id: id, member_id: memberId })

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Player is already in this group' }, { status: 409 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE /api/roster-groups/[id]/members — remove a member from a roster group
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { memberId } = body
  if (!memberId) return NextResponse.json({ error: 'memberId is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { rg, adminCheck, error } = await getRosterGroupAndVerifyAdmin(supabase, id, user.id)

  if (!rg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!adminCheck) return NextResponse.json({ error: error }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('roster_group_members')
    .delete()
    .eq('roster_group_id', id)
    .eq('member_id', memberId)

  return NextResponse.json({ ok: true })
}
