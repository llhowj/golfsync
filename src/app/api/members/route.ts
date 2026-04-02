import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/get-user'
import { sendPlayerInviteEmail } from '@/lib/email'

// GET /api/members?groupId=X — list all members in the group
export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 })

  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = createAdminClient()

  // Verify the requesting user belongs to this group
  const { data: memberCheck } = await adminSupabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!memberCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await adminSupabase
    .from('group_members')
    .select('id, is_admin, invited_name, invited_email, notification_channels, profiles(id, name, email, phone)')
    .eq('group_id', groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: data })
}

// POST /api/members — add a player to the group
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { groupId, name, email, phone, addToDefault } = body

  if (!groupId || !name || !email) {
    return NextResponse.json({ error: 'groupId, name, and email are required' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  // Verify the requesting user is an admin of this group
  const { data: adminCheck } = await adminSupabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Check if a user with this email already exists in profiles
  const { data: existingProfile } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  const { data: member, error } = await adminSupabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: existingProfile?.id ?? null,
      invited_name: name,
      invited_email: existingProfile ? null : email,
      is_admin: false,
    })
    .select('id, invited_name, invited_email, profiles(id, name, email, phone)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This player is already in the group' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Optionally add to the Default roster group
  if (addToDefault && member) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: defaultGroup } = await (adminSupabase as any)
      .from('roster_groups')
      .select('id')
      .eq('group_id', groupId)
      .eq('is_default', true)
      .maybeSingle()

    if (defaultGroup) {
      // Check current count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (adminSupabase as any)
        .from('roster_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('roster_group_id', defaultGroup.id)

      if ((count ?? 0) < 4) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminSupabase as any)
          .from('roster_group_members')
          .insert({ roster_group_id: defaultGroup.id, member_id: member.id })
      }
    }
  }

  // Send invite email to the new player (only if they don't already have an account)
  if (!existingProfile) {
    const { data: groupData } = await adminSupabase
      .from('groups')
      .select('name')
      .eq('id', groupId)
      .single()

    await sendPlayerInviteEmail(
      { name, email },
      groupData?.name ?? 'Your Golf Group',
    )
  }

  return NextResponse.json({ member }, { status: 201 })
}

// PUT /api/members — edit a player's info
export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { memberId, groupId, name, email, phone, isAdmin } = body

  if (!memberId || !groupId) {
    return NextResponse.json({ error: 'memberId and groupId required' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  const { data: adminCheck } = await adminSupabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch the member to know if they have an active profile
  const { data: member } = await adminSupabase
    .from('group_members')
    .select('id, user_id, invited_name, invited_email')
    .eq('id', memberId)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Update group_members row
  const memberUpdate: Record<string, unknown> = {}
  if (typeof isAdmin === 'boolean') memberUpdate.is_admin = isAdmin
  if (!member.user_id) {
    if (name) memberUpdate.invited_name = name.trim()
    if (email) memberUpdate.invited_email = email.trim().toLowerCase()
  }

  if (Object.keys(memberUpdate).length > 0) {
    await adminSupabase.from('group_members').update(memberUpdate).eq('id', memberId)
  }

  // If they have a profile, update phone
  if (member.user_id && phone !== undefined) {
    await adminSupabase.from('profiles').update({ phone: phone || null }).eq('id', member.user_id)
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/members — remove a player from the group
export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { memberId, groupId } = body

  if (!memberId || !groupId) {
    return NextResponse.json({ error: 'memberId and groupId required' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  const { data: adminCheck } = await adminSupabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()

  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Prevent removing yourself (the admin)
  if (memberId === adminCheck.id) {
    return NextResponse.json({ error: 'You cannot remove yourself from the group.' }, { status: 400 })
  }

  const { error } = await adminSupabase
    .from('group_members')
    .delete()
    .eq('id', memberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

