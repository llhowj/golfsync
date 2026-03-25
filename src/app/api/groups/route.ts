import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name: string; homeCourse?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, homeCourse } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Group name is required' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name: name.trim(), home_course: homeCourse?.trim() || null })
    .select()
    .single()

  if (groupError || !group) {
    return NextResponse.json({ error: groupError?.message ?? 'Failed to create group' }, { status: 500 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: member, error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      invited_name: profile?.name ?? user.email?.split('@')[0] ?? 'Admin',
      player_type: 'core',
      is_admin: true,
    })
    .select()
    .single()

  if (memberError || !member) {
    await supabase.from('groups').delete().eq('id', group.id)
    return NextResponse.json({ error: memberError?.message ?? 'Failed to add you to group' }, { status: 500 })
  }

  // Auto-create the Default roster group and add the admin to it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: defaultGroup } = await (supabase as any)
    .from('roster_groups')
    .insert({ group_id: group.id, name: 'Default', is_default: true })
    .select('id')
    .single()

  if (defaultGroup) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('roster_group_members')
      .insert({ roster_group_id: defaultGroup.id, member_id: member.id })
  }

  return NextResponse.json({ group, member }, { status: 201 })
}
