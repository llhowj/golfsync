import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

// GET /api/roster-groups?groupId=X — list all roster groups with their members
export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })

  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Verify requesting user belongs to this group
  const { data: memberCheck } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!memberCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rosterGroups, error } = await (supabase as any)
    .from('roster_groups')
    .select(`
      id, name, is_default, created_at,
      roster_group_members ( member_id )
    `)
    .eq('group_id', groupId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten member IDs
  const groups = (rosterGroups ?? []).map((g: {
    id: string
    name: string
    is_default: boolean
    roster_group_members: Array<{ member_id: string }>
  }) => ({
    id: g.id,
    name: g.name,
    is_default: g.is_default,
    memberIds: g.roster_group_members.map((m) => m.member_id),
  }))

  return NextResponse.json({ rosterGroups: groups })
}

// POST /api/roster-groups — create a new roster group
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { groupId, name } = body

  if (!groupId || !name?.trim()) {
    return NextResponse.json({ error: 'groupId and name are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Must be admin — fetch member ID too so we can auto-add them
  const { data: adminMember } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rosterGroup, error } = await (supabase as any)
    .from('roster_groups')
    .insert({ group_id: groupId, name: name.trim(), is_default: false })
    .select('id, name, is_default')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-add the admin as the first member
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('roster_group_members')
    .insert({ roster_group_id: rosterGroup.id, member_id: adminMember.id })

  return NextResponse.json({ rosterGroup: { ...rosterGroup, memberIds: [adminMember.id] } }, { status: 201 })
}
