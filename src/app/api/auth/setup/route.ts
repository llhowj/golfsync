import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/get-user'

// Called after registration when email confirmation is disabled.
// Creates the profile row and links any pending group member invites.
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = createAdminClient()

  await adminSupabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name ?? user.email!.split('@')[0],
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  await adminSupabase
    .from('group_members')
    .update({ user_id: user.id, invited_email: null })
    .eq('invited_email', user.email!)
    .is('user_id', null)

  return NextResponse.json({ ok: true })
}
